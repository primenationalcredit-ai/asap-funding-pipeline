import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Phone, MessageSquare, Mail, Copy, Check, Plus, Search, Settings as SettingsIcon,
  Clock, Trash2, User, FileText, Send, AlertCircle, ChevronDown, Zap, Wifi,
  X, Eye, EyeOff, KeyRound, Upload, ExternalLink, Building2, CalendarClock,
  ListChecks, Pencil, Save, LogOut, Lock, LayoutGrid, DollarSign, Menu,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ================================================================== */
/*  Stages                                                            */
/* ================================================================== */
const STAGES = [
  { key: "new", label: "New", tone: "slate" },
  { key: "voicemail", label: "Left Voicemail", tone: "amber" },
  { key: "interested", label: "Interested", tone: "sky" },
  { key: "callback", label: "Call Back", tone: "violet" },
  { key: "not_interested", label: "Not Interested", tone: "orange" },
  { key: "report_pulled", label: "Report Pulled", tone: "teal" },
  { key: "submitted", label: "Submitted", tone: "indigo" },
  { key: "pre_approved", label: "Approved / Offer", tone: "cyan" },
  { key: "contracts_out", label: "Contracts Out", tone: "lime" },
  { key: "funded", label: "Funded", tone: "emerald" },
  { key: "commission_paid", label: "Commission Paid", tone: "yellow" },
  { key: "declined", label: "Declined", tone: "pink" },
  { key: "credit_repair", label: "Credit Repair", tone: "fuchsia" },
  { key: "dead", label: "Dead", tone: "rose" },
];
const TONE = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-100 text-sky-800 ring-sky-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  violet: "bg-violet-100 text-violet-800 ring-violet-200",
  indigo: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  teal: "bg-teal-100 text-teal-800 ring-teal-200",
  cyan: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  lime: "bg-lime-100 text-lime-800 ring-lime-200",
  orange: "bg-orange-100 text-orange-800 ring-orange-200",
  emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  blue: "bg-blue-100 text-blue-800 ring-blue-200",
  yellow: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
  pink: "bg-pink-100 text-pink-800 ring-pink-200",
  rose: "bg-rose-100 text-rose-800 ring-rose-200",
};
const DAY = 86400000;

/* ================================================================== */
/*  Defaults: config, template library, stage cadences               */
/* ================================================================== */
const DEFAULT_CONFIG = {
  reportLink: "https://www.myscoreiq.com/industry-score-preferred.aspx?offercode=432143MH",
  appLink: "https://tinyurl.com/asapfundingapp",
  signature: "Joe at ASAP Funding USA",
  funderName: "Torro",
  funderEmail: "slocsubmissions@torro.com",
};

