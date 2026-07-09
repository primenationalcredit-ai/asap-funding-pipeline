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
  // Log every delivery so we can confirm RingCentral is reaching us at all,
  // and see exactly what it sent.
  console.log("[rc-inbound] HIT", JSON.stringify({
    type: msg?.type, direction: msg?.direction,
    from: msg?.from?.phoneNumber, to: msg?.to?.[0]?.phoneNumber,
    hasText: !!(msg?.subject), event: payload?.event,
  }));
  if (!msg) return { statusCode: 200, body: "ignored" };

  // Only inbound texts. Outbound ones we already record when we send them.
  const isSms = msg.type === "SMS" || msg.type === "Text";
  if (!isSms || msg.direction !== "Inbound") {
    return { statusCode: 200, body: "ignored" };
  }

  const fromNumber = msg.from?.phoneNumber || "";
  const toNumber = msg.to?.[0]?.phoneNumber || "";
  const text = msg.subject || ""; // RingCentral puts SMS text in `subject`
  const externalId = msg.id ? `rc-${msg.id}` : null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) {
    console.error("[rc-inbound] MISSING ENV: need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify to save inbound texts");
    return { statusCode: 200, body: "not configured" }; // 200 so RingCentral does not disable the subscription
  }
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

  try {
    // Match a lead by the last 10 digits of the sender's number
    const target = last10(fromNumber);
    if (!target) return { statusCode: 200, body: "no from number" };

    const { data: leads, error: readErr } = await supabase
      .from("leads").select("id, phone").not("phone", "is", null);
    if (readErr) throw readErr;

    const lead = (leads || []).find((l) => last10(l.phone) === target);

    const row = {
      lead_id: lead ? lead.id : null,
      direction: "in",
      channel: "sms",
      body: text,
      from_addr: fromNumber,
      to_addr: toNumber,
      external_id: externalId,
      at: msg.creationTime || new Date().toISOString(),
    };

    const { error } = await supabase.from("communications").insert(row);
    // 23505 = unique violation, meaning RingCentral retried and we already have it
    if (error && error.code !== "23505") throw error;

    // Bump the lead so it sorts to the top and the team sees the reply
    if (lead) {
      const patch = { last_touch_at: new Date().toISOString() };
      // STOP / opt-out handling: permanently stop automation for this lead
      if (/\b(stop|stopall|unsubscribe|cancel|quit|end|optout|opt out)\b/i.test(text)) {
        patch.opted_out = true;
        patch.automation_paused = true;
      }
      await supabase.from("leads").update(patch).eq("id", lead.id);
    }

    console.log("[rc-inbound]", lead ? `matched lead ${lead.id}` : "no lead match", "from", fromNumber);
    return { statusCode: 200, body: JSON.stringify({ ok: true, matched: !!lead }) };
  } catch (err) {
    console.error("[rc-inbound] failed:", err.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
