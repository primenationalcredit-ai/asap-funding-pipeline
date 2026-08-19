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
// OUTREACH PIPELINE ONLY. Previously this also included not_interested (Closed)
// and report_pulled (Funding), so clients past the outreach stage were still
// being chased by automation. wrong_number is left out on purpose — texting a
// number we know is wrong burns sends and hurts sender reputation.
const DEFAULT_STAGES = ["new", "voicemail", "callback", "check_back", "waiting_reports", "app_sent", "appointment_booked"];
const MAX_SENDS_PER_RUN = Number(process.env.MAX_SENDS_PER_RUN || 1); // one message per run; the 3-minute schedule sets the actual pace
const MAX_EMAILS_PER_RUN = Number(process.env.MAX_EMAILS_PER_RUN || 1); // with one send per run this just mirrors the cap above
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
    .replaceAll("{{business}}", (lead.business_name || lead.businessName || "your business"))
    .replaceAll("{{booklink}}", config.bookLink || "")
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
// Normalize outbound SMS to GSM-7-safe ASCII. One typographic character (curly
// apostrophe from a business name, smart quotes, ellipsis) silently flips the
// whole message to UCS-2, and a mislabeled hop renders it as CJK mojibake on the
// client's phone (the "Chinese text" incident). Keeping everything GSM-safe also
// keeps segments at 160 chars instead of 70.
function gsmSafe(s) {
  return String(s || "")
    .replace(/[\u2018\u2019\u201A\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n\r]/g, "");
}

async function sendSms(rc, to, text) {
  text = gsmSafe(text);
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

  // RULE: a client with an appointment on the books is NOT chased by automation.
  // The rep owns that conversation until the appointment happens.
  const apptLeadIds = new Set();
  try {
    const { data: appts } = await supabase.from("activities")
      .select("lead_id")
      .eq("type", "appointment")
      .eq("done", false)
      .gte("due_at", new Date(now - 3600000).toISOString()); // an hour's grace either side
    for (const a of appts || []) if (a && a.lead_id) apptLeadIds.add(a.lead_id);
  } catch (e) { console.log("[auto-runner] appointment lookup failed:", e.message); }

  let rc = null;
  let sent = 0, scheduled = 0, skipped = 0, waiting = 0, noContact = 0, noCadence = 0, capped = 0, emailsSent = 0, hasAppt = 0;
  let sentToday = 0; const notDueSample = [];
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
    if (apptLeadIds.has(lead.id)) { hasAppt++; continue; } // appointment booked, leave them alone
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
    // Never send a lead more than one cadence message in a day. If two steps are
    // both overdue, today's run sends the first and the next becomes due tomorrow.
    const sentTodayAlready = touches.some((t) => t && t.kind === "cadence" && t.at && cDay(t.at) === cDay(now));
    if (sentTodayAlready) { sentToday++; continue; }

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
    else if (!dueStep) {
      waiting++;
      // Log a handful so we can see WHY the runner disagrees with the app's
      // "Nd overdue" badge — which step, when it thinks it is due, and what
      // pushed it out (stage entry, last touch, or a snooze).
      if (notDueSample.length < 5) {
        const first = rawSteps.find((s2) => sentInfo[s2.i] == null);
        let calc = null;
        if (first) {
          let a = entered, pd = 0;
          for (const s2 of rawSteps) {
            if (sentInfo[s2.i] != null) { a = sentInfo[s2.i]; pd = s2.day; continue; }
            const g = Math.max(0, s2.day - pd) * DAY;
            const b = Math.max(a, lastTouch);
            calc = { step: s2.i, day: s2.day, pool: s2.pool, dueAt: new Date(Math.max(b + g, lead.snooze_until ? new Date(lead.snooze_until).getTime() : 0)).toISOString(), hasTemplate: !!(s2.pool ? poolTemplates(templates, s2.pool).length : templates.find((t) => t.id === s2.templateId)) };
            break;
          }
        }
        notDueSample.push({
          name: lead.name, status: lead.status,
          entered: new Date(entered).toISOString(),
          lastTouch: lastTouch ? new Date(lastTouch).toISOString() : null,
          snooze: lead.snooze_until || null,
          steps: rawSteps.length, calc,
        });
      }
    }

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

          // CLAIM THE STEP BEFORE SENDING. Previously we sent first and recorded
          // after, so two overlapping runs could both see the step unsent and both
          // fire it — that is the double-text. Claiming first means the second run
          // sees it taken. append_touch appends server-side, so a concurrent write
          // can never wipe the marker (the old whole-array write could).
          const newTouch = { at: now, channel: step.tpl.channel, kind: "cadence", stage: lead.status, step: step.i, auto: true };
          const { error: claimErr } = await supabase.rpc("append_touch", { p_lead_id: lead.id, p_touch: newTouch });
          if (claimErr) { log.push(`claim failed ${lead.id}: ${claimErr.message}`); continue; }
          await supabase.from("leads").update({ last_touch_at: new Date().toISOString() }).eq("id", lead.id);

          if (!isEmail) { rc = rc || await rcToken(); await sendSms(rc, to, bodyText); }
          else await sendEmail(to, subject, bodyText);

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

  if (notDueSample.length) console.log("[auto-runner] not-due sample:", JSON.stringify(notDueSample));
  return { ok: true, sent, scheduled, skipped, waiting, sentToday, hasAppt, noContact, noCadence, capped, emailsSent, leads: (leads || []).length, stageCounts, log: log.slice(0, 40) };
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
