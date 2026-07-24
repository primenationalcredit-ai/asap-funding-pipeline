import { createClient } from "@supabase/supabase-js";

/*
 * Background automation for the funding pipeline.
 *
 * Runs on a schedule (and can be pinged over HTTP). For leads in the
 * enabled stages it will, with guardrails:
 *   - auto-send the next DUE cadence message (one per lead per run)
 *   - auto-schedule a follow-up CALL activity on a day sequence
 *
 * Guardrails:
 *   - only runs during business hours (Mon-Fri, 8am-5pm Central)
 *   - skips opted-out, paused, snoozed, and already-replied leads
 *   - never stacks: no new call activity while one is still open
 *   - master on/off via config.autoSendEnabled
 */

const DAY = 86400000;
const CALL_DAYS = [0, 1, 2, 3, 4, 6, 8, 10, 17, 24, 31, 45, 66, 90];
const DEFAULT_STAGES = ["voicemail", "interested", "callback", "not_interested", "check_back", "report_pulled", "app_sent"];
const MAX_SENDS_PER_RUN = 30; // clear the day's due items across the morning runs
const MAX_EMAILS_PER_RUN = 8; // throttle EMAIL specifically so we don't trip spam filters (~16/hour with the 30-min schedule)
const SEND_SPACING_MS = 400; // small gap between sends so we never burst all at once
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pickFrom = (list, seed) => (!list || !list.length ? null : list[hashStr(String(seed)) % list.length]);
const pickRotate = (list, leadId, pool, occurrence) => (!list || !list.length ? null : list[(hashStr(leadId + ":" + pool) + occurrence) % list.length]);
const poolTemplates = (templates, pool) => (templates || []).filter((t) => t.pool === pool);

function repInfo(lead, config) {
  const team = (config && config.team) || [];
  const owner = (lead && (lead.owner_email || lead.ownerEmail)) || "";
  const m = team.find((t) => (t.email || "").toLowerCase() === owner.toLowerCase());
  return {
    first: (m && m.first) || (config && config.defaultRepFirst) || "Joe",
    signature: (m && m.signature) || (config && config.signature) || "Joe at ASAP Funding USA",
  };
}
function fillTokens(text, lead, config) {
  const rep = repInfo(lead, config);
  return (text || "")
    .replaceAll("{{first}}", (lead.name || "there").trim().split(/\s+/)[0] || "there")
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{link}}", config.reportLink || "")
    .replaceAll("{{smartcredit}}", config.smartCreditLink || "")
    .replaceAll("{{applink}}", config.appLink || "")
    .replaceAll("{{repfirst}}", rep.first)
    .replaceAll("{{signature}}", rep.signature);
}

