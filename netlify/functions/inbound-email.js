import { createClient } from "@supabase/supabase-js";

/*
 * SendGrid Inbound Parse receiver.
 *
 * Setup (one time):
 *   1. Pick a subdomain to receive replies, e.g. reply.asapfundingusa.com
 *   2. In DNS add an MX record:  reply.asapfundingusa.com  ->  mx.sendgrid.net  (priority 10)
 *   3. In SendGrid: Settings > Inbound Parse > Add Host & URL
 *        Host: reply.asapfundingusa.com
 *        URL:  https://tranquil-muffin-691d4e.netlify.app/.netlify/functions/inbound-email
 *   4. Send FROM funding@asapfundingusa.com but set Reply-To to funding@reply.asapfundingusa.com
 *      (or just have clients reply; if the From is the parse subdomain, replies route here).
 *
 * SendGrid POSTs multipart/form-data with fields: from, to, subject, text, html, envelope, etc.
 */

const emailOf = (s) => {
  const m = String(s || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : "";
};

// Minimal multipart/form-data parser for the fields we need (text-based fields only).
function parseMultipart(body, boundary) {
  const fields = {};
  const parts = body.split("--" + boundary);
  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const head = part.slice(0, idx);
    const nameMatch = head.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    let value = part.slice(idx + 4);
    value = value.replace(/\r\n--\s*$/, "").replace(/\r\n$/, "");
    fields[name] = value;
  }
  return fields;
}

// Strip quoted reply history so we store just the new text.
function topReply(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && out.length) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim() || text.trim();
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const secret = process.env.RC_WEBHOOK_SECRET;
  if (secret && event.queryStringParameters?.key && event.queryStringParameters.key !== secret) {
    return { statusCode: 401, body: "bad key" };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const ctype = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : (event.body || "");
    let fields = {};
    const bMatch = ctype.match(/boundary=([^;]+)/);
    if (bMatch) fields = parseMultipart(raw, bMatch[1].trim().replace(/^"|"$/g, ""));
    else fields = Object.fromEntries(new URLSearchParams(raw)); // fallback

    const fromEmail = emailOf(fields.from);
    const subject = (fields.subject || "").trim();
    const body = topReply(fields.text || fields.html || "");
    if (!fromEmail) return { statusCode: 200, body: "no from" };

    // Match to a lead by email
    const { data: leads } = await supabase.from("leads").select("id,email").not("email", "is", null).limit(5000);
    const lead = (leads || []).find((l) => (l.email || "").toLowerCase() === fromEmail);
    if (!lead) {
      console.log("[inbound-email] no lead match for", fromEmail);
      return { statusCode: 200, body: "no lead" };
    }
    console.log("[inbound-email] matched lead", lead.id, "from", fromEmail);

    // Save the inbound email into the timeline
    await supabase.from("communications").insert({
      lead_id: lead.id, direction: "in", channel: "email",
      subject: subject || null, body, from_addr: fromEmail, by_user: "client",
    });

    // Reply guardrail: mark that they replied (stop-on-reply is enforced by the runner via inbound comms)
    await supabase.from("leads").update({ last_touch_at: new Date().toISOString() }).eq("id", lead.id);

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.log("[inbound-email] error", e.message);
    return { statusCode: 200, body: "err" }; // 200 so SendGrid doesn't retry-storm
  }
};
