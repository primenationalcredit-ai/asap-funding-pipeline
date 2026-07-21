import { createClient } from "@supabase/supabase-js";
const fmtPhone = (v) => {
  if (v == null) return v;
  let d = String(v).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return String(v).trim();
};

/*
 * GHL -> ASAP Funding Pipeline webhook receiver.
 *
 * Handles GHL's payload shape where standard contact fields sit at the top
 * level and mapped fields sit inside customData. Reads both, prefers the
 * cleanest source per field. Opportunity/qualification fields are captured
 * when GHL sends them.
 */

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

// ---- instant welcome send helpers ----
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
async function createRcTask(rc, subject, note) {
  const chatId = process.env.RC_TASK_CHAT_ID;
  if (!chatId) return; // not configured, skip quietly
  const body = { subject: subject.slice(0, 250) };
  if (process.env.RC_TASK_ASSIGNEE_ID) body.assignees = [{ id: process.env.RC_TASK_ASSIGNEE_ID }];
  if (note) body.description = note.slice(0, 1000);
  const r = await fetch(`${rc.server}/team-messaging/v1/chats/${chatId}/tasks`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `RC task failed ${r.status}`); }
}

async function newLeadAlarm(supabase, leadRow, leadId) {
  const assignee = process.env.NEW_LEAD_ALARM_TO || "all";
  const who = leadRow.name || leadRow.business_name || "New lead";
  await supabase.from("activities").insert({
    lead_id: leadId,
    type: "call",
    title: `New lead: ${who} â€” reach out`,
    notes: "[[alarm]]",
    due_at: new Date().toISOString(),
    created_by: "automation",
    assigned_to: assignee,
  });
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
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email failed ${r.status}: ${t}`); }
}

// Come-back-and-finish nudge when a lead abandons after Step 1.
async function sendAbandonNudge(supabase, lead) {
  const first = (lead.name || "").trim().split(/\s+/)[0] || "there";
  const link = "https://asapfundingusa.com/";
  const comms = [];
  const { hr } = centralParts();
  const createdMs = lead.created_at ? Date.parse(lead.created_at) : Date.now();
  const mayText = createdMs >= Date.parse("2026-07-21T00:00:00-05:00");
  if (mayText && lead.phone && hr >= 8 && hr < 21) {
    const smsText = `${first}, it is Joe with ASAP. You started your application but did not finish. Pick up right where you left off here: ${link}`;
    try { const rc = await rcToken(); await sendSms(rc, lead.phone, smsText); comms.push({ lead_id: lead.id, direction: "out", channel: "sms", body: smsText, to_addr: lead.phone, by_user: "automation" }); }
    catch (e) { console.log("[abandon] sms", e.message); }
  }
  if (lead.email) {
    const subject = `${first}, finish your application`;
    const emailText = `Hi ${first},\n\nYou started your application with us but did not finish. It only takes a minute to complete, and you can pick up right where you left off:\n\n${link}\n\nTalk soon,\nJoe\nASAP Funding USA`;
    try { await sendEmail(lead.email, subject, emailText); comms.push({ lead_id: lead.id, direction: "out", channel: "email", subject, body: emailText, to_addr: lead.email, by_user: "automation" }); }
    catch (e) { console.log("[abandon] email", e.message); }
  }
  if (comms.length) { try { await supabase.from("communications").insert(comms); await supabase.from("leads").update({ last_touch_at: new Date().toISOString() }).eq("id", lead.id); } catch (e) {} }
}

// Fire an instant welcome text + email the moment a new lead lands.
async function sendInstantWelcome(supabase, leadRow, leadId) {
  const first = (leadRow.name || "").trim().split(/\s+/)[0] || "there";
  const { wd, hr } = centralParts();
  const isWeekend = wd === "Sat" || wd === "Sun";
  const when = isWeekend ? "Monday" : "today";
  const comms = [];

  // SMS, compliance-safe (branded ASAP, no funding/loan/lender/$). Only during 8am-9pm Central (quiet hours).
  if (leadRow.phone && hr >= 8 && hr < 21) {
    const smsText = isWeekend
      ? `${first}, it is Joe with ASAP. I got your business info and I want to get your pre-approval offer over to you. What time works Monday for a quick call? Reply here and we will set it up.`
      : `${first}, it is Joe with ASAP. I got your business info and I want to send over your pre-approval offer today. What time works for a quick call? Reply here and we will lock it in.`;
    try { const rc = await rcToken(); await sendSms(rc, leadRow.phone, smsText); comms.push({ lead_id: leadId, direction: "out", channel: "sms", body: smsText, to_addr: leadRow.phone, by_user: "automation" }); }
    catch (e) { console.log("[welcome] sms failed", e.message); }
  }

  // Email, always (no quiet-hour restriction on email)
  if (leadRow.email) {
    const subject = `Your pre-approval offer, ${first}`;
    const emailText = isWeekend
      ? `Hi ${first},\n\nGreat news, I received your business information and I want to get a pre-approval offer over to you.\n\nMy team is back first thing Monday, so what time Monday works for a quick call? Just reply with a time that works and I will get you on the calendar.\n\nTalk soon,\nJoe\nASAP Funding USA`
      : `Hi ${first},\n\nGreat news, I received your business information and I want to send over a pre-approval offer today.\n\nWhat time works for a quick call so I can get you the details? Just reply with a time that works and I will make it happen.\n\nTalk soon,\nJoe\nASAP Funding USA`;
    try { await sendEmail(leadRow.email, subject, emailText); comms.push({ lead_id: leadId, direction: "out", channel: "email", subject, body: emailText, to_addr: leadRow.email, by_user: "automation" }); }
    catch (e) { console.log("[welcome] email failed", e.message); }
  }

  if (comms.length) {
    try {
      await supabase.from("communications").insert(comms);
      // mark the touch so the cadence clock counts from this first contact
      await supabase.from("leads").update({ last_touch_at: new Date().toISOString(), touches: [{ at: Date.now(), kind: "cadence", channel: "welcome", stage: "new", auto: true }] }).eq("id", leadId);
    } catch (e) { console.log("[welcome] log failed", e.message); }
  }
}

// First non-empty value across a list of objects, trying each key in order
function normalizeSource(s) {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "Unknown";
  if (v.includes("google") || v.includes("gclid") || v.includes("adwords")) return "Google";
  if (v.includes("facebook") || v.includes("fb") || v.includes("meta") || v.includes("instagram")) return "Facebook";
  if (v.includes("direct")) return "Direct";
  if (v.includes("referr")) return "Referral";
  if (v.includes("organic") || v.includes("website")) return "Website";
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickFrom(objs, keys) {
  for (const o of objs) {
    if (!o) continue;
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

// Last-resort: find any key that looks like a business-name field
// (legal_business_name, businessName, company_name, dba, etc.)
function fuzzyBusinessName(objs) {
  const looksRight = (k) => {
    const s = k.toLowerCase().replace(/[^a-z]/g, "");
    return (s.includes("business") && s.includes("name")) || s === "companyname" || s === "company" || s === "dba" || s === "legalname";
  };
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    for (const [k, v] of Object.entries(o)) {
      if (looksRight(k) && v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function normalize(payload) {
  const top = payload || {};
  const cd = payload.customData || {};
  const con = payload.contact || {};

  let name = pickFrom([top, con, cd], ["full_name", "fullName", "name", "contact_name"]);
  if (!name) {
    const first = pickFrom([top, con, cd], ["first_name", "firstName"]);
    const last = pickFrom([top, con, cd], ["last_name", "lastName"]);
    name = [first, last].filter(Boolean).join(" ");
  }

  return {
    ghl_contact_id: pickFrom([top, cd, con], ["contact_id", "contactId", "id"]),
    event: pickFrom([cd, top], ["event", "event_type", "eventType"]),
    opportunity_id: pickFrom([cd, top], ["opportunity_id", "opportunityId"]),
    start_time: pickFrom([cd, top], ["start_time", "startTime", "appointment_time", "appointmentTime"]),
    name,
    // top level phone is E.164 (+1...), prefer it over the formatted customData copy
    phone: fmtPhone(pickFrom([top, cd, con], ["phone", "phone_number", "phoneNumber"])),
    email: pickFrom([top, cd, con], ["email", "email_address", "emailAddress"]),
    source: normalizeSource(pickFrom([top, cd], ["contact_source", "source", "lead_source", "leadSource", "opportunity_source", "opportunitySource", "utm_source", "attributionSource"])),
    tags: pickFrom([top, cd], ["tags"]),
    // opportunity / qualification fields (from customData mapping)
    opportunity_name: pickFrom([cd, top], ["opportunity_name", "opportunityName"]),
    business_name:
      pickFrom([cd, top], [
        "business_name", "businessName",
        "legal_business_name", "legalBusinessName", "legal_business", "legalName",
        "company", "company_name", "companyName", "dba",
      ])
      || fuzzyBusinessName([cd, top, con])
      || pickFrom([cd, top], ["opportunity_name", "opportunityName"]),
    pipeline_stage: pickFrom([cd, top], ["pipeline_stage", "pipelineStage", "stage"]),
    desired_amount: pickFrom([cd, top], ["desired_amount", "desiredAmount"]),
    estimated_credit_score: pickFrom([cd, top], ["estimated_credit_score", "estimatedCreditScore", "credit_score"]),
    monthly_revenue: pickFrom([cd, top], ["monthly_revenue", "monthlyRevenue"]),
    time_in_business: pickFrom([cd, top], ["time_in_business", "timeInBusiness"]),
  };
}

const DATA_FIELDS = [
  "name", "phone", "email", "source", "tags", "opportunity_name", "business_name", "pipeline_stage",
  "desired_amount", "estimated_credit_score", "monthly_revenue", "time_in_business",
];

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const secret = process.env.GHL_WEBHOOK_SECRET;
  const headerSecret = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
  const querySecret = event.queryStringParameters?.key;
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return json(401, { error: "Unauthorized" });
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON body" }); }

  const lead = normalize(payload);
  if (!lead.name && !lead.phone && !lead.email) {
    return json(422, { error: "Payload had no name, phone, or email", received: payload });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const ev = String(lead.event || "").toLowerCase();
  const tags = String(lead.tags || "").toLowerCase();
  console.log("[ghl-in]", JSON.stringify({ event: lead.event || "", tags: lead.tags || "", contact: lead.ghl_contact_id || "", name: lead.name || "", topKeys: Object.keys(payload || {}), cdKeys: Object.keys((payload && payload.customData) || {}) }));
  const isComplete = tags.includes("funding-complete");
  const isIncomplete = tags.includes("funding-incomplete");

  try {
    // Look up any existing lead by contact id (used by every branch)
    let existing = null;
    if (lead.ghl_contact_id) {
      const r = await supabase.from("leads").select("*").eq("ghl_contact_id", lead.ghl_contact_id).maybeSingle();
      existing = r.data || null;
    }

    // ---- EVENT: call booked -> stop nudges, record the appointment ----
    if (ev === "call_booked") {
      if (existing) {
        await supabase.from("leads").update({
          booking_state: "booked",
          appointment_at: lead.start_time || null,
          automationPaused: true,
          last_touch_at: new Date().toISOString(),
          touches: [...(existing.touches || []), { at: Date.now(), kind: "call_booked", at_time: lead.start_time || "", auto: true }],
          raw: payload,
        }).eq("id", existing.id);
        try { await newLeadAlarm(supabase, { ...existing, name: `CALL BOOKED: ${existing.name || ""}` }, existing.id); } catch (e) { console.log("[booked-alarm]", e.message); }
        return json(200, { ok: true, action: "call_booked", id: existing.id });
      }
      return json(200, { ok: true, action: "call_booked_no_lead" });
    }

    // ---- EVENT: partial abandoned -> come-back nudge ----
    if (ev === "partial_abandoned") {
      if (existing && !existing.optedOut && existing.booking_state !== "booked") {
        try { await sendAbandonNudge(supabase, existing); } catch (e) { console.log("[abandon]", e.message); }
      }
      return json(200, { ok: true, action: "partial_abandoned", id: existing ? existing.id : null });
    }

    // ---- Existing lead re-send (enrich), plus complete -> start booking sequence ----
    if (existing) {
      const enrich = { raw: payload };
      for (const f of DATA_FIELDS) if (lead[f]) enrich[f] = lead[f];
      // On completion: start the booking-nudge sequence ONCE (idempotent).
      if (isComplete && existing.booking_state !== "booked" && existing.booking_state !== "pending") {
        enrich.booking_state = "pending";
        enrich.booking_started_at = new Date().toISOString();
        enrich.booking_nudge_stage = 0;
        enrich.status = existing.status === "new" ? "app_sent" : existing.status;
      }
      const { error } = await supabase.from("leads").update(enrich).eq("id", existing.id);
      if (error) { console.log("[update-fail]", JSON.stringify({ msg: error.message, details: error.details, code: error.code })); throw error; }
      console.log("[update-ok]", JSON.stringify({ id: existing.id, isComplete, booking_state: enrich.booking_state || existing.booking_state || null }));
      if (isComplete && enrich.booking_state === "pending") {
        try { await newLeadAlarm(supabase, { ...existing, name: `APP COMPLETE: ${existing.name || ""}` }, existing.id); } catch (e) {}
      }
      return json(200, { ok: true, action: isComplete ? "completed" : "updated", id: existing.id });
    }

    // ---- New lead (first time we have seen this contact) ----
    const row = { ...Object.fromEntries(DATA_FIELDS.map((f) => [f, lead[f]])) };
    row.ghl_contact_id = lead.ghl_contact_id || null;
    row.status = isComplete ? "app_sent" : "new";
    row.touches = [];
    row.raw = payload;
    if (isComplete) { row.booking_state = "pending"; row.booking_started_at = new Date().toISOString(); row.booking_nudge_stage = 0; }

    const { data, error } = await supabase.from("leads").insert(row).select().single();
    if (error) { console.log("[insert-fail]", JSON.stringify({ msg: error.message, details: error.details, hint: error.hint, code: error.code, row: Object.keys(row) })); throw error; }
    console.log("[insert-ok]", JSON.stringify({ id: data.id, isComplete, booking_state: row.booking_state || null }));
    // funding-incomplete (Step 1 only): save the lead and send NOTHING here.
    // The booking sequence (on complete) and abandon nudge (on partial_abandoned) handle messaging.
    // funding-incomplete = save only (send nothing). funding-complete = booking sequence handles it.
    // Only a plain new lead (no funnel tags) gets the instant welcome.
    const sendWelcome = !isIncomplete && !isComplete;
    if (sendWelcome) {
      try { await sendInstantWelcome(supabase, row, data.id); } catch (e) { console.log("[welcome] error", e.message); }
    }
    if (isComplete) {
      try { await newLeadAlarm(supabase, { ...row, name: `APP COMPLETE: ${row.name || ""}` }, data.id); } catch (e) {}
    }
    try { await newLeadAlarm(supabase, row, data.id); } catch (e) { console.log("[new-lead-alarm] error", e.message); }
    try {
      const rc = await rcToken();
      const parts = [row.phone ? `Phone: ${row.phone}` : "", row.email ? `Email: ${row.email}` : "", row.source ? `Source: ${row.source}` : "", row.desired_amount ? `Wants: ${row.desired_amount}` : ""].filter(Boolean);
      await createRcTask(rc, `New lead: ${row.name || row.business_name || "Unknown"}`, parts.join("\n") + "\n\nWork it in the portal: https://tranquil-muffin-691d4e.netlify.app");
    } catch (e) { console.log("[rc-task] error", e.message); }
    try {
      const notifyTo = process.env.NEW_LEAD_NOTIFY_TO || "funding@asapfundingusa.com";
      const nm = row.name || "New lead";
      const lines = [
        `New funding lead in the portal:`, ``,
        `Name:     ${row.name || ""}`,
        `Business: ${row.business_name || ""}`,
        `Phone:    ${row.phone || ""}`,
        `Email:    ${row.email || ""}`,
        `Source:   ${row.source || "website"}`,
        row.desired_amount ? `Wants:    ${row.desired_amount}` : "",
        row.estimated_credit_score ? `Score:    ${row.estimated_credit_score}` : "",
        row.monthly_revenue ? `Revenue:  ${row.monthly_revenue}` : "",
        row.time_in_business ? `In biz:   ${row.time_in_business}` : "",
        ``, `Open the portal to work this lead: https://tranquil-muffin-691d4e.netlify.app`,
      ].filter((l) => l !== "");
      await sendEmail(notifyTo, `New funding lead: ${nm}`, lines.join("\n"));
    } catch (e) { console.log("[new-lead-notify] error", e.message); }
    return json(200, { ok: true, action: "inserted", id: data.id });
  } catch (err) {
    return json(500, { error: "Database write failed", detail: String(err.message || err) });
  }
};