// Central-time business hours check (America/Chicago handles CST/CDT)
// Automated sending runs while somebody is actually at a desk to answer a
// reply. 9am to 5pm Mountain also happens to be safe nationally: the earliest
// it reaches anyone is 8am Pacific, the latest is 7pm Eastern, so both ends
// stay inside the 8am to 9pm rule wherever the lead lives.
function inBusinessHours(now = new Date()) {
  const tz = process.env.BUSINESS_TZ || "America/Denver";
  const startHr = Number(process.env.BUSINESS_START_HOUR || 9);
  const endHr = Number(process.env.BUSINESS_END_HOUR || 17);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = Number(parts.find((p) => p.type === "hour").value);
  const isWeekday = !["Sat", "Sun"].includes(wd);
  return isWeekday && hr >= startHr && hr < endHr;
}
// Central-time calendar date as YYYY-MM-DD (sortable/comparable as a string)
function cDay(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

async function rcToken() {
  const server = process.env.RC_SERVER || "https://platform.ringcentral.com";
  const basic = Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: process.env.RC_JWT });
  const r = await fetch(`${server}/restapi/oauth/token`, {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params,
  });
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
      subject: subject || "", content: [{ type: "text/plain", value: text }],
    }),
  });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email failed ${r.status}: ${t}`); }
}

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const log = [];

  // config / templates / cadences
  const { data: cfgRows } = await supabase.from("app_config").select("key,value").in("key", ["config", "templates", "cadences"]);
  const cfg = Object.fromEntries((cfgRows || []).map((r) => [r.key, r.value]));
  const config = cfg.config || {};
  const templates = cfg.templates || [];
  const cadences = cfg.cadences || {};

  if (!config.autoSendEnabled) return { skipped: "autoSendEnabled is off" };
  if (!inBusinessHours()) return { skipped: "outside business hours" };

  // Always target the nurture stages where tailored sequences live.
  const stages = DEFAULT_STAGES;
  const { data: leads, error } = await supabase.from("leads").select("*").in("status", stages);
  if (error) throw error;

  const now = Date.now();
  let rc = null;
  let sent = 0, scheduled = 0, skipped = 0, waiting = 0, noContact = 0, noCadence = 0, capped = 0, emailsSent = 0;
  const stageCounts = {};

  const leadIds = (leads || []).map((l) => l.id);
  // One query: which of these leads have ever replied, and which have an open activity.
  const repliedSet = new Set();
  const openActSet = new Set();
  if (leadIds.length) {
    const { data: ins } = await supabase.from("communications").select("lead_id").eq("direction", "in").in("lead_id", leadIds);
    (ins || []).forEach((r) => repliedSet.add(r.lead_id));
    const { data: acts } = await supabase.from("activities").select("lead_id").eq("done", false).in("lead_id", leadIds);
    (acts || []).forEach((r) => openActSet.add(r.lead_id));
  }

  for (const lead of leads || []) {
    stageCounts[lead.status] = (stageCounts[lead.status] || 0) + 1;
    if (lead.opted_out || lead.automation_paused) { skipped++; continue; }
    if (lead.snooze_until && new Date(lead.snooze_until).getTime() > now) { skipped++; continue; }

    // hard stop on repliers: if they ever sent us an inbound message, hands off to a human
    if (repliedSet.has(lead.id)) { skipped++; continue; }

    const entered = lead.stage_entered_at ? new Date(lead.stage_entered_at).getTime() : new Date(lead.created_at).getTime();
    const touches = lead.touches || [];

    // ---- 1. auto-send the ONE currently-due cadence step (sequential) ----
    // Each step's clock starts when the previous was actually sent, so only one
    // step is ever due and idle leads never get a backlog blast.
    const rawSteps = (cadences[lead.status] || []).map((s, i) => ({ ...s, i }));
    const sentInfo = {};
    touches.forEach((t) => {
      if (t.kind === "cadence" && t.stage === lead.status && t.at >= entered - 5000) sentInfo[t.step] = t.at;
    });
    let anchor = entered, prevDay = 0, dueStep = null;
    // Any recent interaction (manual text/email, note, call, edit) pushes the next
    // auto follow-up out, so nothing fires while you're actively working the lead.
    const lastTouch = lead.last_touch_at ? new Date(lead.last_touch_at).getTime() : 0;
    const poolOcc = {};
    for (const s of rawSteps) {
      const occ = (poolOcc[s.pool] = (poolOcc[s.pool] ?? -1) + 1);
      if (sentInfo[s.i] != null) { anchor = sentInfo[s.i]; prevDay = s.day; continue; }
      const gap = Math.max(0, s.day - prevDay) * DAY;
      const base = Math.max(anchor, lastTouch); // reset on interaction
      const dueAt = Math.max(base + gap, lead.snooze_until ? new Date(lead.snooze_until).getTime() : 0);
      const tpl = s.pool ? pickRotate(poolTemplates(templates, s.pool), lead.id, s.pool, occ)
                         : templates.find((t) => t.id === s.templateId);
      // Due if its calendar day (Central) has arrived, so the morning run clears anything due today
      // rather than waiting for the exact time of day it came due.
      const isDue = cDay(dueAt) <= cDay(now);
      dueStep = tpl && isDue ? { ...s, tpl, dueAt } : null; // the first unsent step is the only candidate
      break; // only consider the first unsent step
    }

    if (!rawSteps.length) noCadence++;
    else if (!dueStep) waiting++;

    if (dueStep && sent >= MAX_SENDS_PER_RUN) { capped++; }
    if (dueStep && sent < MAX_SENDS_PER_RUN) {
      const step = dueStep;
      const isEmail = step.tpl.channel === "email";
      const to = isEmail ? lead.email : lead.phone;
      if (!to) { noContact++; }
      // Email throttle: only a few emails per run so they spread out and stay off spam lists.
      else if (isEmail && emailsSent >= MAX_EMAILS_PER_RUN) { capped++; }
      else {
        try {
          await sleep(SEND_SPACING_MS); // space sends so we never fire a burst
          const bodyText = fillTokens(step.tpl.body, lead, config)
            + (isEmail && config.emailSignature ? "\n\n" + config.emailSignature : "");
          const subject = fillTokens(step.tpl.subject, lead, config);
          if (!isEmail) { rc = rc || await rcToken(); await sendSms(rc, to, bodyText); }
          else await sendEmail(to, subject, bodyText);

          const newTouch = { at: now, channel: step.tpl.channel, kind: "cadence", stage: lead.status, step: step.i, auto: true };
          await supabase.from("leads").update({ touches: [...touches, newTouch], last_touch_at: new Date().toISOString() }).eq("id", lead.id);
          await supabase.from("communications").insert({
            lead_id: lead.id, direction: "out", channel: step.tpl.channel,
            subject: isEmail ? subject : null, body: bodyText, to_addr: to, by_user: "automation",
          });
          sent++;
          if (isEmail) emailsSent++;
          log.push(`sent ${step.tpl.channel} to ${lead.id}`);
        } catch (e) { log.push(`send failed ${lead.id}: ${e.message}`); }
      }
    }

    // ---- 2. auto-schedule a follow-up CALL ----
    // DISABLED: these auto-created call tasks piled up as overdue activities faster than
    // they could be worked. The text/email cadence already drives follow-up. Set
    // config.autoScheduleCalls = true to turn this back on.
    if (config.autoScheduleCalls) {
      if (openActSet.has(lead.id)) { continue; }
      const daysSince = Math.floor((now - entered) / DAY);
      if (CALL_DAYS.includes(daysSince)) {
        const title = `Auto follow-up call (day ${daysSince})`;
        const { data: existing } = await supabase.from("activities")
          .select("id").eq("lead_id", lead.id).eq("title", title).limit(1);
        if (!existing || !existing.length) {
          await supabase.from("activities").insert({
            lead_id: lead.id, type: "call", title,
            notes: "Auto-created follow-up. Call this lead.",
            due_at: new Date().toISOString(), created_by: "automation", assigned_to: config.autoAssignTo || null,
          });
          scheduled++;
          log.push(`scheduled call day ${daysSince} for ${lead.id}`);
        }
      }
    }
  }

  return { ok: true, sent, scheduled, skipped, waiting, noContact, noCadence, capped, emailsSent, leads: (leads || []).length, stageCounts, log: log.slice(0, 40) };
}

export const handler = async (event) => {
  // If pinged over HTTP, require the secret. Netlify's scheduled invoke has no query string.
  const secret = process.env.AUTORUN_SECRET;
  const isHttp = event && event.httpMethod;
  if (isHttp && secret && event.queryStringParameters?.key !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }
  try {
    const result = await run();
    console.log("[auto-runner]", JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error("[auto-runner] error:", e.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};

// Netlify scheduled invocation (every 30 min; the function itself enforces business hours)
export const config = { schedule: "*/30 * * * *" };