const DEFAULT_TEMPLATES = [
  // ============ VOICEMAIL: text (pool vm_sms) ============
  { id: "vm_sms_a", pool: "vm_sms", name: "VM text: direct", channel: "sms", subject: "",
    body: `Hi {{first}}, it's Joe with ASAP. I got your request for information from Facebook and tried giving you a call. Give me a quick call back or shoot me a text when you get a sec.` },
  { id: "vm_sms_b", pool: "vm_sms", name: "VM text: story", channel: "sms", subject: "",
    body: `Hi {{first}}, Joe with ASAP here. You reached out to us on Facebook and I tried to connect. I have some options that could really help your business. Call or text me back.` },
  { id: "vm_sms_c", pool: "vm_sms", name: "VM text: myth bust", channel: "sms", subject: "",
    body: `Hi {{first}}, it's Joe from ASAP. Following up on the request you sent us through Facebook. Whenever you have 5 minutes, text me back and we can go over everything.` },
  { id: "vm_sms_d", pool: "vm_sms", name: "VM text: curiosity", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. Tried reaching you about the info you requested on Facebook. Text me back a good time to connect and I will keep it quick.` },

  // ============ VOICEMAIL: email (pool vm_email) ============
  { id: "vm_email_a", pool: "vm_email", name: "VM email: direct", channel: "email", subject: "Tried to reach you, {{first}}",
    body: `Hey {{first}},

{{signature}} here. I just tried calling. Here is the short version: I can likely get you pre-approved today, and it costs you nothing to find out.

Call me back or just reply to this and we will get moving. Takes a few minutes to see what you qualify for.

Talk soon,
{{signature}}

PS. A bank's no is not the final answer. We shop your file across 75+ lenders.` },
  { id: "vm_email_b", pool: "vm_email", name: "VM email: story", channel: "email", subject: "How a 580 score got $120,000",
    body: `Hey {{first}},

Quick story while I have you. We recently worked with an owner who had a 580 score and had been open less than 6 months. Every bank passed. We got them $120,000.

I am not saying you get the same number. I am saying the bank's box is not the only box. I just tried calling to see what your file looks like.

Call or reply and I will get right on it.

{{signature}}` },
  { id: "vm_email_c", pool: "vm_email", name: "VM email: myth bust", channel: "email", subject: "The bank said no. So what.",
    body: `Hey {{first}},

Tried reaching you. Here is the thing most owners never hear: when a bank declines you, that is one lender's opinion, not the market's.

We take your file to 75+ lenders and let them compete. That is a completely different game, and it is free to see where you land.

Reply or call me back and I will pull your options together.

{{signature}}` },

  // ============ INTERESTED / SEND LINK: text (pool int_sms) ============
  { id: "first_sms", pool: "int_sms", name: "Interested text: standard", channel: "sms", subject: "",
    body: `Hi {{first}}, it's Joe with ASAP. Great talking. Here is the secure link to pull your report so I can review your options: {{link}} About 5 minutes, no hit to your score. Text me when it is done.` },
  { id: "int_sms_b", pool: "int_sms", name: "Interested text: story", channel: "sms", subject: "",
    body: `Hi {{first}}, Joe with ASAP. Thanks for the info you sent us from Facebook. The next step is quick, pull your report here so I can see how I can help: {{link}} 5 min, no score hit.` },
  { id: "int_sms_c", pool: "int_sms", name: "Interested text: risk reversal", channel: "sms", subject: "",
    body: `{{first}}, the link is a soft pull. No hit to your score, no cost, no obligation. It is the one thing I need to show you your options: {{link}}` },
  { id: "int_sms_d", pool: "int_sms", name: "Interested text: speed", channel: "sms", subject: "",
    body: `{{first}}, once I have your report I move fast and will get right back to you. Pull it here, about 5 minutes: {{link}}` },

  // ============ INTERESTED / SEND LINK: email (pool int_email) ============
  { id: "first_email", pool: "int_email", name: "Interested email: standard", channel: "email", subject: "Your pre-approval, {{first}}",
    body: `Hi {{first}},

Great talking. The next step to get you pre-approved is quick. Pull your report through the secure link below so I can review your profile and line up your best options.

{{link}}

About 5 minutes, and it does not hurt your score. Once it is done, reply or text me and I will get to work.

{{signature}}` },
  { id: "int_email_b", pool: "int_email", name: "Interested email: story", channel: "email", subject: "580 score. $120,000. Under 6 months open.",
    body: `Hi {{first}},

Here is what is possible. A recent client had a 580 score and had been in business less than 6 months. The banks all said no. We got them $120,000.

Your file is its own story, and I cannot tell it until I see your report. That is all I need to show you real numbers:

{{link}}

Takes about 5 minutes and does not touch your score. Pull it and I will get right to work.

{{signature}}` },
  { id: "int_email_c", pool: "int_email", name: "Interested email: 75 lenders", channel: "email", subject: "Let them compete for you, {{first}}",
    body: `Hi {{first}},

A bank can only offer you the bank's box. We do the opposite. We take your profile to 75+ lenders and make them compete, then bring you the best fit on amount and terms.

To do that I need one thing, your report:

{{link}}

5 minutes, no hit to your score. Reply once it is done and I will line up your options.

{{signature}}` },

  // ============ CALL BACK: text (pool cb_sms) ============
  { id: "cb_sms_a", pool: "cb_sms", name: "Call back text: reconnect", channel: "sms", subject: "",
    body: `Hi {{first}}, Joe with ASAP, circling back like we planned. When is a good time to connect? Text me a time that works.` },
  { id: "cb_sms_b", pool: "cb_sms", name: "Call back text: nudge", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP here. Still holding your spot. 5 minutes is all I need. What time today or tomorrow works?` },

  // ============ CALL BACK: email (pool cb_email) ============
  { id: "cb_email_a", pool: "cb_email", name: "Call back email: reconnect", channel: "email", subject: "Picking back up, {{first}}",
    body: `Hi {{first}},

Following up like we talked about. I can get you pre-approved quickly, I just need a few minutes with you. What time works best to connect this week?

Reply here or text me and we will lock it in.

{{signature}}` },
  { id: "cb_email_b", pool: "cb_email", name: "Call back email: value", channel: "email", subject: "Still worth 5 minutes, {{first}}",
    body: `Hi {{first}},

No pressure, just keeping my word to follow up. The reason a quick call matters: most owners have no idea what they actually qualify for until we look, and looking is free.

When are you around? I will keep it short and tell you straight where you stand.

{{signature}}` },

  // ============ NOT INTERESTED: email (pool ni_email) ============
  { id: "ni_email_a", pool: "ni_email", name: "Not interested: keep in touch", channel: "email", subject: "Here when you need us, {{first}}",
    body: `Hi {{first}},

No pressure at all. If your situation changes and you want funding, we move fast and shop the best terms across 75+ lenders, not just one bank's answer.

I will keep your info on file. Reach out anytime and we pick right back up.

{{signature}}` },
  { id: "ni_email_b", pool: "ni_email", name: "Not interested: door open", channel: "email", subject: "When the timing is right, {{first}}",
    body: `Hi {{first}},

Totally understand it is not the moment. One thing to file away: the day you do need capital, you do not want to be starting from scratch.

Keep my number. When you are ready, we can usually get you a pre-approval fast. I am here.

{{signature}}` },

  // ============ AFTER REPORT PULLED: text (pool pulled_sms) ============
  { id: "pulled_sms_a", pool: "pulled_sms", name: "Got it, reviewing", channel: "sms", subject: "",
    body: `Got your report, {{first}}, thank you. Reviewing everything now and I will be back to you today. Joe with ASAP` },
  { id: "pulled_sms_b", pool: "pulled_sms", name: "Got it, working it", channel: "sms", subject: "",
    body: `{{first}}, got it, thank you. Going through your file now to see how I can help. Back to you today. Joe with ASAP` },

  // ============ APPLICATION (after pre-approval): pool app_sms / app_email ============
  { id: "app_sms_a", pool: "app_sms", name: "Application: more funding (text)", channel: "sms", subject: "",
    body: `Hi {{first}}, to move forward we need a quick application with your last few bank statements. You can do it all in one place, about 10 minutes: {{applink}}` },
  { id: "app_email_a", pool: "app_email", name: "Application: more funding (email)", channel: "email", subject: "Your funding application, {{first}}",
    body: `Hi {{first}},

To go for more funding we need a short application along with your last 4 months of business bank statements. You can complete and sign everything in one place here, about 10 minutes:

{{applink}}

Have your bank statements, a voided check, and your driver's license handy. Reply or text me if anything comes up.

{{signature}}` },
];

// Per stage: ordered steps. day = days after entering that stage.
const DEFAULT_CADENCES = {
  new: [],
  voicemail: [
    { day: 0, pool: "vm_sms" },
    { day: 0, pool: "vm_email" },
    { day: 2, pool: "vm_sms" },
    { day: 5, pool: "vm_email" },
    { day: 9, pool: "vm_sms" },
    { day: 16, pool: "vm_email" },
    { day: 30, pool: "vm_sms" },
  ],
  interested: [
    { day: 0, pool: "int_sms" },
    { day: 0, pool: "int_email" },
    { day: 1, pool: "int_sms" },
    { day: 3, pool: "int_email" },
    { day: 6, pool: "int_sms" },
    { day: 10, pool: "int_email" },
    { day: 16, pool: "int_sms" },
    { day: 23, pool: "int_email" },
    { day: 30, pool: "int_sms" },
  ],
  callback: [
    { day: 0, pool: "cb_sms" },
    { day: 2, pool: "cb_email" },
    { day: 5, pool: "cb_sms" },
    { day: 12, pool: "cb_email" },
    { day: 25, pool: "cb_sms" },
  ],
  not_interested: [
    { day: 10, pool: "ni_email" },
    { day: 30, pool: "ni_email" },
  ],
  report_pulled: [{ day: 0, pool: "pulled_sms" }],
  submitted: [],
  pre_approved: [],
  contracts_out: [],
  funded: [],
  commission_paid: [],
  declined: [],
  credit_repair: [],
  dead: [],
};

/* ================================================================== */
/*  Data mapping                                                      */
/* ================================================================== */
function rowToLead(r) {
  return {
    id: r.id,
    name: r.name || "",
    phone: r.phone || "",
    email: r.email || "",
    notes: r.notes || "",
    source: r.source || "",
    tags: r.tags || "",
    status: r.status || "new",
    opportunityName: r.opportunity_name || "",
    pipelineStage: r.pipeline_stage || "",
    desiredAmount: r.desired_amount || "",
    fundingPurpose: r.funding_purpose || "",
    fundingTimeline: r.funding_timeline || "",
    creditScore: r.estimated_credit_score || "",
    monthlyRevenue: r.monthly_revenue || "",
    timeInBusiness: r.time_in_business || "",
    businessName: r.business_name || "",
    businessType: r.business_type || "",
    einStatus: r.ein_status || "",
    bestTime: r.best_time || "",
    nextStep: r.next_step || "",
    myscoreiqUsername: r.myscoreiq_username || "",
    myscoreiqPassword: r.myscoreiq_password || "",
    ssnLast4: r.ssn_last4 || "",
    reportPath: r.report_path || "",
    fundedAmount: r.funded_amount != null ? r.funded_amount : "",
    commissionAmount: r.commission_amount != null ? r.commission_amount : "",
    declineReason: r.decline_reason || "",
    fundedAt: r.funded_at ? new Date(r.funded_at).getTime() : null,
    commissionPaidAt: r.commission_paid_at ? new Date(r.commission_paid_at).getTime() : null,
    reportUploadedAt: r.report_uploaded_at ? new Date(r.report_uploaded_at).getTime() : null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    stageEnteredAt: r.stage_entered_at ? new Date(r.stage_entered_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
    linkSentAt: r.link_sent_at ? new Date(r.link_sent_at).getTime() : null,
    lastTouchAt: r.last_touch_at ? new Date(r.last_touch_at).getTime() : null,
    touches: Array.isArray(r.touches) ? r.touches : [],
    raw: r.raw || null,
  };
}
const FIELD_MAP = {
  name: "name", phone: "phone", email: "email", notes: "notes", source: "source", tags: "tags",
  status: "status", touches: "touches",
  opportunityName: "opportunity_name", pipelineStage: "pipeline_stage",
  desiredAmount: "desired_amount", creditScore: "estimated_credit_score",
  fundingPurpose: "funding_purpose", fundingTimeline: "funding_timeline",
  monthlyRevenue: "monthly_revenue", timeInBusiness: "time_in_business",
  businessName: "business_name", businessType: "business_type", einStatus: "ein_status",
  bestTime: "best_time", nextStep: "next_step",
  myscoreiqUsername: "myscoreiq_username", myscoreiqPassword: "myscoreiq_password", ssnLast4: "ssn_last4",
  reportPath: "report_path",
  fundedAmount: "funded_amount", commissionAmount: "commission_amount", declineReason: "decline_reason",
};
function leadPatchToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k in FIELD_MAP) row[FIELD_MAP[k]] = v;
    else if (k === "linkSentAt") row.link_sent_at = v ? new Date(v).toISOString() : null;
    else if (k === "lastTouchAt") row.last_touch_at = v ? new Date(v).toISOString() : null;
    else if (k === "stageEnteredAt") row.stage_entered_at = v ? new Date(v).toISOString() : null;
    else if (k === "reportUploadedAt") row.report_uploaded_at = v ? new Date(v).toISOString() : null;
    else if (k === "fundedAt") row.funded_at = v ? new Date(v).toISOString() : null;
    else if (k === "commissionPaidAt") row.commission_paid_at = v ? new Date(v).toISOString() : null;
  }
  return row;
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";

// Stable pseudo-random pick so a given lead+step always shows the same variant
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pickFrom(list, seed) { if (!list || !list.length) return null; return list[hashStr(String(seed)) % list.length]; }
function poolTemplates(templates, pool) { return (templates || []).filter((t) => t.pool === pool); }
function callOpener(lead) {
  const calls = (lead?.touches || []).filter((t) => t.kind === "call");
  const last = calls.length ? calls[calls.length - 1] : null;
  if (!last) return "";
  if (last.disposition === "voicemail") return "I just left you a voicemail. ";
  if (last.disposition === "connected") return "Great talking just now. ";
  if (last.disposition === "no_answer") return "I tried reaching you and missed you. ";
  if (last.disposition === "callback") return "Following up as promised. ";
  return "";
}
function fillTokens(text, lead, config) {
  return (text || "")
    .replaceAll("{{opener}}", callOpener(lead))
    .replaceAll("{{first}}", firstName(lead.name))
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{link}}", config.reportLink || "[set your MyScoreIQ link in Settings]")
    .replaceAll("{{applink}}", config.appLink || APP_LINK_DEFAULT)
    .replaceAll("{{signature}}", config.signature || "");
}
function parseMoney(s) {
  if (!s) return null;
  const str = String(s).toLowerCase().replace(/[$,\s]/g, "");
  const m = str.match(/([\d.]+)\s*(k|m)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  if (m[2] === "k") n *= 1000;
  if (m[2] === "m") n *= 1000000;
  return n;
}
const APP_LINK_DEFAULT = "https://tinyurl.com/asapfundingapp";
const APP_SMS_DEFAULT = `Hi {{first}}, {{opener}}to move forward on funding we need a quick application with your last few bank statements. You can do it all in one place, about 10 minutes: {{applink}}`;
const APP_EMAIL_SUBJECT_DEFAULT = `Your funding application, {{first}}`;
const APP_EMAIL_DEFAULT = `Hi {{first}},

{{opener}}To get you funded we need a short application along with your last 4 months of business bank statements. You can complete and sign everything in one place here, it takes about 10 minutes:

{{applink}}

Have your bank statements, a voided check, and your driver's license handy. Reply or text me if anything comes up.

{{signature}}`;
function telDigits(phone) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}
const smsHref = (phone, body) => `sms:${telDigits(phone)}?&body=${encodeURIComponent(body)}`;
const mailHref = (email, subject, body) =>
  `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const telHref = (phone) => `tel:${telDigits(phone)}`;

function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function nextStepFor(lead) {
  switch (lead.status) {
    case "new": return { text: "Call them. Log what happens below and the right campaign starts on its own.", tone: "slate" };
    case "voicemail": return { text: "Couldn't reach them. Callback texts and emails are going out. Try them again, or send the next when due.", tone: "amber" };
    case "interested": return { text: "They're in. Send the MyScoreIQ link so they can pull their report and get pre-approved.", tone: "sky" };
    case "callback": return { text: "Reconnect when you agreed. Reminder messages are running until you reach them.", tone: "violet" };
    case "not_interested": return { text: "Parked. Light check-ins go out in case their timing changes.", tone: "orange" };
    case "report_pulled": return { text: "Report is in. Review it, then email it to Torro for a pre-approval.", tone: "teal" };
    case "submitted": return { text: "Submitted to Torro. Waiting on their pre-approval.", tone: "indigo" };
    case "pre_approved": return { text: "Torro approved them. Review the offer with the client. When they accept, send contracts.", tone: "cyan" };
    case "contracts_out": return { text: "Contracts are out for signature. Once signed and funded, mark it funded.", tone: "lime" };
    case "funded": return { text: "Funded. Enter the funded amount and your commission, then mark commission paid when Torro pays you.", tone: "blue" };
    case "commission_paid": return { text: "Paid in full. This one's done.", tone: "yellow" };
    case "declined": return { text: "Torro declined. Note the reason, then send them to Credit Repair to get approval-ready, or revisit later.", tone: "pink" };
    case "credit_repair": return { text: "Sent to credit repair to get approval ready. Follow up once their credit improves.", tone: "fuchsia" };
    case "dead": return { text: "Closed out. Revive if they come back.", tone: "rose" };
    default: return { text: "", tone: "slate" };
  }
}
function relativeDue(ts) {
  if (ts == null) return null;
  const diff = ts - Date.now();
  const days = Math.round(diff / DAY);
  if (diff <= 0) {
    const overdue = Math.max(1, Math.round(-diff / DAY));
    return { label: days >= 0 ? "Due today" : `${overdue}d overdue`, overdue: true };
  }
  if (days === 0) return { label: "Due today", overdue: true };
  if (days === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `Due in ${days}d`, overdue: false };
}

// Build the cadence step list for a lead's current stage
function cadenceSteps(lead, cadences, templates) {
  const steps = cadences[lead.status] || [];
  const entered = lead.stageEnteredAt || lead.createdAt;
  return steps.map((s, i) => {
    const tpl = s.pool
      ? pickFrom(poolTemplates(templates, s.pool), lead.id + ":" + s.pool + ":" + i)
      : templates.find((t) => t.id === s.templateId);
    const dueAt = entered + s.day * DAY;
    const done = (lead.touches || []).some(
      (t) => t.kind === "cadence" && t.stage === lead.status && t.step === i && t.at >= entered - 5000
    );
    return { i, day: s.day, template: tpl, channel: tpl?.channel, dueAt, done };
  });
}
function nextDue(lead, cadences, templates) {
  const steps = cadenceSteps(lead, cadences, templates).filter((s) => !s.done && s.template);
  if (steps.length === 0) return null;
  return steps.sort((a, b) => a.dueAt - b.dueAt)[0];
}

// Send through the in-app backend (RingCentral / Outlook). Requires login.
async function apiSend(path, payload) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  let j = {};
  try { j = await res.json(); } catch { /* ignore */ }
  if (!res.ok || j.error) throw new Error(j.error || `Send failed (${res.status})`);
  return j;
}
async function sendMessage(channel, to, subject, body) {
  if (!to) throw new Error(channel === "sms" ? "No phone number on file" : "No email on file");
  if (channel === "sms") return apiSend("send-sms", { to, text: body });
  return apiSend("send-email", { to, subject, text: body });
}

/* ================================================================== */
/*  Atoms                                                             */
/* ================================================================== */
function CopyButton({ text, label = "Copy", className = "" }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => {
      try { await navigator.clipboard.writeText(text); }
      catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
      setDone(true); setTimeout(() => setDone(false), 1400);
    }} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${className}`}>
      {done ? <Check size={15} /> : <Copy size={15} />}{done ? "Copied" : label}
    </button>
  );
}
function StagePill({ status }) {
  const s = STAGES.find((x) => x.key === status) || STAGES[0];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[s.tone]}`}>{s.label}</span>;
}
function QualChips({ lead, size = "sm" }) {
  const items = [["Wants", lead.desiredAmount], ["Rev/mo", lead.monthlyRevenue], ["Score", lead.creditScore], ["In biz", lead.timeInBusiness]].filter(([, v]) => v);
  if (items.length === 0) return null;
  const pad = size === "lg" ? "px-2 py-1" : "px-1.5 py-0.5";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([k, v]) => (
        <span key={k} className={`inline-flex items-center gap-1 rounded-md bg-blue-50 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-100 ${pad}`}>
          <span className="text-blue-500">{k}</span><span className="font-semibold">{v}</span>
        </span>
      ))}
    </div>
  );
}
function Labeled({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/* ================================================================== */
/*  Main                                                              */
/* ================================================================== */
/* ================================================================== */
/*  Auth gate                                                         */
/* ================================================================== */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="flex min-h-96 items-center justify-center font-sans text-slate-400">Loading...</div>;
  if (!session) return <Login />;
  return <Dashboard userEmail={session.user?.email || ""} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  return (
    <div className="mx-auto mt-16 max-w-sm font-sans">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Lock size={18} /></div>
          <div>
            <div className="text-base font-bold tracking-tight text-slate-800">ASAP Funding Pipeline</div>
            <div className="text-xs text-slate-400">Sign in to continue</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Labeled label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="email" autoComplete="username" className={inputCls} /></Labeled>
          <Labeled label="Password"><input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" autoComplete="current-password" className={inputCls} /></Labeled>
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{err}</div>}
          <button onClick={submit} disabled={busy || !email || !pw} className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Accounts are created by your admin in Supabase.</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Dashboard                                                         */
/* ================================================================== */
function Dashboard({ userEmail }) {
  const [tab, setTab] = useState("pipeline");
  const [leads, setLeads] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [cadences, setCadences] = useState(DEFAULT_CADENCES);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [profileId, setProfileId] = useState(null);
  const [compose, setCompose] = useState(null);
  const [live, setLive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const refetchLeads = useCallback(async () => {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setLeads(data.map(rowToLead));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const keys = ["config", "templates", "cadences"];
        const { data } = await supabase.from("app_config").select("key,value").in("key", keys);
        const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
        if (map.config) setConfig({ ...DEFAULT_CONFIG, ...map.config });
        else await supabase.from("app_config").upsert({ key: "config", value: DEFAULT_CONFIG });
        if (map.templates) setTemplates(map.templates);
        else await supabase.from("app_config").upsert({ key: "templates", value: DEFAULT_TEMPLATES });
        if (map.cadences) setCadences(map.cadences);
        else await supabase.from("app_config").upsert({ key: "cadences", value: DEFAULT_CADENCES });
        await refetchLeads();
      } catch (e) { setErr(String(e.message || e)); }
      finally { setLoaded(true); }
    })();
    const channel = supabase.channel("leads-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => refetchLeads())
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [refetchLeads]);

  const saveConfigKey = useCallback(async (key, value) => {
    await supabase.from("app_config").upsert({ key, value });
  }, []);
  const persistConfig = useCallback(async (next) => { setConfig(next); await saveConfigKey("config", next); }, [saveConfigKey]);
  const persistTemplates = useCallback(async (next) => { setTemplates(next); await saveConfigKey("templates", next); }, [saveConfigKey]);
  const persistCadences = useCallback(async (next) => { setCadences(next); await saveConfigKey("cadences", next); }, [saveConfigKey]);

  const updateLead = useCallback(async (id, patch) => {
    let finalPatch = patch;
    setLeads((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const p = { ...patch };
      // Only reset the cadence clock when the stage genuinely changes.
      if ("status" in patch && patch.status !== l.status) {
        p.stageEnteredAt = Date.now();
        p.lastTouchAt = Date.now();
      }
      finalPatch = p;
      return { ...l, ...p };
    }));
    const row = leadPatchToRow(finalPatch);
    if (Object.keys(row).length) {
      const { error } = await supabase.from("leads").update(row).eq("id", id);
      if (error) setErr(error.message);
    }
  }, []);

  const logTouch = useCallback(async (id, channel, kind, extra = {}) => {
    const now = Date.now();
    let computed;
    setLeads((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const touches = [...(l.touches || []), { at: now, channel, kind, ...extra }];
      const patch = { touches, lastTouchAt: now };
      if (kind === "link" && !l.linkSentAt) {
        patch.linkSentAt = now;
        if (l.status === "new" || l.status === "called") { patch.status = "link_sent"; patch.stageEnteredAt = now; }
      }
      computed = patch;
      return { ...l, ...patch };
    }));
    if (computed) {
      const { error } = await supabase.from("leads").update(leadPatchToRow(computed)).eq("id", id);
      if (error) setErr(error.message);
    }
  }, []);

  const addLead = useCallback(async (data) => {
    const row = { name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim(), notes: data.notes.trim(), status: "new", touches: [] };
    const { data: ins, error } = await supabase.from("leads").insert(row).select().single();
    if (error) { setErr(error.message); return; }
    setLeads((prev) => [rowToLead(ins), ...prev]);
  }, []);

  const removeLead = useCallback(async (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setProfileId((p) => (p === id ? null : p));
    await supabase.from("leads").delete().eq("id", id);
  }, []);

  const handleSent = useCallback(() => {
    setCompose((c) => {
      if (c) {
        logTouch(c.lead.id, c.channel, c.kind, c.extra || {});
        if (c.afterSent) c.afterSent();
      }
      return null;
    });
  }, [logTouch]);

  const dueList = useMemo(() => (
    leads.map((l) => ({ l, step: nextDue(l, cadences, templates) }))
      .filter((x) => x.step && x.step.dueAt <= Date.now() + DAY)
      .sort((a, b) => a.step.dueAt - b.step.dueAt)
  ), [leads, cadences, templates]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter((l) => {
      if (filter === "active" && ["funded", "commission_paid", "dead", "credit_repair", "not_interested"].includes(l.status)) return false;
      if (filter !== "active" && filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (l.name + l.phone + l.email + l.notes + l.source + l.businessName + l.opportunityName + l.desiredAmount + l.monthlyRevenue + l.creditScore + l.timeInBusiness + l.tags).toLowerCase().includes(q);
    }).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  }, [leads, query, filter]);

  const stats = useMemo(() => {
    const by = {}; STAGES.forEach((s) => (by[s.key] = 0));
    leads.forEach((l) => (by[l.status] = (by[l.status] || 0) + 1));
    return by;
  }, [leads]);

  const profileLead = leads.find((l) => l.id === profileId) || null;

  if (!loaded) return <div className="flex min-h-96 items-center justify-center font-sans text-slate-400">Loading your pipeline...</div>;

  const NAV = [["pipeline", "Pipeline", LayoutGrid], ["commissions", "Commissions", DollarSign], ["messaging", "Messaging", MessageSquare], ["scripts", "Scripts", FileText], ["settings", "Settings", SettingsIcon]];
  const tabTitle = { pipeline: "Pipeline", commissions: "Commissions", messaging: "Messaging", scripts: "Call scripts", settings: "Settings" }[tab];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* sidebar */}
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col bg-blue-950 text-blue-100 md:w-60">
        <div className="flex items-center gap-2.5 px-3 py-4 md:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white"><Zap size={20} strokeWidth={2.5} /></div>
          <div className="hidden md:block">
            <div className="text-sm font-bold leading-tight tracking-tight text-white">ASAP Funding</div>
            <div className="text-[11px] text-blue-300">Pipeline CRM</div>
          </div>
        </div>

        <div className="px-2 md:px-3">
          <button onClick={() => { setTab("pipeline"); setShowAdd(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 md:justify-start">
            <Plus size={18} /> <span className="hidden md:inline">Add client</span>
          </button>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2 md:px-3">
          {NAV.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} title={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${tab === k ? "bg-blue-800 text-white" : "text-blue-200 hover:bg-blue-900 hover:text-white"}`}>
              <Icon size={18} className="shrink-0" /> <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-blue-900 px-2 py-3 md:px-3">
          {live && <div className="mb-2 hidden items-center gap-1.5 px-2 text-[11px] text-blue-300 md:flex"><Wifi size={12} /> Live, leads sync automatically</div>}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="hidden min-w-0 md:block">
              <div className="truncate text-xs text-blue-300">{userEmail}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} title="Sign out" className="rounded-md p-2 text-blue-300 hover:bg-blue-900 hover:text-white"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-800">{tabTitle}</h1>
            {tab === "pipeline" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{leads.length}</span>}
          </div>
          <button onClick={() => { setTab("pipeline"); setShowAdd(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} /> <span className="hidden sm:inline">Add client</span></button>
        </header>

        <div className="px-5 pb-10">
          {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"><AlertCircle size={16} /> {err}</div>}

          {tab === "pipeline" && (
            <Pipeline leads={filtered} allLeads={leads} allCount={leads.length} dueList={dueList} stats={stats} config={config}
              query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} showAdd={showAdd} setShowAdd={setShowAdd}
              addLead={addLead} onOpen={setProfileId} logTouch={logTouch} updateLead={updateLead} cadences={cadences} templates={templates} openCompose={setCompose} />
          )}
          {tab === "messaging" && <Messaging templates={templates} persistTemplates={persistTemplates} cadences={cadences} persistCadences={persistCadences} />}
          {tab === "commissions" && <Commissions leads={leads} onOpen={setProfileId} />}
          {tab === "scripts" && <Scripts />}
          {tab === "settings" && <Settings config={config} persistConfig={persistConfig} />}
        </div>
      </main>

      {profileLead && (
        <Profile lead={profileLead} config={config} templates={templates} cadences={cadences} userEmail={userEmail}
          onClose={() => setProfileId(null)} updateLead={updateLead} removeLead={removeLead} logTouch={logTouch} openCompose={setCompose} />
      )}

      {compose && <ComposeModal compose={compose} onClose={() => setCompose(null)} onSent={handleSent} />}
    </div>
  );
}

/* ================================================================== */
/*  Pipeline                                                          */
/* ================================================================== */
const BOARDS = {
  outreach: { label: "Outreach", stages: ["new", "voicemail", "interested", "callback", "not_interested"] },
  funding: { label: "Funding", stages: ["report_pulled", "submitted", "pre_approved", "contracts_out", "funded", "commission_paid"] },
  closed: { label: "Closed", stages: ["declined", "credit_repair", "dead"] },
};

function Pipeline({ leads, allLeads, allCount, dueList, stats, config, query, setQuery, filter, setFilter, showAdd, setShowAdd, addLead, onOpen, logTouch, updateLead, cadences, templates, openCompose }) {
  const [view, setView] = useState("board");
  const [boardTab, setBoardTab] = useState("outreach");
  const [dragId, setDragId] = useState(null);
  const sendStep = (lead, step) => {
    const tpl = step.template;
    if (!tpl) return;
    openCompose({ lead, channel: tpl.channel, to: tpl.channel === "sms" ? lead.phone : lead.email, subject: fillTokens(tpl.subject, lead, config), body: fillTokens(tpl.body, lead, config), kind: "cadence", extra: { stage: lead.status, step: step.i } });
  };

  const q = query.toLowerCase();
  const boardLeads = (allLeads || leads).filter((l) => !q || (l.name + l.phone + l.email + l.businessName + l.opportunityName + l.source + l.tags).toLowerCase().includes(q));
  const colLeads = (key) => boardLeads.filter((l) => l.status === key).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  const onDrop = (key) => { if (dragId) { updateLead(dragId, { status: key }); setDragId(null); } };

  return (
    <div className="mt-4">
      {dueList.length > 0 && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-orange-800"><Clock size={15} /> Follow up now ({dueList.length})</div>
          <div className="flex flex-col gap-2">
            {dueList.map(({ l, step }) => {
              const rel = relativeDue(step.dueAt);
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-orange-100">
                  <button onClick={() => onOpen(l.id)} className="font-semibold hover:text-blue-700">{l.name || "Unnamed"}</button>
                  <StagePill status={l.status} />
                  <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-600"}`}>{rel.label}</span>
                  <span className="text-xs text-slate-400">{step.template?.name}</span>
                  <div className="ml-auto">
                    <button onClick={() => sendStep(l, step)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${step.channel === "sms" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50"}`}>
                      {step.channel === "sms" ? <MessageSquare size={14} /> : <Mail size={14} />} Send
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* view toggle */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button onClick={() => setView("board")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "board" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Board</button>
          <button onClick={() => setView("list")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>List</button>
        </div>
        <div className="relative min-w-44 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, business" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
        {view === "list" && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="active">Active</option>
            <option value="new">New</option>
            <option value="voicemail">Left Voicemail</option>
            <option value="interested">Interested</option>
            <option value="callback">Call Back</option>
            <option value="report_pulled">Report Pulled</option>
            <option value="all">All</option>
          </select>
        )}
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Add prospect</button>
      </div>

      {showAdd && <AddForm onAdd={(d) => { addLead(d); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

      {view === "board" ? (
        <>
          {/* board switcher */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.entries(BOARDS).map(([k, b]) => {
              const count = b.stages.reduce((s, key) => s + (stats[key] || 0), 0);
              return (
                <button key={k} onClick={() => setBoardTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${boardTab === k ? "bg-blue-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                  {b.label} <span className={`rounded-full px-1.5 text-xs ${boardTab === k ? "bg-blue-700" : "bg-slate-100"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {allCount === 0 ? <Empty onAdd={() => setShowAdd(true)} /> : (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {BOARDS[boardTab].stages.map((key) => {
                const stage = STAGES.find((s) => s.key === key);
                const items = colLeads(key);
                return (
                  <div key={key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(key)}
                    className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 p-2">
                    <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[stage.tone]}`}>{stage.label}</span>
                      <span className="text-xs font-bold text-slate-400">{items.length}</span>
                    </div>
                    <div className="flex min-h-12 flex-col gap-2">
                      {items.map((l) => (
                        <BoardCard key={l.id} lead={l} onOpen={() => onOpen(l.id)} cadences={cadences} templates={templates} config={config} openCompose={openCompose} updateLead={updateLead}
                          onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)} dragging={dragId === l.id} />
                      ))}
                      {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-300">Drop here</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 px-1 text-xs text-slate-400">Drag a card to a new column to move that lead. Click a card to open the full profile.</p>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STAGES.map((s) => <span key={s.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE[s.tone]}`}>{s.label} <span className="font-bold">{stats[s.key] || 0}</span></span>)}
          </div>
          {allCount === 0 ? <Empty onAdd={() => setShowAdd(true)} />
            : leads.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No prospects match this view.</div>
            : <div className="flex flex-col gap-2">{leads.map((l) => <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l.id)} cadences={cadences} templates={templates} config={config} logTouch={logTouch} updateLead={updateLead} openCompose={openCompose} />)}</div>}
        </>
      )}
    </div>
  );
}

function BoardCard({ lead, onOpen, cadences, templates, config, openCompose, updateLead, onDragStart, onDragEnd, dragging }) {
  const step = nextDue(lead, cadences, templates);
  const rel = step ? relativeDue(step.dueAt) : null;
  const tplSms = pickFrom(poolTemplates(templates, "int_sms"), lead.id) || templates.find((t) => t.id === "first_sms");
  const tplEmail = pickFrom(poolTemplates(templates, "int_email"), lead.id) || templates.find((t) => t.id === "first_email");
  const stop = (e) => e.stopPropagation();
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className={`cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-blue-300 hover:shadow ${dragging ? "opacity-40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{lead.name || "Unnamed"}</div>
          {lead.businessName && <div className="truncate text-xs text-slate-400">{lead.businessName}</div>}
        </div>
        {rel && <span className={`shrink-0 text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
      </div>
      {(lead.desiredAmount || lead.commissionAmount) && (
        <div className="mt-1 text-xs text-slate-500">
          {lead.commissionAmount ? <span className="font-semibold text-blue-700">{money(lead.commissionAmount)} comm</span> : lead.desiredAmount ? <span>Wants {lead.desiredAmount}</span> : null}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1" onClick={stop}>
        <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} title="Call" className={`rounded-md p-1.5 ${lead.phone ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "pointer-events-none bg-slate-50 text-slate-300"}`}><Phone size={13} /></a>
        <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens(tplSms?.body || "{{link}}", lead, config), kind: "link" })} title="Text" className={`rounded-md p-1.5 ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-50 text-slate-300"}`}><MessageSquare size={13} /></button>
        <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens(tplEmail?.subject || "", lead, config), body: fillTokens(tplEmail?.body || "{{link}}", lead, config), kind: "link" })} title="Email" className={`rounded-md p-1.5 ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-50 text-slate-300"}`}><Mail size={13} /></button>
      </div>
      <div className="mt-2" onClick={stop}>
        <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Move to</label>
        <select value={lead.status} onChange={(e) => { e.stopPropagation(); updateLead(lead.id, { status: e.target.value }); }}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-400">
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function Empty({ onAdd }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
      <User size={28} className="mx-auto text-slate-300" />
      <div className="mt-2 text-sm font-medium text-slate-600">No prospects yet</div>
      <div className="mt-1 text-sm text-slate-400">Add one by hand, or they will arrive automatically from GoHighLevel.</div>
      <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Add prospect</button>
    </div>
  );
}
function AddForm({ onAdd, onCancel }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const canSave = f.name.trim() && (f.phone.trim() || f.email.trim());
  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input autoFocus value={f.name} onChange={set("name")} placeholder="Name" className={inputCls} />
        <input value={f.phone} onChange={set("phone")} placeholder="Phone" className={inputCls} />
        <input value={f.email} onChange={set("email")} placeholder="Email" className={inputCls} />
        <input value={f.notes} onChange={set("notes")} placeholder="Notes" className={inputCls} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <button disabled={!canSave} onClick={() => onAdd(f)} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}

function LeadRow({ lead, onOpen, cadences, templates, config, logTouch, updateLead, openCompose }) {
  const step = nextDue(lead, cadences, templates);
  const rel = step ? relativeDue(step.dueAt) : null;
  const tplSms = pickFrom(poolTemplates(templates, "int_sms"), lead.id) || templates.find((t) => t.id === "first_sms");
  const tplEmail = pickFrom(poolTemplates(templates, "int_email"), lead.id) || templates.find((t) => t.id === "first_email");
  const stop = (e) => e.stopPropagation();
  return (
    <div onClick={onOpen} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{lead.name || "Unnamed"}</span>
            <StagePill status={lead.status} />
            {rel && <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-slate-500">
            {lead.phone && <span>{lead.phone}</span>}
            {lead.email && <span className="truncate">{lead.email}</span>}
            {lead.businessName && <span className="not-italic text-slate-400">{lead.businessName}</span>}
          </div>
          <div className="mt-1.5"><QualChips lead={lead} /></div>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={stop}>
          <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} title="Call" className={`rounded-lg p-2 ${lead.phone ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "pointer-events-none bg-slate-50 text-slate-300"}`}><Phone size={15} /></a>
          <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens(tplSms?.body || "{{link}}", lead, config), kind: "link" })} title="Text link" className={`rounded-lg p-2 ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-50 text-slate-300"}`}><MessageSquare size={15} /></button>
          <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens(tplEmail?.subject || "", lead, config), body: fillTokens(tplEmail?.body || "{{link}}", lead, config), kind: "link" })} title="Email link" className={`rounded-lg p-2 ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-50 text-slate-300"}`}><Mail size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Compose modal (copy-paste now, one-click send once configured)    */
