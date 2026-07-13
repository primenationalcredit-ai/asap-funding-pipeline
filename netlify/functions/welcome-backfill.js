import { createClient } from "@supabase/supabase-js";

const MAX_EMAILS_PER_RUN = 8;
const MAX_TOTAL_PER_RUN = 25;
const SPACING_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function e164(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}
function centralParts(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  return { wd: p.find((x) => x.type === "weekday").value, hr: Number(p.find((x) => x.type === "hour").value) };
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
async function sendSms(rc, to, text) {
  const r = await fetch(`${rc.server}/restapi/v1.0/account/~/extension/~/sms`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: { phoneNumber: process.env.RC_FROM }, to: [{ phoneNumber: e164(to) }], text }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `SMS failed ${r.status}`); }
}
async function sendEmail(to, subject, text) {
  const body = { personalizations: [{ to: [{ email: to }] }], from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || undefined }, subject: subject || "", content: [{ type: "text/plain", value: text }] };
  if (process.env.EMAIL_REPLY_TO) body.reply_to = { email: process.env.EMAIL_REPLY_TO };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email failed ${r.status}: ${t}`); }
}

export const handler = async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { wd, hr } = centralParts();
  const isWeekend = wd === "Sat" || wd === "Sun";
  const smsOkHour = hr >= 8 && hr < 21;

  const { data: leads, error } = await supabase.from("leads").select("id,name,phone,email,touches,status").eq("status", "new");
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

  const ids = (leads || []).map((l) => l.id);
  const already = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: outs } = await supabase.from("communications").select("lead_id").in("lead_id", chunk).eq("direction", "out");
    (outs || []).forEach((c) => already.add(c.lead_id));
  }

  let rc = null, emailed = 0, texted = 0, total = 0, skipped = 0;
  const eligible = (leads || []).filter((l) => !already.has(l.id) && !(l.touches && l.touches.length));

  for (const lead of eligible) {
    if (total >= MAX_TOTAL_PER_RUN) break;
    const first = (lead.name || "").trim().split(/\s+/)[0] || "there";
    const comms = [];

    if (lead.phone && smsOkHour) {
      const smsText = isWeekend
        ? `${first}, it is Joe with ASAP. I got your business info and I want to get your pre-approval offer over to you. What time works Monday for a quick call? Reply here and we will set it up.`
        : `${first}, it is Joe with ASAP. I got your business info and I want to send over your pre-approval offer today. What time works for a quick call? Reply here and we will lock it in.`;
      try { await sleep(SPACING_MS); rc = rc || await rcToken(); await sendSms(rc, lead.phone, smsText); comms.push({ lead_id: lead.id, direction: "out", channel: "sms", body: smsText, to_addr: lead.phone, by_user: "automation" }); texted++; }
      catch (e) { console.log("[backfill] sms failed", lead.id, e.message); }
    }

    if (lead.email && emailed < MAX_EMAILS_PER_RUN) {
      const subject = `Your pre-approval offer, ${first}`;
      const emailText = isWeekend
        ? `Hi ${first},\n\nGreat news, I received your business information and I want to get a pre-approval offer over to you.\n\nMy team is back first thing Monday, so what time Monday works for a quick call? Just reply with a time that works and I will get you on the calendar.\n\nTalk soon,\nJoe\nASAP Funding USA`
        : `Hi ${first},\n\nGreat news, I received your business information and I want to send over a pre-approval offer today.\n\nWhat time works for a quick call so I can get you the details? Just reply with a time that works and I will make it happen.\n\nTalk soon,\nJoe\nASAP Funding USA`;
      try { await sleep(SPACING_MS); await sendEmail(lead.email, subject, emailText); comms.push({ lead_id: lead.id, direction: "out", channel: "email", subject, body: emailText, to_addr: lead.email, by_user: "automation" }); emailed++; }
      catch (e) { console.log("[backfill] email failed", lead.id, e.message); }
    }

    if (comms.length) {
      try {
        await supabase.from("communications").insert(comms);
        await supabase.from("leads").update({ last_touch_at: new Date().toISOString(), touches: [{ at: Date.now(), kind: "cadence", channel: "welcome", stage: "new", auto: true }] }).eq("id", lead.id);
        total++;
      } catch (e) { console.log("[backfill] log failed", lead.id, e.message); }
    } else { skipped++; }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, newLeads: (leads || []).length, eligible: eligible.length, processedThisRun: total, texted, emailed, skipped, remaining: Math.max(0, eligible.length - total) }) };
};
