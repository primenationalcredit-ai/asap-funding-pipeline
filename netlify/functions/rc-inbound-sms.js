import { createClient } from "@supabase/supabase-js";

/*
 * RingCentral inbound SMS receiver.
 *
 * RingCentral does two things against this URL:
 *   1. On subscription create, it sends a request carrying a Validation-Token
 *      header. We must echo that header back with a 200 and no body.
 *   2. Afterwards it POSTs message-store notifications. We keep the inbound
 *      SMS, match it to a lead by phone number, and store it.
 */

const digits = (s) => String(s || "").replace(/\D/g, "");
// last 10 digits, so +1 vs no +1 vs (281) 555-1234 all match
const last10 = (s) => digits(s).slice(-10);

export const handler = async (event) => {
  // 1. Subscription validation handshake
  const vt = event.headers["validation-token"] || event.headers["Validation-Token"];
  if (vt) {
    return { statusCode: 200, headers: { "Validation-Token": vt }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // 2. Optional shared secret, so randoms cannot post here
  const secret = process.env.RC_WEBHOOK_SECRET;
  if (secret && event.queryStringParameters?.key !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Invalid JSON" }; }

  const msg = payload?.body;
  // Log every delivery so we can confirm RingCentral is reaching us and see what it sent.
  console.log("[rc-inbound] HIT", JSON.stringify({
    type: msg?.type, direction: msg?.direction,
    from: msg?.from?.phoneNumber, to: msg?.to?.[0]?.phoneNumber,
    hasText: !!(msg?.subject || msg?.text), event: payload?.event,
  }));
  if (!msg) return { statusCode: 200, body: "ignored" };

  // Only SMS. Accept both directions now.
  const isSms = msg.type === "SMS" || msg.type === "Text";
  const dir = String(msg.direction || "").toLowerCase();
  if (!isSms || (dir !== "inbound" && dir !== "outbound")) {
    return { statusCode: 200, body: "ignored" };
  }

  const fromNumber = msg.from?.phoneNumber || msg.from?.extensionNumber || "";
  const toNumber = (msg.to && msg.to[0] && (msg.to[0].phoneNumber || msg.to[0].extensionNumber)) || "";
  const text = msg.subject || msg.text || ""; // instant SMS carries the body in `subject`
  const externalId = msg.id ? `rc-${msg.id}` : null;
  const inbound = dir === "inbound";
  // Match on the lead's number: for inbound that's the sender, for outbound the recipient.
  const matchNumber = inbound ? fromNumber : toNumber;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) {
    console.error("[rc-inbound] MISSING ENV: need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify to save inbound texts");
    return { statusCode: 200, body: "not configured" };
  }
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

  try {
    const target = last10(matchNumber);
    if (!target) return { statusCode: 200, body: "no number" };

    const { data: leads, error: readErr } = await supabase
      .from("leads").select("id, phone").not("phone", "is", null);
    if (readErr) throw readErr;
    const lead = (leads || []).find((l) => last10(l.phone) === target);
    if (!lead) {
      console.log("[rc-inbound] no lead match for", matchNumber);
      return { statusCode: 200, body: "no lead match" };
    }

    // Dedupe outbound: if the CRM just sent this exact text, do not double-log it.
    if (!inbound) {
      const since = new Date(Date.now() - 5 * 60000).toISOString();
      const { data: dupe } = await supabase.from("communications")
        .select("id").eq("lead_id", lead.id).eq("direction", "out").eq("channel", "sms")
        .eq("body", text).gte("at", since).limit(1);
      if (dupe && dupe.length) {
        return { statusCode: 200, body: "already logged by app" };
      }
    }

    const row = {
      lead_id: lead.id,
      direction: inbound ? "in" : "out",
      channel: "sms",
      body: text,
      from_addr: fromNumber,
      to_addr: toNumber,
      external_id: externalId,
      by_user: inbound ? null : "ringcentral app",
      at: msg.creationTime || new Date().toISOString(),
    };

    const { error } = await supabase.from("communications").insert(row);
    if (error && error.code !== "23505") throw error; // 23505 = dup external_id (retry)

    const patch = { last_touch_at: new Date().toISOString() };
    if (inbound && /\b(stop|stopall|unsubscribe|cancel|quit|end|optout|opt out)\b/i.test(text)) {
      patch.opted_out = true; patch.automation_paused = true;
    }
    await supabase.from("leads").update(patch).eq("id", lead.id);

    console.log("[rc-inbound]", `matched lead ${lead.id}`, dir, "from", fromNumber, "to", toNumber);
    return { statusCode: 200, body: JSON.stringify({ ok: true, matched: true, direction: dir }) };
  } catch (err) {
    console.error("[rc-inbound] failed:", err.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