/* ================================================================== */
function ComposeModal({ compose, onClose, onSent }) {
  const { lead, channel, to, subject: subj0, body: body0 } = compose;
  const [subject, setSubject] = useState(subj0 || "");
  const [body, setBody] = useState(body0 || "");
  const [busy, setBusy] = useState(false);
  const sendViaApp = async () => {
    setBusy(true);
    try { await sendMessage(channel, to, subject, body); onSent(); }
    catch (e) { alert("Could not send via app: " + e.message + "\n\nYou can still copy the message and send it manually."); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2 font-bold">
            {channel === "sms" ? <MessageSquare size={16} className="text-blue-600" /> : <Mail size={16} className="text-blue-600" />}
            {channel === "sms" ? "Text" : "Email"} {lead.name || ""}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="text-xs text-slate-500">To: <span className="font-mono text-slate-700">{to || "(missing)"}</span></div>
          {channel === "email" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subject</label>
                <CopyButton text={subject} className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
              </div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message</label>
              <CopyButton text={body} label="Copy message" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={channel === "email" ? 9 : 4} className={inputCls} />
          </div>
          <p className="text-xs text-slate-400">Copy this into {channel === "sms" ? "RingCentral" : "Outlook"} and send it, then mark it sent so the stage and follow-ups update. Once your keys are set, use Send via app to do it in one click.</p>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button onClick={sendViaApp} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50 disabled:opacity-40"><Send size={15} /> {busy ? "Sending..." : "Send via app"}</button>
            <button onClick={onSent} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Check size={15} /> Mark as sent</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Profile (client detail)                                           */
/* ================================================================== */
function Profile({ lead, config, templates, cadences, onClose, updateLead, removeLead, logTouch, openCompose, userEmail }) {
  const EDITABLE = ["name", "phone", "email", "notes", "desiredAmount", "fundingPurpose", "fundingTimeline", "monthlyRevenue", "creditScore", "timeInBusiness",
    "businessName", "businessType", "einStatus", "bestTime", "nextStep", "myscoreiqUsername", "myscoreiqPassword", "ssnLast4", "fundedAmount", "commissionAmount", "declineReason"];
  const [draft, setDraft] = useState(lead);
  const [savedAt, setSavedAt] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [guideOpen, setGuideOpen] = useState(lead.status === "new");
  const [rawOpen, setRawOpen] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [spoke, setSpoke] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  useEffect(() => { setDraft(lead); setGuideOpen(lead.status === "new"); setSpoke(false); setDeclineOpen(false); }, [lead.id]); // reload when switching leads
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  // Autosave: persist changed fields shortly after you stop typing
  useEffect(() => {
    const patch = {};
    EDITABLE.forEach((k) => { if (draft[k] !== lead[k]) patch[k] = draft[k]; });
    if (Object.keys(patch).length === 0) return;
    const t = setTimeout(() => { updateLead(lead.id, patch); setSavedAt(Date.now()); setTimeout(() => setSavedAt(0), 1500); }, 700);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line

  const uploadReport = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `${lead.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });
      if (error) throw error;
      await updateLead(lead.id, { reportPath: path, reportUploadedAt: Date.now(), status: lead.status === "submitted" || lead.status === "funded" ? lead.status : "report_pulled" });
    } catch (e) { alert("Upload failed: " + (e.message || e)); }
    finally { setUploading(false); }
  };

  const logOutcome = (stage, label) => {
    logTouch(lead.id, "call", "call", { disposition: label, note: callNote.trim(), by: userEmail });
    setCallNote(""); setSpoke(false);
    updateLead(lead.id, { status: stage });
  };

  const submitToFunder = async () => {
    let link = "";
    if (lead.reportPath) {
      const { data } = await supabase.storage.from("reports").createSignedUrl(lead.reportPath, 604800); // 7 days
      if (data?.signedUrl) link = data.signedUrl;
    }
    const body = `Client: ${lead.name}\n${lead.businessName ? "Business: " + lead.businessName + "\n" : ""}${link ? "\nReport (PDF, link valid 7 days):\n" + link + "\n" : "\n(Attach the report PDF.)\n"}`;
    openCompose({ lead, channel: "email", to: config.funderEmail, subject: lead.name, body, kind: "submit", afterSent: () => { if (lead.status !== "funded" && lead.status !== "dead") updateLead(lead.id, { status: "submitted" }); } });
  };
  const viewReport = async () => {
    if (!lead.reportPath) return;
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(lead.reportPath, 3600);
    if (error) { alert("Could not open report: " + error.message); return; }
    setReportUrl(data.signedUrl); window.open(data.signedUrl, "_blank");
  };

  const steps = cadenceSteps(lead, cadences, templates);

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-6" onClick={onClose}>
      <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* head */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="truncate text-lg font-bold">{lead.name || "Unnamed"}</span><StagePill status={lead.status} /></div>
            <div className="mt-0.5"><QualChips lead={lead} /></div>
          </div>
          <div className="flex items-center gap-2">
            {savedAt > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Check size={13} /> Saved</span>}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* what to do next */}
          {nextStepFor(lead).text && (
            <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${TONE[nextStepFor(lead).tone]}`}>
              <span className="mt-0.5 shrink-0 text-xs font-bold uppercase tracking-wide opacity-70">Next</span>
              <span>{nextStepFor(lead).text}</span>
            </div>
          )}
          {/* contact actions */}
          <div className="flex flex-wrap gap-2">
            <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-slate-800 text-white hover:bg-slate-900" : "pointer-events-none bg-slate-100 text-slate-300"}`}><Phone size={15} /> Call</a>
            <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens(templates.find(t=>t.id==="first_sms")?.body || "{{link}}", lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300"}`}><MessageSquare size={15} /> Text link</button>
            <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens(templates.find(t=>t.id==="first_email")?.subject||"", lead, config), body: fillTokens(templates.find(t=>t.id==="first_email")?.body||"{{link}}", lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={15} /> Email link</button>
            <CopyButton text={config.reportLink || ""} label="Copy link" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
          </div>

          {/* what happened on this call */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Phone size={15} className="text-blue-600" /> What happened on this call?</div>
            <textarea value={callNote} onChange={(e) => setCallNote(e.target.value)} rows={2} placeholder="Notes from the call (optional)" className={`${inputCls} mb-2`} />
            {!spoke ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => logOutcome("voicemail", "Left voicemail")} className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-200">No answer / left voicemail</button>
                <button onClick={() => setSpoke(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Spoke to them</button>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">How did it go?</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => logOutcome("interested", "Spoke, interested")} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">Interested</button>
                  <button onClick={() => logOutcome("callback", "Spoke, call back")} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">Call back later</button>
                  <button onClick={() => logOutcome("not_interested", "Spoke, not interested")} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">Not interested</button>
                  <button onClick={() => setSpoke(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Back</button>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Picking an outcome sets the stage and starts that campaign. Logs your note, who called, and the time.</p>
          </div>

          {/* call guide */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40">
            <button onClick={() => setGuideOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="flex items-center gap-1.5 text-sm font-bold text-blue-900"><FileText size={15} /> Call guide</span>
              <ChevronDown size={16} className={`text-blue-700 transition ${guideOpen ? "rotate-180" : ""}`} />
            </button>
            {guideOpen && (
              <div className="space-y-4 border-t border-blue-100 px-4 py-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Opener</div>
                  <p className="mt-1 text-sm text-slate-700">
                    Hi {firstName(draft.name)}, this is {config.signature}. {[
                      draft.desiredAmount && `from what you sent over I see you're looking for ${draft.desiredAmount}`,
                      draft.fundingPurpose && `to put toward ${draft.fundingPurpose}`,
                      draft.businessName && `for ${draft.businessName}`,
                      draft.fundingTimeline && `and you need it ${draft.fundingTimeline}`,
                    ].filter(Boolean).join(", ")}
                    {(draft.desiredAmount || draft.fundingPurpose || draft.businessName || draft.fundingTimeline) ? ". " : ""}
                    My job is to get you funding as fast as possible and, just as important, the best options for your situation, not just the quickest yes. Let me confirm a couple of things.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    { ask: "What are you looking to get funding for?", say: (v) => `You want it for ${v}. Still the plan?`, k: "fundingPurpose", ph: "Purpose / use of funds" },
                    { ask: "What is the business name?", say: (v) => `Business: ${v}.`, k: "businessName", ph: "Business name" },
                    { ask: "Ballpark, where is your personal credit right now?", say: (v) => `You estimated credit around ${v}.`, k: "creditScore", ph: "Credit score range" },
                    { ask: "How much are you looking to get?", say: (v) => `You're after ${v}. Is that still the goal?`, k: "desiredAmount", ph: "Amount" },
                    { ask: "How soon do you need it?", say: (v) => `Timeline: ${v}.`, k: "fundingTimeline", ph: "How soon" },
                  ].map(({ ask, say, k, ph }) => {
                    const have = !!(draft[k] && String(draft[k]).trim());
                    return (
                      <div key={k}>
                        <div className={`flex items-start gap-1.5 text-sm font-medium ${have ? "text-blue-700" : "text-slate-700"}`}>
                          {have && <Check size={15} className="mt-0.5 shrink-0" />}
                          <span>{have ? say(draft[k]) : ask}</span>
                        </div>
                        <input value={draft[k]} onChange={set(k)} placeholder={ph} className={`${inputCls} mt-1 ${have ? "border-blue-200 bg-blue-50/40" : ""}`} />
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">The soft pull (lead into the link)</div>
                  <p className="mt-1 text-sm text-slate-700">To see exactly what we can do for you, the next step is a quick soft pull through My Score IQ. That shows us where your FICO scores sit across all three bureaus. It takes about 5 minutes, it does not hurt your score, and it lets me match you to the funders you actually qualify for instead of guessing. I will text and email you the secure link right now while we are on the phone. Use the Text link or Email link buttons above.</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Why us over a bank</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>Banks decline most small businesses and can take weeks to months. We move as fast as your file allows and often fund quickly.</li>
                    <li>We are not stuck inside one bank's box. We shop your profile across a network of funders to land the best offer, not just the first yes.</li>
                    <li>One review with us, not ten separate bank applications that each add a hard inquiry to your report.</li>
                    <li>We look at your revenue and the whole picture, not just a single credit score cutoff.</li>
                    <li>The goal is the best amount and terms for your situation, then getting it funded as fast as possible.</li>
                  </ul>
                </div>
                <p className="text-xs text-slate-400">Answers save automatically as you type.</p>
              </div>
            )}
          </div>

          {/* stage */}
          <Section icon={<ListChecks size={15} />} title="Stage">
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s.key} onClick={() => updateLead(lead.id, { status: s.key })} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${lead.status === s.key ? TONE[s.tone] + " ring-2" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"}`}>{s.label}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">Moving stage stops this stage's follow-ups and starts the next stage's sequence.</p>
          </Section>

          {/* cadence for current stage */}
          <Section icon={<CalendarClock size={15} />} title={`Follow-ups for "${STAGES.find(s=>s.key===lead.status)?.label}"`}>
            {steps.length === 0 ? <p className="text-sm text-slate-400">No automated steps for this stage. Add them under Messaging.</p> : (
              <div className="flex flex-col gap-1.5">
                {steps.map((st) => {
                  const rel = relativeDue(st.dueAt);
                  return (
                    <div key={st.i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">D{st.day}</span>
                      {st.channel === "sms" ? <MessageSquare size={14} className="text-blue-600" /> : <Mail size={14} className="text-blue-600" />}
                      <span className="min-w-0 flex-1 truncate">{st.template?.name || "deleted template"}</span>
                      {st.done ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Check size={13} /> Sent</span>
                        : <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-slate-400"}`}>{rel.label}</span>}
                      {st.template && (
                        <button onClick={() => openCompose({ lead, channel: st.channel, to: st.channel === "sms" ? lead.phone : lead.email, subject: fillTokens(st.template.subject, lead, config), body: fillTokens(st.template.body, lead, config), kind: "cadence", extra: { stage: lead.status, step: st.i } })} className={`rounded-md px-2 py-1 text-xs font-semibold ${st.done ? "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>{st.done ? "Resend" : "Send"}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* qualification + business (editable) */}
          <Section icon={<Building2 size={15} />} title="Qualification & business">
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Desired amount"><input value={draft.desiredAmount} onChange={set("desiredAmount")} className={inputCls} /></Labeled>
              <Labeled label="Monthly revenue"><input value={draft.monthlyRevenue} onChange={set("monthlyRevenue")} className={inputCls} /></Labeled>
              <Labeled label="Estimated credit score"><input value={draft.creditScore} onChange={set("creditScore")} className={inputCls} /></Labeled>
              <Labeled label="Time in business"><input value={draft.timeInBusiness} onChange={set("timeInBusiness")} className={inputCls} /></Labeled>
              <Labeled label="Business name"><input value={draft.businessName} onChange={set("businessName")} className={inputCls} /></Labeled>
              <Labeled label="Business type / industry"><input value={draft.businessType} onChange={set("businessType")} className={inputCls} /></Labeled>
              <Labeled label="EIN / entity status"><input value={draft.einStatus} onChange={set("einStatus")} placeholder="Has EIN, sole prop, etc." className={inputCls} /></Labeled>
              <Labeled label="Best time to call"><input value={draft.bestTime} onChange={set("bestTime")} className={inputCls} /></Labeled>
            </div>
          </Section>

          {/* contact details editable */}
          <Section icon={<User size={15} />} title="Contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Name"><input value={draft.name} onChange={set("name")} className={inputCls} /></Labeled>
              <Labeled label="Phone"><input value={draft.phone} onChange={set("phone")} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Email"><input value={draft.email} onChange={set("email")} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Next step"><input value={draft.nextStep} onChange={set("nextStep")} className={inputCls} /></Labeled>
            </div>
            <div className="mt-3"><Labeled label="Call notes"><textarea value={draft.notes} onChange={set("notes")} rows={3} className={inputCls} /></Labeled></div>
          </Section>

          {/* MyScoreIQ credentials (sensitive) */}
          <Section icon={<KeyRound size={15} className="text-amber-500" />} title="MyScoreIQ access">
            <div className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
              <AlertCircle size={13} /> Sensitive. Stored as entered. Add a login to this app before saving real credentials.
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Labeled label="Username"><input value={draft.myscoreiqUsername} onChange={set("myscoreiqUsername")} name="msq_user" autoComplete="off" data-lpignore="true" data-1p-ignore className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Password">
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={draft.myscoreiqPassword} onChange={set("myscoreiqPassword")} name="msq_pass" autoComplete="new-password" data-lpignore="true" data-1p-ignore className={`${inputCls} pr-9 font-mono`} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </Labeled>
              <Labeled label="Last 4 of SSN"><input value={draft.ssnLast4} onChange={set("ssnLast4")} maxLength={4} inputMode="numeric" name="msq_s4" autoComplete="off" data-lpignore="true" data-1p-ignore className={`${inputCls} font-mono`} /></Labeled>
            </div>
          </Section>

          {/* report PDF */}
          <Section icon={<FileText size={15} />} title="Credit report">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
                <Upload size={15} /> {uploading ? "Uploading..." : lead.reportPath ? "Replace PDF" : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadReport(e.target.files?.[0])} />
              </label>
              {lead.reportPath && <button onClick={viewReport} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50"><ExternalLink size={15} /> View report</button>}
              {lead.reportUploadedAt && <span className="text-xs text-slate-400">Uploaded {fmtDate(lead.reportUploadedAt)}</span>}
            </div>
          </Section>

          {/* application (after pre-approval, if they want more) */}
          <Section icon={<FileText size={15} />} title="Application (for more funding)">
            {lead.status === "pre_approved" && (
              <div className="mb-2 rounded-md bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-200">
                Pre-approved. If the client wants more than Torro offered, send the full application so they can sign and upload bank statements.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens((templates.find(t=>t.id==="app_sms")?.body) || APP_SMS_DEFAULT, lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300"}`}><MessageSquare size={15} /> Text application</button>
              <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens((templates.find(t=>t.id==="app_email")?.subject) || APP_EMAIL_SUBJECT_DEFAULT, lead, config), body: fillTokens((templates.find(t=>t.id==="app_email")?.body) || APP_EMAIL_DEFAULT, lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={15} /> Email application</button>
              <CopyButton text={config.appLink || APP_LINK_DEFAULT} label="Copy app link" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
            </div>
            <p className="mt-2 text-xs text-slate-400">Send this only after the pre-approval, if the client wants more funding. The client signs and uploads their bank statements, voided check, license, and report in the form.</p>
          </Section>

          {/* submit to funder */}
          <Section icon={<Send size={15} />} title={`Submit to ${config.funderName || "funder"}`}>
            <button onClick={submitToFunder} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Send size={15} /> Email report to {config.funderName || "funder"}</button>
            <p className="mt-2 text-xs text-slate-500">Opens an email to {config.funderEmail} with the subject set to the client's name. If you uploaded the report, a 7 day download link is included; otherwise attach the PDF yourself.</p>
            <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
              Just send Torro the report to start. They send back a pre-approval. The full application only goes out later if the client wants more funding.
            </div>
          </Section>

          {/* outcome from Torro (after submitted) */}
          {["submitted", "pre_approved", "contracts_out", "funded", "commission_paid", "declined"].includes(lead.status) && (
            <Section icon={<ListChecks size={15} />} title="Outcome from Torro">
              {lead.status === "submitted" && (
                !declineOpen ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => updateLead(lead.id, { status: "pre_approved" })} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Approved</button>
                    <button onClick={() => setDeclineOpen(true)} className="rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-700">Declined</button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-slate-500">Why was it declined?</div>
                    <select value={draft.declineReason} onChange={set("declineReason")} className={`${inputCls} mb-2`}>
                      <option value="">Pick a reason</option>
                      <option value="Credit too low">Credit too low</option>
                      <option value="Not enough time in business">Not enough time in business</option>
                      <option value="Revenue too low">Revenue too low</option>
                      <option value="Too many existing positions">Too many existing positions</option>
                      <option value="Industry restricted">Industry restricted</option>
                      <option value="Other">Other (type below)</option>
                    </select>
                    <input value={draft.declineReason} onChange={set("declineReason")} placeholder="Reason / notes" className={`${inputCls} mb-2`} />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { updateLead(lead.id, { status: "declined", declineReason: draft.declineReason }); setDeclineOpen(false); }} className="rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-700">Save as declined</button>
                      <button onClick={() => setDeclineOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
                    </div>
                  </div>
                )
              )}

              {lead.status === "declined" && (
                <div>
                  <div className="mb-2 rounded-md bg-pink-50 px-2.5 py-1.5 text-xs font-medium text-pink-700 ring-1 ring-inset ring-pink-200">
                    Declined{lead.declineReason ? `: ${lead.declineReason}` : ""}. Work them toward approval-ready.
                  </div>
                  <Labeled label="Decline reason"><input value={draft.declineReason} onChange={set("declineReason")} className={inputCls} /></Labeled>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => updateLead(lead.id, { status: "credit_repair" })} className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700">Send to Credit Repair</button>
                    <button onClick={() => updateLead(lead.id, { status: "submitted" })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">Resubmit to Torro</button>
                  </div>
                </div>
              )}

              {["pre_approved", "contracts_out", "funded", "commission_paid"].includes(lead.status) && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 rounded-md bg-cyan-50 px-2.5 py-1.5 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-200">
                    <Check size={13} /> Approved by Torro
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Funded amount"><input value={draft.fundedAmount} onChange={set("fundedAmount")} placeholder="$" className={inputCls} /></Labeled>
                    <Labeled label="My commission"><input value={draft.commissionAmount} onChange={set("commissionAmount")} placeholder="$" className={inputCls} /></Labeled>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {lead.status === "pre_approved" && <button onClick={() => updateLead(lead.id, { status: "contracts_out" })} className="rounded-lg bg-lime-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lime-700">Client accepted, contracts out</button>}
                    {lead.status === "contracts_out" && <button onClick={() => updateLead(lead.id, { status: "funded", fundedAt: Date.now() })} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Mark funded</button>}
                    {lead.status === "funded" && <button onClick={() => updateLead(lead.id, { status: "commission_paid", commissionPaidAt: Date.now() })} className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-semibold text-white hover:bg-yellow-600">Mark commission paid</button>}
                    {lead.status === "commission_paid" && <span className="inline-flex items-center gap-1 text-sm font-semibold text-yellow-700"><Check size={15} /> Commission paid{lead.commissionPaidAt ? ` ${fmtDate(lead.commissionPaidAt)}` : ""}</span>}
                  </div>
                  {lead.fundedAt && <p className="mt-2 text-xs text-slate-400">Funded {fmtDate(lead.fundedAt)}.</p>}
                </div>
              )}
            </Section>
          )}

          {/* activity */}
          {(lead.touches || []).length > 0 && (
            <Section icon={<Clock size={15} />} title="Activity">
              <div className="flex flex-col gap-2">
                {[...lead.touches].sort((a, b) => b.at - a.at).slice(0, 20).map((t, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-slate-500">
                      <span className="font-mono text-slate-400">{fmtDateTime(t.at)}</span>
                      <span className="font-medium text-slate-700">{t.kind === "call" ? `Call: ${(t.disposition || "logged").replace(/_/g, " ")}` : t.kind === "submit" ? "Submitted to funder" : t.kind === "link" ? `Link sent (${t.channel})` : t.kind === "cadence" ? `Follow-up (${t.channel})` : `${t.kind} (${t.channel})`}</span>
                      {t.by && <span className="text-slate-400">by {t.by}</span>}
                    </div>
                    {t.note && <div className="mt-0.5 rounded-md bg-slate-50 px-2 py-1 text-slate-600">{t.note}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* imported data from GHL */}
          {lead.raw && (
            <Section icon={<FileText size={15} />} title="Imported data (from GHL)">
              <button onClick={() => setRawOpen((o) => !o)} className="text-sm font-medium text-blue-700 hover:underline">{rawOpen ? "Hide" : "Show"} exactly what GHL sent</button>
              {rawOpen && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{JSON.stringify(lead.raw.customData || lead.raw, null, 2)}</pre>}
            </Section>
          )}

          {/* footer actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button onClick={() => { if (confirm(`Remove ${lead.name || "this client"}?`)) { removeLead(lead.id); onClose(); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"><Trash2 size={13} /> Remove</button>
            <span className="text-xs text-slate-400">Changes save automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function Section({ icon, title, children }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">{icon} {title}</h3>
      {children}
    </div>
  );
}

/* ================================================================== */
/*  Messaging: templates + cadences                                   */
/* ================================================================== */
function Messaging({ templates, persistTemplates, cadences, persistCadences }) {
  const [sub, setSub] = useState("templates");
  const loadDefaults = () => {
    if (confirm("Load the recommended templates and 30-day follow-up sequence? This replaces your current templates and stage follow-ups.")) {
      persistTemplates(DEFAULT_TEMPLATES);
      persistCadences(DEFAULT_CADENCES);
    }
  };
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {[["templates", "Templates"], ["cadences", "Stage follow-ups"]].map(([k, l]) => (
            <button key={k} onClick={() => setSub(k)} className={`rounded-md px-3 py-1.5 font-medium ${sub === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <button onClick={loadDefaults} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">Load recommended 30-day sequence</button>
      </div>
      {sub === "templates" ? <TemplatesEditor templates={templates} persistTemplates={persistTemplates} />
        : <CadenceEditor templates={templates} cadences={cadences} persistCadences={persistCadences} />}
    </div>
  );
}

function TemplatesEditor({ templates, persistTemplates }) {
  const [editing, setEditing] = useState(null); // template object or null
  const blank = () => ({ id: "t_" + Math.random().toString(36).slice(2, 9), name: "", channel: "sms", pool: "", subject: "", body: "" });
  const save = (tpl) => {
    const exists = templates.some((t) => t.id === tpl.id);
    persistTemplates(exists ? templates.map((t) => (t.id === tpl.id ? tpl : t)) : [...templates, tpl]);
    setEditing(null);
  };
  const del = (id) => { if (confirm("Delete this template?")) persistTemplates(templates.filter((t) => t.id !== id)); };

  if (editing) return <TemplateForm tpl={editing} onSave={save} onCancel={() => setEditing(null)} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">Build the messages your stages send. Tokens: <span className="font-mono">{"{{first}}"} {"{{link}}"} {"{{signature}}"}</span></p>
        <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={15} /> New template</button>
      </div>
      {templates.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {t.channel === "sms" ? <MessageSquare size={15} className="text-blue-600" /> : <Mail size={15} className="text-blue-600" />}
              <span className="font-semibold">{t.name || "(unnamed)"}</span>
              {t.pool && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">{POOL_LABELS[t.pool] || t.pool}</span>}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t.channel}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
              <button onClick={() => del(t.id)} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-50"><Trash2 size={15} /></button>
            </div>
          </div>
          {t.channel === "email" && t.subject && <div className="mt-1 text-xs text-slate-400">Subject: {t.subject}</div>}
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{t.body}</p>
        </div>
      ))}
    </div>
  );
}
function TemplateForm({ tpl, onSave, onCancel }) {
  const [d, setD] = useState(tpl);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Template name"><input value={d.name} onChange={set("name")} className={inputCls} /></Labeled>
        <Labeled label="Channel">
          <select value={d.channel} onChange={set("channel")} className={inputCls}><option value="sms">Text (SMS)</option><option value="email">Email</option></select>
        </Labeled>
      </div>
      <div className="mt-3"><Labeled label="Message pool (leads get a random variant from the same pool)">
        <select value={d.pool || ""} onChange={set("pool")} className={inputCls}>
          <option value="">None (not in rotation)</option>
          {Object.entries(POOL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Labeled></div>
      {d.channel === "email" && <div className="mt-3"><Labeled label="Subject"><input value={d.subject} onChange={set("subject")} className={inputCls} /></Labeled></div>}
      <div className="mt-3"><Labeled label="Message"><textarea value={d.body} onChange={set("body")} rows={d.channel === "email" ? 8 : 3} className={inputCls} /></Labeled></div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <button disabled={!d.name.trim()} onClick={() => onSave(d)} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">Save template</button>
      </div>
    </div>
  );
}

const POOL_LABELS = {
  vm_sms: "Voicemail, text", vm_email: "Voicemail, email",
  int_sms: "Interested, text", int_email: "Interested, email",
  cb_sms: "Call back, text", cb_email: "Call back, email",
  ni_email: "Not interested, email", pulled_sms: "Report pulled, text",
  app_sms: "Application, text", app_email: "Application, email",
};

function CadenceEditor({ templates, cadences, persistCadences }) {
  const [stage, setStage] = useState("interested");
  const steps = cadences[stage] || [];
  const pools = [...new Set(templates.map((t) => t.pool).filter(Boolean))];
  const poolLabel = (p) => (POOL_LABELS[p] || p) + ` (${poolTemplates(templates, p).length})`;
  const update = (next) => persistCadences({ ...cadences, [stage]: next });
  const addStep = () => update([...steps, { day: 1, pool: pools[0] || "" }]);
  const setStep = (i, patch) => update(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const delStep = (i) => update(steps.filter((_, idx) => idx !== i));

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Each step sends from a message pool, and the app picks a random variant per lead so people get different messages. Set how many days after entering the stage it goes out.</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setStage(s.key)} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${stage === s.key ? TONE[s.tone] + " ring-2" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"}`}>
            {s.label}{(cadences[s.key]?.length || 0) > 0 ? ` (${cadences[s.key].length})` : ""}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {steps.length === 0 && <p className="mb-3 text-sm text-slate-400">No steps yet for this stage.</p>}
        <div className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Day</span>
              <input type="number" min={0} value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) })} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
              <select value={s.pool || ""} onChange={(e) => setStep(i, { pool: e.target.value, templateId: undefined })} className="min-w-44 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                {!s.pool && <option value="">Pick a message pool</option>}
                {pools.map((p) => <option key={p} value={p}>{poolLabel(p)}</option>)}
              </select>
              <button onClick={() => delStep(i)} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-50"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"><Plus size={15} /> Add step</button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Scripts                                                           */
/* ================================================================== */
const SCRIPTS = [
  { title: "Cold call open", body: `Hi, is this {NAME}? Great. This is {YOUR NAME} with ASAP Funding USA. I will keep this quick.

We help business owners get funding as fast as possible, while still landing the best options for your situation, not just the quickest yes. Before I can tell you what you would qualify for, I need to see your full profile.

The fastest way to do that is a soft pull through a secure monitoring link. It takes about 5 minutes and does not ding your score. I can text or email it to you right now while we are on the phone. Which is better, text or email?` },
  { title: "Warm / inbound", body: `Hi {NAME}, this is {YOUR NAME} with ASAP Funding USA, returning your inquiry about funding. Thanks for reaching out.

To match you with the right options I need to look at your full credit profile. The cleanest way is a secure link that pulls your report in about 5 minutes. Nothing about it hurts your score.

I am going to send that to you right now. Are you near your phone or your email? I will stay on with you while you open it so it is done in one shot.` },
  { title: "Voicemail", body: `Hi {NAME}, this is {YOUR NAME} with ASAP Funding USA. I have funding options I want to walk you through, I just need to see your profile first.

I am texting and emailing you a secure link right now that pulls your report in about 5 minutes. Open that when you get a sec and I will follow up. Again this is {YOUR NAME} with ASAP Funding USA. Talk soon.` },
  { title: "Objection: why do you need my credit?", body: `Totally fair question. Funders price and approve based on your profile, so if I guess I waste your time and theirs. Pulling it lets me match you to the lenders you actually fit, instead of throwing you at a wall and risking hard inquiries that lower your score.

This is a soft pull through a monitoring service. It does not affect your score and you stay in control of the account. Five minutes now saves you weeks of dead ends.` },
  { title: "Objection: is this safe?", body: `Good, I want you to ask that. It is a secure monitoring service, the same kind people use to watch their own credit. You create your own login, you can see everything I see, and you can cancel anytime.

I am not asking for a password or anything sensitive over the phone. You enter your own info on their secure site. I just get read access to review your report so I can build your options.` },
  { title: "Objection: I am busy right now", body: `No problem, this is exactly why I keep it to one link. I am sending it to your phone and email right now so it is waiting for you. It is about 5 minutes whenever you have a window today.

What works better, should I check back with you this afternoon or first thing tomorrow? I will lock that in so this does not slip.` },
  { title: "After they pull it", body: `Perfect, I can see it came through, thank you. Give me a little time to go through everything and match you to the right funding options.

I will call you back today with where you stand and your best funding options. If anything needs tightening up first to land a stronger offer, I will lay out exactly what, and how fast we can move.` },
];
function Scripts() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">Swap <span className="font-mono text-slate-700">{"{NAME}"}</span> and <span className="font-mono text-slate-700">{"{YOUR NAME}"}</span> as you go.</p>
      {SCRIPTS.map((s) => (
        <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><FileText size={15} className="text-blue-600" /> {s.title}</h3>
            <CopyButton text={s.body} className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Settings                                                          */
/* ================================================================== */
function Settings({ config, persistConfig }) {
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const save = async () => { await persistConfig(draft); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800"><SettingsIcon size={15} className="text-blue-600" /> Core setup</h3>
        <div className="flex flex-col gap-3">
          <Labeled label="MyScoreIQ link (under $10k path)"><input value={draft.reportLink} onChange={set("reportLink")} className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Application link (over $10k path)"><input value={draft.appLink || ""} onChange={set("appLink")} placeholder="https://tinyurl.com/asapfundingapp" className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Signature / who it is from"><input value={draft.signature} onChange={set("signature")} className={inputCls} /></Labeled>
          <Labeled label="Funder name"><input value={draft.funderName || ""} onChange={set("funderName")} className={inputCls} /></Labeled>
          <Labeled label="Funder submission email"><input value={draft.funderEmail || ""} onChange={set("funderEmail")} className={`${inputCls} font-mono`} /></Labeled>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Send size={15} /> Save</button>
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"><Check size={15} /> Saved</span>}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Build your messages and per-stage follow-up sequences under the <span className="font-semibold text-slate-700">Messaging</span> tab.
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Commissions                                                       */
/* ================================================================== */
const money = (n) => "$" + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
function Commissions({ leads, onOpen }) {
  const deals = leads.filter((l) => ["funded", "commission_paid"].includes(l.status))
    .sort((a, b) => (b.fundedAt || b.lastTouchAt || 0) - (a.fundedAt || a.lastTouchAt || 0));
  const num = (v) => Number(v) || 0;
  const totalFunded = deals.reduce((s, l) => s + num(l.fundedAmount), 0);
  const totalCommission = deals.reduce((s, l) => s + num(l.commissionAmount), 0);
  const paid = deals.filter((l) => l.status === "commission_paid").reduce((s, l) => s + num(l.commissionAmount), 0);
  const pending = deals.filter((l) => l.status === "funded").reduce((s, l) => s + num(l.commissionAmount), 0);
  // deals approved but not yet funded, for a pipeline-value glance
  const inFlight = leads.filter((l) => ["pre_approved", "contracts_out"].includes(l.status));
  const inFlightCommission = inFlight.reduce((s, l) => s + num(l.commissionAmount), 0);

  const Card = ({ label, value, tone }) => (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Commission earned" value={money(totalCommission)} tone="border-blue-200 bg-blue-50 text-blue-900" />
        <Card label="Paid out" value={money(paid)} tone="border-yellow-200 bg-yellow-50 text-yellow-900" />
        <Card label="Funded, awaiting payout" value={money(pending)} tone="border-cyan-200 bg-cyan-50 text-cyan-900" />
        <Card label="In progress (approved)" value={money(inFlightCommission)} tone="border-slate-200 bg-slate-50 text-slate-800" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-1">
        <div className="px-3 py-2 text-sm font-bold text-slate-800">Funded deals ({deals.length}) {totalFunded > 0 && <span className="font-normal text-slate-400">| {money(totalFunded)} funded volume</span>}</div>
        {deals.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">No funded deals yet. They show up here once you mark a client funded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Funded</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2"><button onClick={() => onOpen(l.id)} className="font-semibold text-slate-700 hover:text-blue-700">{l.name || "Unnamed"}</button>{l.businessName && <div className="text-xs text-slate-400">{l.businessName}</div>}</td>
                    <td className="px-3 py-2 font-mono">{l.fundedAmount ? money(l.fundedAmount) : "-"}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-blue-700">{l.commissionAmount ? money(l.commissionAmount) : "-"}</td>
                    <td className="px-3 py-2"><StagePill status={l.status} /></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(l.commissionPaidAt || l.fundedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
