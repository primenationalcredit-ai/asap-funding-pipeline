// grad-announce v1 - tells recently finished, non-affiliate credit clients about
// personal & business funding. Email (SendGrid) + filter-safe SMS (RingCentral).
// Modes: ?dry=1 preview (no sends, no logs) | ?mode=backfill&days=90&limit=100
// Daily schedule covers new finishers. Never sends twice (grad_announce_log).
// MARKER: GRAD_ANNOUNCE_V1
const { createClient } = require("@supabase/supabase-js");

const PB_URL = process.env.PLAYBOOK_SUPABASE_URL;
const PB_KEY = process.env.PLAYBOOK_SUPABASE_KEY;
const PD_TOKEN = process.env.PIPEDRIVE_TOKEN;
const FUNNEL = "https://asapfundingusa.com/";

function inBusinessHours(now = new Date()) {
  const tz = process.env.BUSINESS_TZ || "America/Denver";
  const startHr = Number(process.env.BUSINESS_START_HOUR || 9);
  const endHr = Number(process.env.BUSINESS_END_HOUR || 17);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = Number(parts.find((p) => p.type === "hour").value);
  return !["Sat", "Sun"].includes(wd) && hr >= startHr && hr < endHr;
}
async function rcToken() {
  const server = process.env.RC_SERVER || "https://platform.ringcentral.com";
  const basic = Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: process.env.RC_JWT });
  const r = await fetch(`${server}/restapi/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || j.message || "RC auth failed");
  return { server, token: j.access_token };
}
function e164(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}
function last10(phone) { const d = String(phone || "").replace(/\D/g, ""); return d.slice(-10); }
async function sendSms(rc, to, text) {
  const r = await fetch(`${rc.server}/restapi/v1.0/account/~/extension/~/sms`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: { phoneNumber: process.env.RC_FROM }, to: [{ phoneNumber: e164(to) }], text }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `SMS failed ${r.status}`); }
}
async function sendEmail(to, subject, text) {
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || undefined },
      subject, content: [{ type: "text/plain", value: text }],
      tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
    }),
  });
  if (!(r.status === 202 || r.ok)) { const t = await r.text().catch(() => ""); throw new Error(`SendGrid ${r.status} ${t.slice(0, 120)}`); }
}
async function pbGet(path) {
  const r = await fetch(`${PB_URL}/rest/v1/${path}`, { headers: { apikey: PB_KEY, Authorization: `Bearer ${PB_KEY}` } });
  if (!r.ok) throw new Error(`playbook read ${r.status}: ${path.slice(0, 80)}`);
  return r.json();
}
async function pdGet(path) {
  const r = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1${path}${path.includes("?") ? "&" : "?"}api_token=${PD_TOKEN}`);
  const j = await r.json().catch(() => null);
  return j && j.data;
}

const firstName = (n) => (String(n || "").trim().split(/\s+/)[0] || "there");
const smsCopy = (f) =>
  `Hi ${f}, it's the team at ASAP. Congrats on wrapping up your program! We just added some new services that a lot of our past clients are using for their personal and business goals. We sent the details to your email, or reply INFO and we will reach out. Reply STOP to opt out.`;
const emailSubject = "Now that your services are wrapped up...";
const emailCopy = (f) =>
  `Hi ${f},\n\nCongrats on finishing your program! Now that your services are over, I wanted to let you know we now offer Personal and Business funding.\n\nBig banks decline more than 4 out of 5 small business applications. We work with a network of lenders who actually say yes, with options starting as low as 0% introductory APR for qualified applicants.\n\nIf you ever need it, for a business or anything personal, just reply to this email or grab a time here and we will show you what you qualify for: ${FUNNEL}\n\nASAP Credit & Financial Services`;

