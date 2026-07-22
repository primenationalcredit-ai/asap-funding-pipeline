import { createClient } from "@supabase/supabase-js";

/*
 * Booking-nudge runner for completed funding applications.
 *
 * When a lead completes the application (funding-complete), the webhook stamps
 * them with booking_state = "pending" + booking_started_at. This runner (every
 * minute) sends a timed sequence of calendar-booking nudges:
 *
 *   T+3 min, not booked  -> nudge 1 (underwriting wants to pre-approve, book here)
 *   T+10 min, not booked -> nudge 2 (softer: I have time now, or grab a slot)
 *
 * Stops immediately once the lead books (call_booked sets booking_state="booked").
 * Compliance: brand-safe SMS (no $ / loan / lender), quiet hours 8am-9pm Central,
 * and pre-2026-07-21 leads are EMAIL-ONLY (no text consent).
 */

const BOOK_URL = "https://asapfundingusa.com/thank-you.html";
const NUDGE1_MIN = 3;
const NUDGE2_MIN = 10;
const CONSENT_CUTOFF = Date.parse("2026-07-21T00:00:00-05:00"); // leads before this = email only

function centralHour(ms = Date.now()) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hour12: false }).format(new Date(ms));
  return parseInt(s, 10);
}
function e164(p) { const d = String(p || "").replace(/\D/g, ""); if (!d) return ""; return d.length === 10 ? `+1${d}` : `+${d}`; }

async function rcToken() {
  const server = process.env.RC_SERVER || "https://platform.ringcentral.com";
  const basic = Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${server}/restapi/oauth/token`, {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: process.env.RC_JWT }),
  });
  if (!r.ok) throw new Error(`RC auth ${r.status}`);
  const j = await r.json();
  return { token: j.access_token, server };
}
async function sendSms(rc, to, text) {
  const r = await fetch(`${rc.server}/restapi/v1.0/account/~/extension/~/sms`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: { phoneNumber: process.env.RC_FROM }, to: [{ phoneNumber: e164(to) }], text }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `SMS ${r.status}`); }
}
async function sendEmail(to, subject, text) {
  const body = { personalizations: [{ to: [{ email: to }] }], from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || undefined }, subject: subject || "", content: [{ type: "text/plain", value: text }] };
  if (process.env.EMAIL_REPLY_TO) body.reply_to = { email: process.env.EMAIL_REPLY_TO };
  body.tracking_settings = { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email ${r.status}: ${t}`); }
}

function bookingLink(lead) {
  const cid = lead.ghl_contact_id;
  return cid ? `${BOOK_URL}?cid=${encodeURIComponent(cid)}` : BOOK_URL;
}

// ---- Appointment reminders: 5 minutes before every booked call ----
const REMIND_MIN = 5;

async function rcTask(rc, subject, note) {
  const chatId = process.env.RC_TASK_CHAT_ID;
  if (!chatId) return;
  const body = { subject: String(subject).slice(0, 250) };
  if (process.env.RC_TASK_ASSIGNEE_ID) body.assignees = [{ id: process.env.RC_TASK_ASSIGNEE_ID }];
  if (note) body.description = String(note).slice(0, 1000);
  const r = await fetch(`${rc.server}/team-messaging/v1/chats/${chatId}/tasks`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `RC task ${r.status}`); }
}

async function rcPost(rc, text) {
  const chatId = process.env.RC_TASK_CHAT_ID;
  if (!chatId) return;
  const r = await fetch(`${rc.server}/team-messaging/v1/chats/${chatId}/posts`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(text).slice(0, 1000) }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `RC post ${r.status}`); }
}

function fmtCentral(ms) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(ms));
}

// ---- Hour-before confirmation: ask the client to confirm the call ----
const CONFIRM_MIN = 60;

function siteUrl() {
  return (process.env.APP_URL || process.env.URL || "https://tranquil-muffin-691d4e.netlify.app").replace(/\/+$/, "");
}