exports.handler = async (event) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  const params = (event && event.queryStringParameters) || {};
  const dry = params.dry === "1";
  const backfill = params.mode === "backfill";
  const days = parseInt(params.days) || (backfill ? 90 : 4);
  const limit = Math.min(parseInt(params.limit) || (backfill ? 100 : 50), 150);
  try {
    if (!PB_URL || !PB_KEY || !PD_TOKEN) return { statusCode: 200, headers, body: JSON.stringify({ error: "missing env: PLAYBOOK_SUPABASE_URL / PLAYBOOK_SUPABASE_KEY / PIPEDRIVE_TOKEN" }) };
    if (!dry && !inBusinessHours()) return { statusCode: 200, headers, body: JSON.stringify({ quiet: true }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. recent non-affiliate finishers (newest first), deduped by deal
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const pays = await pbGet(`consultant_payments?payment_type=in.(final,paid_in_full)&is_affiliate_deal=eq.false&payment_date=gte.${cutoff}&pipedrive_deal_id=not.is.null&select=pipedrive_deal_id,client_name,payment_date&order=payment_date.desc&limit=1000`);
    const seen = new Set(); const cands = [];
    for (const p of pays) { const id = String(p.pipedrive_deal_id); if (!seen.has(id)) { seen.add(id); cands.push(p); } }

    // Skip anyone with an open overdue balance - wrong moment for this message
    const dueIds = new Set();
    try {
      const due = await pbGet(`consultant_invoices?balance=gt.1&status=eq.overdue&pipedrive_deal_id=not.is.null&select=pipedrive_deal_id&limit=1000`);
      for (const d of due) dueIds.add(String(d.pipedrive_deal_id));
    } catch (e) {}

    // 2. never twice + never to a STOP
    const { data: logRows } = await supabase.from("grad_announce_log").select("pipedrive_deal_id");
    const already = new Set((logRows || []).map((r) => String(r.pipedrive_deal_id)));
    const { data: stops } = await supabase.from("leads").select("phone").eq("opted_out", true);
    const stopPhones = new Set((stops || []).map((l) => last10(l.phone)).filter(Boolean));

    const out = []; let sent = 0, skipped = 0, errors = 0; let rc = null; const seenContacts = new Set();
    for (const c of cands) {
      if (sent >= limit) break;
      const dealId = String(c.pipedrive_deal_id);
      if (already.has(dealId)) { skipped++; continue; }
      if (dueIds.has(dealId)) { skipped++; continue; }
      const deal = await pdGet(`/deals/${dealId}`);
      const personId = deal && deal.person_id && (deal.person_id.value || deal.person_id.id);
      if (!personId) { skipped++; continue; }
      const person = await pdGet(`/persons/${personId}`);
      let email = person && Array.isArray(person.email) && person.email.length ? (person.email.find((e) => e.primary) || person.email[0]).value : null;
      if (email && /asapnoemail|@asapcreditrepair/i.test(email)) email = null; // placeholder addresses
      const phoneRaw = person && Array.isArray(person.phone) && person.phone.length ? (person.phone.find((p) => p.primary) || person.phone[0]).value : null;
      const phone = phoneRaw && !stopPhones.has(last10(phoneRaw)) ? phoneRaw : null;
      if (!email && !phone) { skipped++; continue; }
      // one message per inbox/phone (shared household contacts)
      const ek = email ? email.toLowerCase() : null; const pk = phone ? last10(phone) : null;
      if ((ek && seenContacts.has(ek)) || (pk && seenContacts.has(pk))) { skipped++; continue; }
      if (ek) seenContacts.add(ek); if (pk) seenContacts.add(pk);
      const f = firstName(c.client_name || (person && person.name));
      if (dry) { out.push({ deal: dealId, name: c.client_name, finished: c.payment_date, email: email || "(none)", sms_to: phone || "(none)" }); sent++; continue; }
      let emailStatus = "skipped", smsStatus = "skipped";
      try { if (email) { await sendEmail(email, emailSubject, emailCopy(f)); emailStatus = "sent"; } } catch (e) { emailStatus = `error: ${String(e.message).slice(0, 80)}`; errors++; }
      try { if (phone) { rc = rc || await rcToken(); await sendSms(rc, phone, smsCopy(f)); smsStatus = "sent"; } } catch (e) { smsStatus = `error: ${String(e.message).slice(0, 80)}`; errors++; }
      await supabase.from("grad_announce_log").insert({ pipedrive_deal_id: dealId, client_name: c.client_name, email, phone, email_status: emailStatus, sms_status: smsStatus, finished_date: c.payment_date });
      sent++;
      await new Promise((res) => setTimeout(res, 250));
    }
    return { statusCode: 200, headers, body: JSON.stringify({ dry, days, limit, candidates: cands.length, alreadySent: already.size, processed: sent, skipped, errors, preview: dry ? out : undefined }, null, 2) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