async function appointmentConfirmations(supabase) {
  const now = Date.now();
  // Fire for anything starting between 50 and 70 minutes out
  const lo = new Date(now + 50 * 60000).toISOString();
  const hi = new Date(now + 70 * 60000).toISOString();

  const { data: rows, error } = await supabase
    .from("activities").select("*")
    .eq("type", "appointment")
    .is("confirm_state", null)
    .gte("due_at", lo).lte("due_at", hi)
    .limit(50);
  if (error) { console.log("[confirm] query fail", error.message); return { asked: 0 }; }
  const pending = (rows || []).filter((a) => !a.done);
  if (!pending.length) return { asked: 0 };

  const hr = centralHour(now);
  const quiet = hr < 8 || hr >= 21;
  let rc = null, asked = 0;

  for (const a of pending) {
    if (!a.lead_id) continue;
    const r = await supabase.from("leads").select("id,name,phone,email,opted_out,business_name").eq("id", a.lead_id).maybeSingle();
    const lead = r.data;
    if (!lead || lead.opted_out) continue;

    const token = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${a.id}-${now}`;
    const first = (lead.name || "").trim().split(/\s+/)[0] || "there";
    const when = fmtCentral(Date.parse(a.due_at));
    const yes = `${siteUrl()}/.netlify/functions/confirm-appointment?t=${encodeURIComponent(token)}`;

    let sent = false;
    const callFrom = process.env.APPT_CALL_FROM || "(346) 330-4736";
    if (lead.phone && !quiet) {
      const sms = `Hi ${first}, this is ASAP confirming your call today at ${when} Central. We will be calling you from ${callFrom}, so please watch for it. Reply YES to confirm, or let us know if you need a different time.`;
      try { if (!rc) rc = await rcToken(); await sendSms(rc, lead.phone, sms); sent = true; }
      catch (e) { console.log("[confirm] sms fail", a.id, e.message); }
    }
    if (lead.email) {
      const subject = `Confirming your call at ${when} Central`;
      const text = `Hi ${first},\n\nJust confirming our call coming up at ${when} Central.\n\nWe will be calling you from ${callFrom}, so please keep an eye out for that number.\n\nClick here to confirm you are good to go:\n${yes}\n\nIf you need a different time, just reply to this email.\n\nTalk soon,\nASAP Funding USA`;
      try { await sendEmail(lead.email, subject, text); sent = true; }
      catch (e) { console.log("[confirm] email fail", a.id, e.message); }
    }

    if (sent) {
      await supabase.from("activities").update({
        confirm_state: "sent", confirm_sent_at: new Date(now).toISOString(), confirm_token: token,
      }).eq("id", a.id);
      asked++;
    }
  }
  return { asked };
}

async function appointmentReminders(supabase) {
  const now = Date.now();
  const windowEnd = now + (REMIND_MIN + 1) * 60000; // fire in the 5-to-6-min-out window

  const { data: appts, error } = await supabase
    .from("activities").select("*")
    .eq("type", "appointment")
    .is("reminded_at", null)
    .gte("due_at", new Date(now).toISOString())
    .lte("due_at", new Date(windowEnd).toISOString())
    .limit(50);
  if (error) { console.log("[appt] query fail", error.message); return { reminded: 0 }; }
  const pending = (appts || []).filter((a) => !a.done);
  if (!pending.length) return { reminded: 0 };

  let rc = null, reminded = 0;
  for (const a of pending) {
    const startMs = Date.parse(a.due_at);
    const who = a.assigned_to && a.assigned_to !== "all" ? a.assigned_to : (process.env.APPT_OWNER_EMAIL || "");
    let lead = null;
    if (a.lead_id) {
      const r = await supabase.from("leads").select("name,phone,email,business_name").eq("id", a.lead_id).maybeSingle();
      lead = r.data || null;
    }
    const client = (lead && (lead.name || lead.business_name)) || a.title || "client";
    const when = fmtCentral(startMs);
    const subject = `Appointment in ${REMIND_MIN} min: ${client}`;
    const note = `${when} Central\nClient: ${client}${lead && lead.phone ? `\nPhone: ${lead.phone}` : ""}${lead && lead.email ? `\nEmail: ${lead.email}` : ""}`;

    // 1) RingCentral task + chat post
    try { if (!rc) rc = await rcToken(); await rcTask(rc, subject, note); } catch (e) { console.log("[appt] rc task fail", e.message); }
    try { if (rc) await rcPost(rc, `Reminder: call with ${client} starts in ${REMIND_MIN} minutes (${when} Central).`); } catch (e) { console.log("[appt] rc post fail", e.message); }

    // 2) Email the owner
    if (who && who.includes("@")) {
      try {
        await sendEmail(who, subject, `Heads up, your call with ${client} starts in about ${REMIND_MIN} minutes.\n\n${note}\n\nASAP Funding USA`);
      } catch (e) { console.log("[appt] email fail", e.message); }
    }

    // 3) In-app alarm so the CRM flashes and beeps
    try {
      await supabase.from("activities").insert({
        lead_id: a.lead_id || null,
        type: "call",
        title: `Appointment in ${REMIND_MIN} min: ${client}`,
        alarm: true,
        due_at: new Date(now).toISOString(),
        created_by: "automation",
        assigned_to: a.assigned_to || "all",
      });
    } catch (e) { console.log("[appt] alarm fail", e.message); }

    await supabase.from("activities").update({ reminded_at: new Date(now).toISOString() }).eq("id", a.id);
    reminded++;
  }
  return { reminded };
}

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const now = Date.now();
  const hr = centralHour(now);
  const quiet = hr < 8 || hr >= 21; // no SMS outside 8am-9pm Central

  // Pull leads currently in the booking sequence
  const { data: leads, error } = await supabase
    .from("leads").select("*").eq("booking_state", "pending").limit(200);
  if (error) throw error;

  let nudged1 = 0, nudged2 = 0, done = 0, skipped = 0;
  let rc = null;
  const comms = [];

  for (const lead of leads || []) {
    if (lead.opted_out) { skipped++; continue; }
    const started = lead.booking_started_at ? Date.parse(lead.booking_started_at) : 0;
    if (!started) { skipped++; continue; }
    const mins = (now - started) / 60000;
    const stage = lead.booking_nudge_stage || 0; // 0 = none sent, 1 = first sent, 2 = second sent

    // Expire the sequence after nudge 2 window (stop scanning them forever)
    if (stage >= 2 || mins > NUDGE2_MIN + 60) {
      await supabase.from("leads").update({ booking_state: "expired" }).eq("id", lead.id);
      done++; continue;
    }

    // Text consent: only leads created on/after the cutoff may be texted
    const createdMs = lead.created_at ? Date.parse(lead.created_at) : now;
    const mayText = createdMs >= CONSENT_CUTOFF;
    const first = (lead.name || "").trim().split(/\s+/)[0] || "there";
    const link = bookingLink(lead);

    let doStage = 0;
    if (stage < 1 && mins >= NUDGE1_MIN) doStage = 1;
    else if (stage < 2 && mins >= NUDGE2_MIN) doStage = 2;
    if (!doStage) { skipped++; continue; }

    const smsText = doStage === 1
      ? `${first}, it is Joe with ASAP. Underwriting wants to get you pre-approved. Grab a quick time here so we can go over it: ${link}`
      : `${first}, it is Joe with ASAP. I actually have a few minutes now if you want me to call you, or grab a time here whenever is easy: ${link}`;
    const subject = doStage === 1 ? `${first}, let us get you pre-approved` : `${first}, quick call?`;
    const emailText = doStage === 1
      ? `Hi ${first},\n\nGood news, underwriting wants to move forward on getting you pre-approved. The fastest next step is a quick call so we can walk you through it.\n\nGrab a time that works here: ${link}\n\nTalk soon,\nJoe\nASAP Funding USA`
      : `Hi ${first},\n\nI have a few minutes now if you would like me to call you, otherwise just grab whatever time is easiest and I will be ready:\n\n${link}\n\nTalk soon,\nJoe\nASAP Funding USA`;

    let sent = false;
    if (mayText && lead.phone && !quiet) {
      try { if (!rc) rc = await rcToken(); await sendSms(rc, lead.phone, smsText); comms.push({ lead_id: lead.id, direction: "out", channel: "sms", body: smsText, to_addr: lead.phone, by_user: "automation" }); sent = true; }
      catch (e) { console.log("[booking] sms fail", lead.id, e.message); }
    }
    if (lead.email) {
      try { await sendEmail(lead.email, subject, emailText); comms.push({ lead_id: lead.id, direction: "out", channel: "email", subject, body: emailText, to_addr: lead.email, by_user: "automation" }); sent = true; }
      catch (e) { console.log("[booking] email fail", lead.id, e.message); }
    }

    if (sent || (!lead.phone && !lead.email)) {
      await supabase.from("leads").update({ booking_nudge_stage: doStage, last_touch_at: new Date().toISOString() }).eq("id", lead.id);
      if (doStage === 1) nudged1++; else nudged2++;
    }
  }

  if (comms.length) { try { await supabase.from("communications").insert(comms); } catch (e) { console.log("[booking] comm log fail", e.message); } }

  // Appointment reminders run on every pass, independent of quiet hours,
  // because a booked call needs its heads-up whenever it is scheduled.
  let appt = { reminded: 0 };
  try { appt = await appointmentReminders(supabase); } catch (e) { console.log("[appt] fail", e.message); }

  let conf = { asked: 0 };
  try { conf = await appointmentConfirmations(supabase); } catch (e) { console.log("[confirm] fail", e.message); }

  return { ok: true, scanned: (leads || []).length, nudged1, nudged2, expired: done, skipped, quiet, apptReminded: appt.reminded, confirmAsked: conf.asked };
}

// Cross-invocation throttle: warm Lambdas share module memory, so many browser
// pings collapse into at most one real run per THROTTLE_MS. Keyed callers (cron)
// bypass the throttle so the every-minute backup always runs.
let lastRun = 0;
const THROTTLE_MS = 55 * 1000;

export const handler = async (event) => {
  const secret = process.env.AUTORUN_SECRET;
  const keyed = secret && event?.queryStringParameters?.key === secret;

  // Unkeyed callers (the app poll) are allowed, but throttled to ~once/min.
  if (!keyed) {
    const now = Date.now();
    if (now - lastRun < THROTTLE_MS) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, throttled: true }) };
    }
    lastRun = now;
  }

  try {
    const result = await run();
    console.log("[booking-runner]", JSON.stringify(result));
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(result) };
  } catch (e) {
    console.error("[booking-runner] error:", e.message || e);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};

// HTTP-triggered (app poll + external cron). No schedule: always reachable via URL.
