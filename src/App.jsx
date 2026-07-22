import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Phone, MessageSquare, Mail, Copy, Check, Plus, Search, Settings as SettingsIcon,
  Clock, Trash2, User, FileText, Send, AlertCircle, ChevronDown, Zap, Wifi,
  X, Eye, EyeOff, KeyRound, Upload, ExternalLink, Building2, CalendarClock, CalendarDays,
  ListChecks, Pencil, Save, LogOut, Lock, LayoutGrid, DollarSign, Menu,
  RefreshCw,
  Bell, BellOff,
  BellRing,
  TrendingUp,
  Ban,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ================================================================== */
/*  Stages                                                            */
/* ================================================================== */
const STAGES = [
  { key: "new", label: "New", tone: "slate" },
  { key: "appointment_booked", label: "Appt Booked", tone: "emerald" },
  { key: "voicemail", label: "Left Voicemail", tone: "amber" },
  { key: "waiting_reports", label: "Sent Reports", tone: "amber" },
  { key: "app_sent", label: "Sent Application", tone: "purple" },
  { key: "callback", label: "Call Back", tone: "violet" },
  { key: "check_back", label: "Check Back Later", tone: "blue" },
  { key: "not_interested", label: "Not Interested", tone: "orange" },
  { key: "wrong_number", label: "Wrong Number", tone: "rose" },
  { key: "interested", label: "Interested", tone: "sky" },
  { key: "report_pulled", label: "Reports Received", tone: "teal" },
  { key: "app_received", label: "App Received", tone: "indigo" },
  { key: "app_reports_received", label: "App & Reports Received", tone: "cyan" },
  { key: "submitted", label: "Deal Submitted", tone: "indigo" },
  { key: "looking_for_partner", label: "Looking for Partner", tone: "orange" },
  { key: "waiting_for_partner", label: "Waiting on Partner", tone: "amber" },
  { key: "denied", label: "Denied", tone: "rose" },
  { key: "pre_approved", label: "Approved / Offer", tone: "cyan" },
  { key: "contracts_out", label: "Waiting on Signature", tone: "amber" },
  { key: "agreement_signed", label: "Agreement Signed", tone: "lime" },
  { key: "getting_approvals", label: "Getting Approvals", tone: "sky" },
  { key: "funded", label: "Client Funded", tone: "emerald" },
  { key: "commission_paid", label: "Commission Paid", tone: "yellow" },
  { key: "declined", label: "Declined", tone: "pink" },
  { key: "offer_cr", label: "Offer Credit Repair", tone: "violet" },
  { key: "referred_cr", label: "Referred to Credit Repair", tone: "fuchsia" },
  { key: "credit_repair", label: "In Credit Repair", tone: "purple" },
  { key: "dead", label: "Dead", tone: "rose" },
];
const TONE = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-100 text-sky-800 ring-sky-200",
  purple: "bg-purple-100 text-purple-800 ring-purple-200",
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
  smartCreditLink: "https://www.smartcredit.com/?PID=52188",
  appLink: "https://tranquil-muffin-691d4e.netlify.app/apply.html",
  signature: "Joe at ASAP Funding USA",
  defaultRepFirst: "Joe",
  team: [],
  funderName: "Torro",
  funderEmail: "slocsubmissions@torro.com",
  autoSnoozeDays: 3,
  emailSignature: "Joe Mahlow\nASAP Funding USA\nfunding@asapfundingusa.com",
  autoSendEnabled: false,
  autoSendStages: ["voicemail", "interested", "callback"],
};

const DEFAULT_TEMPLATES = [
  // ============ VOICEMAIL: text (pool vm_sms) ============
  { id: "vm_sms_a", pool: "vm_sms", name: "VM text: direct", channel: "sms", subject: "",
    body: `Hi {{first}}, it's {{repfirst}} with ASAP. I just gave you a call about the Facebook ad you responded to on getting your business approved. Give me a quick call back or shoot me a text when you get a sec.` },
  { id: "vm_sms_b", pool: "vm_sms", name: "VM text: story", channel: "sms", subject: "",
    body: `Hi {{first}}, {{repfirst}} with ASAP here. I just called you about the Facebook ad you responded to on getting your business approved. Call or text me back and I will walk you through it.` },
  { id: "vm_sms_c", pool: "vm_sms", name: "VM text: myth bust", channel: "sms", subject: "",
    body: `Hi {{first}}, it's {{repfirst}} from ASAP. I just tried calling you about the Facebook ad you responded to on getting your business approved. This is not spam, just following up like you asked. Text me back a good time to connect.` },
  { id: "vm_sms_d", pool: "vm_sms", name: "VM text: curiosity", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. I just gave you a call about the Facebook ad you responded to on getting your business approved. Whenever you have a sec, call or text me back and I will keep it quick.` },

  // ============ VOICEMAIL: email (pool vm_email) ============
  { id: "vm_email_a", pool: "vm_email", name: "VM email: direct", channel: "email", subject: "Tried to reach you, {{first}}",
    body: `Hey {{first}},

{{signature}} here. You responded to one of our Facebook ads about getting your business approved, and I just tried giving you a call.

Here is the short version: I can likely get you pre-approved today, and it costs you nothing to find out. Call me back or just reply to this and we will get moving. Takes a few minutes to see what you qualify for.

Talk soon,
{{signature}}

PS. A bank's no is not the final answer. We shop your file across 75+ lenders.` },
  { id: "vm_email_b", pool: "vm_email", name: "VM email: story", channel: "email", subject: "Quick question about your business, {{first}}",
    body: `Hey {{first}},

You responded to one of our Facebook ads about getting your business approved, and I just tried giving you a call.

Quick story while I have you. We recently worked with an owner who had a 580 score and had been open less than 6 months. Every bank passed. We got them $120,000. I am not saying you get the same number, I am saying the bank's box is not the only box, and I would love to see what your file looks like.

Call or reply and I will get right on it.

{{signature}}` },
  { id: "vm_email_c", pool: "vm_email", name: "VM email: myth bust", channel: "email", subject: "Following up, {{first}}",
    body: `Hey {{first}},

You responded to one of our Facebook ads about getting your business approved, and I just tried reaching you by phone.

Here is the thing most owners never hear: when a bank declines you, that is one lender's opinion, not the market's. We take your file to 75+ lenders and let them compete. That is a completely different game, and it is free to see where you land.

Reply or call me back and I will pull your options together.

{{signature}}` },

  // ============ INTERESTED / SEND LINK: text (pool int_sms) ============
  { id: "first_sms", pool: "int_sms", name: "Interested text: standard", channel: "sms", subject: "",
    body: `Hi {{first}}, {{repfirst}} with ASAP. Here is the one thing between you and knowing exactly what you qualify for, your report: {{link}} 5 minutes, soft pull, zero hit to your score. Text me DONE when it is in and I will get to work.` },
  { id: "int_sms_b", pool: "int_sms", name: "Interested text: story", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. You did the hard part by reaching out. This part takes 5 minutes: pull your report here so I can show you real numbers, not guesses: {{link}} No hit to your score.` },
  { id: "int_sms_c", pool: "int_sms", name: "Interested text: risk reversal", channel: "sms", subject: "",
    body: `{{first}}, most owners are shocked when they see what they actually qualify for. I cannot show you until I see your report though, and it is a soft pull, no score hit: {{link}} Worth 5 minutes?` },
  { id: "int_sms_d", pool: "int_sms", name: "Interested text: speed", channel: "sms", subject: "",
    body: `{{first}}, here is my promise: pull your report and I will have real options back to you the same day. That is it. 5 minutes on your end: {{link}}` },

  // ============ INTERESTED / SEND LINK: email (pool int_email) ============
  { id: "first_email", pool: "int_email", name: "Interested email: standard", channel: "email", subject: "Your pre-approval, {{first}}",
    body: `Hi {{first}},

Great talking. The next step to get you pre-approved is quick. Pull your report through the secure link below so I can review your profile and line up your best options.

{{link}}

About 5 minutes, and it does not hurt your score. Once it is done, reply or text me and I will get to work.

{{signature}}` },
  { id: "int_email_b", pool: "int_email", name: "Interested email: story", channel: "email", subject: "A quick idea for your business, {{first}}",
    body: `Hi {{first}},

Here is what is possible. A recent client had a 580 score and had been in business less than 6 months. The banks all said no. We got them $120,000.

Your file is its own story, and I cannot tell it until I see your report. That is all I need to show you real numbers:

{{link}}

Takes about 5 minutes and does not touch your score. Pull it and I will get right to work.

{{signature}}` },
  { id: "int_email_c", pool: "int_email", name: "Interested email: 75 lenders", channel: "email", subject: "Circling back, {{first}}",
    body: `Hi {{first}},

A bank can only offer you the bank's box. We do the opposite. We take your profile to 75+ lenders and make them compete, then bring you the best fit on amount and terms.

To do that I need one thing, your report:

{{link}}

5 minutes, no hit to your score. Reply once it is done and I will line up your options.

{{signature}}` },

  // ============ ACCOUNT CHECK: text (pool acct_sms) ============
  { id: "acct_sms_a", pool: "acct_sms", name: "Account check: text", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. Quick one: were you able to get your MyScoreIQ account created? That report is the only thing between you and knowing exactly what you qualify for. Here is the link again, 5 minutes: {{link}} Reply DONE when it is set and I will take it from there.` },
  { id: "acct_sms_b", pool: "acct_sms", name: "Account check: text 2", channel: "sms", subject: "",
    body: `{{first}}, not going to let you leave money on the table. Two minutes to create your MyScoreIQ account and I can tell you what you qualify for today: {{link}} If you get stuck anywhere, text me STUCK and I will jump on a call with you.` },

  // ============ ACCOUNT CHECK: email (pool acct_email) ============
  { id: "acct_email_a", pool: "acct_email", name: "Account check: email", channel: "email", subject: "Were you able to set up your account, {{first}}?",
    body: `Hi {{first}},

Quick check, were you able to get your MyScoreIQ account created?

Here is the link again so you do not have to dig for it:

{{link}}

Here is why it matters: that report is the only thing I need to tell you exactly what you qualify for. No report, no numbers. Five minutes and you will know where you stand.

Get stuck anywhere? Just reply to this and I will walk you through it, or hop on a quick call with you.

{{signature}}` },

  // ============ SUCCESS STORIES: text (pool story_sms) ============
  { id: "story_sms_a", pool: "story_sms", name: "Success story: text", channel: "sms", subject: "",
    body: `{{first}}, just helped a business owner with a 600 score get the approval they needed for their shop. Every owner's situation is different, but I would love to show you what is possible for yours. Got 5 minutes to talk?` },
  { id: "story_sms_b", pool: "story_sms", name: "Success story: text 2", channel: "sms", subject: "",
    body: `{{first}}, a lot of owners think a lower score shuts the door. It does not. We recently got someone open under a year approved when their bank passed. Worth a quick call to see your options?` },

  // ============ SUCCESS STORIES: email (pool story_email) ============
  { id: "story_email_a", pool: "story_email", name: "Success story: email", channel: "email", subject: "What we did for an owner like you, {{first}}",
    body: `Hi {{first}},

Wanted to share a quick one. We recently worked with a business owner who had a 600 score and figured they had no shot. Their bank had already passed. We took their file to our network and got them $85,000.

Your situation is its own story, and I would love to see what we can do for you. It starts with a quick conversation, no cost and no obligation.

Reply here or give me a call and let's talk.

{{signature}}` },
  { id: "story_email_b", pool: "story_email", name: "Success story: email 2", channel: "email", subject: "A lower score is not the end of the road, {{first}}",
    body: `Hi {{first}},

A lot of owners assume a lower credit score means no capital. That is not how it works when you have someone shopping your file the right way.

We recently helped an owner who had been in business under a year, and whose bank had already said no, get approved. Different lenders, different criteria, different answer.

I would love to see what is possible for you. Got a few minutes this week to talk?

{{signature}}` },

  // ============ CALL BACK: text (pool cb_sms) ============
  { id: "cb_sms_a", pool: "cb_sms", name: "Call back text: reconnect", channel: "sms", subject: "",
    body: `Hi {{first}}, {{repfirst}} with ASAP, circling back like we planned. When is a good time to connect? Text me a time that works.` },
  { id: "cb_sms_b", pool: "cb_sms", name: "Call back text: nudge", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP here. Still holding your spot. 5 minutes is all I need. What time today or tomorrow works?` },

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
    body: `Got your report, {{first}}, thank you. Reviewing everything now and I will be back to you today. {{repfirst}} with ASAP` },
  { id: "pulled_sms_b", pool: "pulled_sms", name: "Got it, working it", channel: "sms", subject: "",
    body: `{{first}}, got it, thank you. Going through your file now to see how I can help. Back to you today. {{repfirst}} with ASAP` },

  // ============ APPLICATION (after pre-approval): pool app_sms / app_email ============
  { id: "app_sms_a", pool: "app_sms", name: "Application: more funding (text)", channel: "sms", subject: "",
    body: `Hi {{first}}, to move forward we need a quick application with your last few bank statements. You can do it all in one place, about 10 minutes: {{applink}}` },
  // ============ MANUAL (never auto-sent, shows in the Insert-a-template picker) ============
  { id: "manual_smartcredit_sms", pool: "manual", name: "SmartCredit backup (text)", channel: "sms", subject: "",
    body: `{{first}}, no problem. If MyScoreIQ is not working for you, use SmartCredit instead, it does the same thing: {{smartcredit}} About 5 minutes. Text me DONE once you are in.` },
  { id: "manual_smartcredit_email", pool: "manual", name: "SmartCredit backup (email)", channel: "email", subject: "Use this instead, {{first}}",
    body: `Hi {{first}},

No problem at all. If you cannot get into MyScoreIQ, we can use SmartCredit instead. It gives me the same information:

{{smartcredit}}

Takes about 5 minutes. Reply or text me once you are in and I will take it from there.

{{signature}}` },
  { id: "manual_checkin_sms", pool: "manual", name: "Warm check-in (text)", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. Just thinking about your business, still want to help you get where you are trying to go. Got a couple minutes to talk this week?` },
  { id: "app_email_a", pool: "app_email", name: "Application: more funding (email)", channel: "email", subject: "Your funding application, {{first}}",
    body: `Hi {{first}},

To go for more funding we need a short application along with your last 4 months of business bank statements. You can complete and sign everything in one place here, about 10 minutes:

{{applink}}

Have your bank statements, a voided check, and your driver's license handy. Reply or text me if anything comes up.

{{signature}}` },

  // ============ URGENCY / NUDGE: text (pool urgency_sms) ============
  { id: "urg_sms_a", pool: "urgency_sms", name: "Urgency text: window", channel: "sms", subject: "",
    body: `{{first}}, quick nudge from {{repfirst}} at ASAP. Still want to get your business in a position to get approved? Pull your report here and I take it from there: {{link}}` },
  { id: "urg_sms_b", pool: "urgency_sms", name: "Urgency text: not a pest", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. Not trying to bug you, just do not want you to miss your window. 5 minutes here and I go to work: {{link}}` },
  { id: "urg_sms_c", pool: "urgency_sms", name: "Urgency text: one more", channel: "sms", subject: "",
    body: `{{first}}, it is {{repfirst}} at ASAP. Circling back one more time. Ready when you are: {{link}} Reply STOP anytime and I will hold off.` },
  { id: "urg_sms_d", pool: "urgency_sms", name: "Urgency text: things change", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} here. A lot can change in a few weeks. If now is a better time, here is your link: {{link}}` },
  { id: "urg_sms_e", pool: "urgency_sms", name: "Urgency text: still on desk", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. Still have your file on my desk. Want me to keep going? {{link}}` },
  { id: "urg_sms_f", pool: "urgency_sms", name: "Urgency text: yes or no", channel: "sms", subject: "",
    body: `{{first}}, one word is all I need. Are you still trying to get your business approved this year? If yes, here is step one: {{link}}` },

  // ============ VALUE / EDUCATION: email (pool value_email) ============
  { id: "val_email_a", pool: "value_email", name: "Value email: why declined", channel: "email", subject: "Why good businesses get declined, {{first}}",
    body: `Hey {{first}},

Quick one that might save you a headache. Most owners get declined for one of three reasons: thin personal credit, not enough time showing revenue, or too many recent inquiries. None of those are dead ends. Every one of them can be worked around with the right lender or a short runway to get you ready.

That is the whole reason I want to see your file. I can tell you in a few minutes which bucket you are in and what the fastest path looks like.

Reply here or pull your report and I will get right on it.

{{signature}}` },
  { id: "val_email_b", pool: "value_email", name: "Value email: one review", channel: "email", subject: "The one number lenders care about, {{first}}",
    body: `Hey {{first}},

Here is something banks will not tell you. When you apply at ten banks, you get ten hard inquiries and ten chances to get told no. When you come through us, it is one review across a network of lenders. One inquiry, many options, and we point your file at the lenders most likely to say yes.

That is the difference between guessing and knowing. Want me to run it for you?

{{signature}}` },
  { id: "val_email_c", pool: "value_email", name: "Value email: revenue not score", channel: "email", subject: "It is not just your score, {{first}}",
    body: `Hey {{first}},

A lot of owners assume a low score means no options. Not true. Plenty of the lenders we work with weigh your revenue and the health of your business as much as a credit number. I have seen owners with rough credit get approved because their deposits told a strong story.

I cannot tell you where you land until I see your file. It is a soft pull and it takes about 5 minutes.

{{signature}}` },
  { id: "val_email_d", pool: "value_email", name: "Value email: speed", channel: "email", subject: "How fast this actually moves, {{first}}",
    body: `Hey {{first}},

People expect this to drag on for months like a bank. It does not have to. Once I have your file, I can usually come back the same day with real options, and funding can move quickly from there when your profile is ready.

The only thing slowing it down right now is that I have not seen your report yet. Want to fix that?

{{signature}}` },
  { id: "val_email_e", pool: "value_email", name: "Value email: no cost", channel: "email", subject: "This part is free, {{first}}",
    body: `Hey {{first}},

Just so it is clear, seeing what you qualify for costs you nothing. No fee to look, no obligation, no hit to your score. You only move forward if the numbers make sense for you.

So the only real question is whether you want to know. Reply here and I will send you the quick link.

{{signature}}` },

  // ============ SOCIAL PROOF: email (pool proof_email) ============
  { id: "proof_email_a", pool: "proof_email", name: "Proof email: 580 story", channel: "email", subject: "He had a 580, {{first}}",
    body: `Hey {{first}},

Real example. An owner came to us with a 580 and less than a year in business. Three banks had already passed. We looked at his full picture, matched him to the right lender, and he walked away with the capital he needed to grow.

I am not promising you the same number. I am telling you the bank's box is not the only box. Let me see your file and I will show you what is actually possible.

{{signature}}` },
  { id: "proof_email_b", pool: "proof_email", name: "Proof email: reviews", channel: "email", subject: "Why owners keep coming back, {{first}}",
    body: `Hey {{first}},

We have helped thousands of business owners get into a position to be approved, and the reason they send us their friends is simple. We do not just tell you no and hang up. We tell you exactly what is holding you back and how to fix it, then we go find the yes.

That is the whole game. Want me to do it for you? It starts with a quick look at your report.

{{signature}}` },
  { id: "proof_email_c", pool: "proof_email", name: "Proof email: seen it all", channel: "email", subject: "We have seen your situation before, {{first}}",
    body: `Hey {{first}},

Whatever your credit looks like right now, I promise we have seen it and worked through it. Low score, past bankruptcy, thin file, brand new business. None of it is new to us, and none of it is automatically a no.

Give me a few minutes with your report and I will tell you the truth about where you stand.

{{signature}}` },
  { id: "proof_email_d", pool: "proof_email", name: "Proof email: numbers", channel: "email", subject: "A quick track record, {{first}}",
    body: `Hey {{first}},

Since 2013 we have worked with tens of thousands of business owners. Thousands of five star reviews. A team that does this every single day. I say that not to brag but so you know your file is in experienced hands.

The next move is yours. Pull your report and let me get to work.

{{signature}}` },

  // ============ BREAKUP / FINAL: text (pool breakup_sms) ============
  { id: "break_sms_a", pool: "breakup_sms", name: "Breakup text: close file", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. I have reached out a few times and do not want to be a pest. I will close your file for now. If you ever want to pick it back up, just text me. No hard feelings.` },
  { id: "break_sms_b", pool: "breakup_sms", name: "Breakup text: last call", channel: "sms", subject: "",
    body: `{{first}}, last one from me for now. If getting your business approved is still a goal, here is your link: {{link}} If not, no worries at all and I will step back.` },
  { id: "break_sms_c", pool: "breakup_sms", name: "Breakup text: door open", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} here. Going to give you some space. The door stays open, text me anytime and we pick right back up where we left off.` },

  // ============ BREAKUP / FINAL: email (pool breakup_email) ============
  { id: "break_email_a", pool: "breakup_email", name: "Breakup email: should I close", channel: "email", subject: "Should I close your file, {{first}}?",
    body: `Hey {{first}},

I have reached out a handful of times and I do not want to crowd your inbox. If the timing is not right, that is completely fine.

If you still want to get your business into a position to be approved, just reply and I will pick it right back up. If I do not hear back, I will close your file for now and leave you be. Either way, no hard feelings.

{{signature}}` },
  { id: "break_email_b", pool: "breakup_email", name: "Breakup email: one yes", channel: "email", subject: "One yes and I am back on it, {{first}}",
    body: `Hey {{first}},

This is my last note for now. I know how busy running a business gets, so no pressure at all.

If you ever want to know what you qualify for, one reply gets me back on your file the same day. I will be here when the timing is right.

{{signature}}` },
  { id: "break_email_c", pool: "breakup_email", name: "Breakup email: leaving door open", channel: "email", subject: "Leaving the door open, {{first}}",
    body: `Hey {{first}},

I am going to step back so I am not filling your inbox. Nothing changes on our end. Whenever you are ready to see your options, reply to this email and we go right back to work.

Wishing you and the business well either way.

{{signature}}` },

  // ============ EXTRA VOICEMAIL variety ============
  { id: "vm_first_sms", pool: "vm_first_sms", name: "VM text: first touch (pre-approval)", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. We got the info you submitted and I want to get your pre-approval sent out, possibly as early as today. I just missed you by phone. Call or text me back and we will get moving.` },
  { id: "vm_sms_e", pool: "vm_sms", name: "VM text: quick", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} at ASAP. Tried you by phone about the Facebook ad on getting your business approved. Got 2 minutes today? Text me back.` },
  { id: "vm_sms_f", pool: "vm_sms", name: "VM text: worth it", channel: "sms", subject: "",
    body: `{{first}}, it is {{repfirst}} with ASAP. You reached out about getting your business approved and I just missed you. This is worth 5 minutes of your day, promise. Call or text back.` },
  { id: "vm_email_d", pool: "vm_email", name: "VM email: still here", channel: "email", subject: "Still here when you are ready, {{first}}",
    body: `Hey {{first}},

You responded to our Facebook ad about getting your business approved and I have been trying to connect. No rush, but I did not want your inquiry to fall through the cracks.

Whenever you have a few minutes, reply here or give me a call and I will show you what you qualify for. It is free to look and it does not touch your score.

{{signature}}` },

  // ============ EXTRA INTERESTED / report-link variety ============
  { id: "int_sms_e", pool: "int_sms", name: "Interested text: curiosity 2", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. I genuinely think you will be surprised by what you qualify for. Only way to know is your report: {{link}} Soft pull, no score hit.` },
  { id: "int_sms_f", pool: "int_sms", name: "Interested text: same day", channel: "sms", subject: "",
    body: `{{first}}, pull this and I will have real options back to you today: {{link}} 5 minutes, no hit to your score. Text me DONE when it is in.` },
  { id: "int_email_d", pool: "int_email", name: "Interested email: no guessing", channel: "email", subject: "Let us stop guessing, {{first}}",
    body: `Hey {{first}},

I can talk all day about what might be possible, but you deserve real numbers, not guesses. The only thing standing between you and those numbers is your report.

Here is the secure link. It is a soft pull, about 5 minutes, and it does not affect your score: {{link}}

The moment it is in, I go to work and come back with your actual options.

{{signature}}` },

  // ============ EXTRA ACCOUNT-CHECK variety ============
  { id: "acct_sms_c", pool: "acct_sms", name: "Account check text: nudge", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} at ASAP. Were you able to get your report pulled? If the link gave you trouble, here it is again: {{link}} Happy to walk you through it.` },
  { id: "acct_email_c", pool: "acct_email", name: "Account check email: stuck", channel: "email", subject: "Did the link give you trouble, {{first}}?",
    body: `Hey {{first}},

Checking in. I do not see your report on my end yet, so I wanted to make sure the link worked for you. Sometimes it is a quick fix.

Here it is again: {{link}}

If you hit a snag, just reply and tell me where you got stuck. I will get you through it in a couple minutes.

{{signature}}` },

  // ============ EXTRA SUCCESS STORY variety ============
  { id: "story_sms_d", pool: "story_sms", name: "Success story text: turnaround", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. Had an owner this month who was sure they would get told no everywhere. We found their yes. I would love to do the same for you: {{link}}` },
  { id: "story_email_d", pool: "story_email", name: "Success story email: rough credit", channel: "email", subject: "Rough credit is not the end, {{first}}",
    body: `Hey {{first}},

Story for you. Owner came in convinced their credit made them un-fundable. Low score, a couple of old marks, the works. We looked past the number, matched them to the right lender, and got them approved.

Your file might have a similar story hiding in it. I will not know until I see it. Soft pull, 5 minutes: {{link}}

{{signature}}` },

  // ============ EXTRA CALLBACK variety ============
  { id: "cb_sms_c", pool: "cb_sms", name: "Call back text: reconnect", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. You asked me to circle back, so here I am. Got a few minutes now to pick up where we left off?` },
  { id: "cb_sms_d", pool: "cb_sms", name: "Call back text: good time", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} at ASAP. Trying to catch you at a better time. What works today, morning or afternoon? I will make it quick.` },
  { id: "cb_sms_e", pool: "cb_sms", name: "Call back text: ready", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} here. Ready to pick this back up whenever you are. Text me a good time and I will call you then.` },
  { id: "cb_email_c", pool: "cb_email", name: "Call back email: reconnect", channel: "email", subject: "Picking up where we left off, {{first}}",
    body: `Hey {{first}},

You had asked me to reach back out, so here I am. I would still love to show you what you qualify for and lay out the fastest path to getting your business approved.

Reply here with a good time, or just pull your report and I will take it from there: {{link}}

{{signature}}` },
  { id: "cb_email_d", pool: "cb_email", name: "Call back email: quick", channel: "email", subject: "Two minutes, {{first}}?",
    body: `Hey {{first}},

I know the timing was off when we last connected. No problem at all. This really only takes a couple of minutes to get moving.

Tell me when works and I will call you then, or start it yourself here: {{link}}

{{signature}}` },


  // ============ APPLICATION SENT / chase the signed app (pools appchase_sms, appchase_email) ============
  { id: "appchase_sms_a", pool: "appchase_sms", name: "App chase text: nudge", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. I sent over the application to get you moving. Were you able to get it filled out and sent back? Let me know if you hit any snags.` },
  { id: "appchase_sms_b", pool: "appchase_sms", name: "App chase text: almost there", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} here. You are one step away. Once that application is back to me I can get everything moving on my end. Need anything from me to finish it?` },
  { id: "appchase_sms_c", pool: "appchase_sms", name: "App chase text: quick check", channel: "sms", subject: "",
    body: `{{first}}, quick check from {{repfirst}} at ASAP. Any questions on the application I sent? Happy to walk you through any part of it. Just reply here.` },
  { id: "appchase_sms_d", pool: "appchase_sms", name: "App chase text: help", channel: "sms", subject: "",
    body: `{{first}}, {{repfirst}} with ASAP. If the application looked like a lot, do not worry, most of it is quick. Text me and I will help you knock it out in a few minutes.` },

  { id: "appchase_email_a", pool: "appchase_email", name: "App chase email: nudge", channel: "email", subject: "Did you get the application, {{first}}?",
    body: `Hey {{first}},

I sent over the application to get your file moving. Just checking that it came through and seeing if you had a chance to complete it.

Once I have it back, I can take it from there and get everything working for you. If any part of it is unclear, reply here and I will walk you through it.

{{signature}}` },
  { id: "appchase_email_b", pool: "appchase_email", name: "App chase email: whats needed", channel: "email", subject: "One step from moving forward, {{first}}",
    body: `Hey {{first}},

You are right at the finish line. The only thing I am waiting on is your completed application. As soon as it is back to me, I go to work.

To make it easy, here is what the application typically asks for: basic business details, a few recent bank statements, and a voided check. If you have questions on any of it, just reply.

{{signature}}` },
  { id: "appchase_email_c", pool: "appchase_email", name: "App chase email: still here", channel: "email", subject: "Still holding your spot, {{first}}",
    body: `Hey {{first}},

Following up on the application I sent. No rush, I just do not want it to slip through the cracks on a busy week.

Whenever you are ready, send it back and I will get everything moving. Reply here if you need me to resend it or help you through any part.

{{signature}}` },

];

// Per stage: ordered steps. day = days after entering that stage.
const DEFAULT_CADENCES = {
  new: [],
  voicemail: [
    { day: 0, pool: "vm_first_sms" },
    { day: 0, pool: "vm_email" },
    { day: 1, pool: "vm_sms" },
    { day: 2, pool: "vm_email" },
    { day: 3, pool: "vm_sms" },
    { day: 4, pool: "value_email" },
    { day: 6, pool: "urgency_sms" },
    { day: 8, pool: "vm_email" },
    { day: 10, pool: "vm_sms" },
    { day: 17, pool: "proof_email" },
    { day: 24, pool: "urgency_sms" },
    { day: 31, pool: "value_email" },
    { day: 38, pool: "vm_sms" },
    { day: 52, pool: "vm_email" },
    { day: 66, pool: "urgency_sms" },
    { day: 80, pool: "proof_email" },
    { day: 100, pool: "vm_sms" },
    { day: 120, pool: "value_email" },
    { day: 140, pool: "urgency_sms" },
    { day: 165, pool: "vm_email" },
    { day: 190, pool: "vm_sms" },
    { day: 215, pool: "proof_email" },
    { day: 245, pool: "urgency_sms" },
    { day: 275, pool: "breakup_email" },
    { day: 305, pool: "breakup_sms" },
  ],
  interested: [
    { day: 0, pool: "int_sms" },
    { day: 0, pool: "int_email" },
    { day: 1, pool: "acct_sms" },
    { day: 2, pool: "acct_email" },
    { day: 3, pool: "int_sms" },
    { day: 4, pool: "story_email" },
    { day: 6, pool: "acct_sms" },
    { day: 8, pool: "value_email" },
    { day: 10, pool: "urgency_sms" },
    { day: 17, pool: "story_email" },
    { day: 24, pool: "int_sms" },
    { day: 31, pool: "proof_email" },
    { day: 38, pool: "story_sms" },
    { day: 52, pool: "value_email" },
    { day: 66, pool: "urgency_sms" },
    { day: 80, pool: "story_email" },
    { day: 100, pool: "int_sms" },
    { day: 120, pool: "proof_email" },
    { day: 140, pool: "story_sms" },
    { day: 165, pool: "value_email" },
    { day: 190, pool: "urgency_sms" },
    { day: 215, pool: "story_email" },
    { day: 245, pool: "int_sms" },
    { day: 275, pool: "breakup_email" },
    { day: 305, pool: "breakup_sms" },
  ],
  callback: [
    { day: 0, pool: "cb_sms" },
    { day: 0, pool: "cb_email" },
    { day: 1, pool: "cb_sms" },
    { day: 2, pool: "cb_email" },
    { day: 3, pool: "cb_sms" },
    { day: 4, pool: "value_email" },
    { day: 6, pool: "urgency_sms" },
    { day: 8, pool: "cb_email" },
    { day: 10, pool: "cb_sms" },
    { day: 17, pool: "proof_email" },
    { day: 24, pool: "urgency_sms" },
    { day: 31, pool: "value_email" },
    { day: 38, pool: "cb_sms" },
    { day: 52, pool: "cb_email" },
    { day: 66, pool: "urgency_sms" },
    { day: 80, pool: "proof_email" },
    { day: 100, pool: "cb_sms" },
    { day: 120, pool: "value_email" },
    { day: 140, pool: "urgency_sms" },
    { day: 165, pool: "cb_email" },
    { day: 190, pool: "cb_sms" },
    { day: 215, pool: "proof_email" },
    { day: 245, pool: "urgency_sms" },
    { day: 275, pool: "breakup_email" },
    { day: 305, pool: "breakup_sms" },
  ],
  not_interested: [
    { day: 10, pool: "ni_email" },
    { day: 30, pool: "ni_email" },
  ],
  check_back: [
    { day: 30, pool: "ni_email" },
    { day: 60, pool: "ni_email" },
    { day: 90, pool: "ni_email" },
  ],
  report_pulled: [{ day: 0, pool: "pulled_sms" }],
  app_sent: [
    { day: 1, pool: "appchase_sms" },
    { day: 2, pool: "appchase_email" },
    { day: 4, pool: "appchase_sms" },
    { day: 7, pool: "appchase_email" },
    { day: 11, pool: "appchase_sms" },
    { day: 16, pool: "appchase_email" },
    { day: 21, pool: "appchase_sms" },
  ],
  submitted: [],
  pre_approved: [],
  contracts_out: [],
  funded: [],
  commission_paid: [],
  declined: [],
  offer_cr: [],
  referred_cr: [],
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
    hasBankAccount: r.has_bank_account || "",
    bestTime: r.best_time || "",
    nextStep: r.next_step || "",
    myscoreiqUsername: r.myscoreiq_username || "",
    myscoreiqPassword: r.myscoreiq_password || "",
    ssnLast4: r.ssn_last4 || "",
    reportPath: r.report_path || "",
    fundedAmount: r.funded_amount != null ? r.funded_amount : "",
    commissionAmount: r.commission_amount != null ? r.commission_amount : "",
    declineReason: r.decline_reason || "",
    loanProgram: r.loan_program || "",
    automationPaused: !!r.automation_paused,
    optedOut: !!r.opted_out,
    ownerEmail: r.owner_email || "",
    appointmentAt: r.appointment_at || "",
    product: r.product || "",
    lenderTag: r.lender_tag || "",
    snoozeUntil: r.snooze_until ? new Date(r.snooze_until).getTime() : null,
    fundedAt: r.funded_at ? new Date(r.funded_at).getTime() : null,
    commissionPaidAt: r.commission_paid_at ? new Date(r.commission_paid_at).getTime() : null,
    reportUploadedAt: r.report_uploaded_at ? new Date(r.report_uploaded_at).getTime() : null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    stageEnteredAt: r.stage_entered_at ? new Date(r.stage_entered_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
    linkSentAt: r.link_sent_at ? new Date(r.link_sent_at).getTime() : null,
    lastTouchAt: r.last_touch_at ? new Date(r.last_touch_at).getTime() : null,
    touches: Array.isArray(r.touches) ? r.touches : [],
    raw: r.raw || null,
    confirmedFields: Array.isArray(r.confirmed_fields) ? r.confirmed_fields : [],
    readAt: r.read_at ? new Date(r.read_at).getTime() : 0,
    documents: Array.isArray(r.documents) ? r.documents : [],
    submissions: Array.isArray(r.submissions) ? r.submissions : [],
  };
}
const FIELD_MAP = {
  name: "name", phone: "phone", email: "email", notes: "notes", source: "source", tags: "tags",
  status: "status", touches: "touches",
  opportunityName: "opportunity_name", pipelineStage: "pipeline_stage",
  desiredAmount: "desired_amount", creditScore: "estimated_credit_score", hasBankAccount: "has_bank_account",
  fundingPurpose: "funding_purpose", fundingTimeline: "funding_timeline", confirmedFields: "confirmed_fields",
  monthlyRevenue: "monthly_revenue", timeInBusiness: "time_in_business",
  businessName: "business_name", businessType: "business_type", einStatus: "ein_status",
  bestTime: "best_time", nextStep: "next_step",
  myscoreiqUsername: "myscoreiq_username", myscoreiqPassword: "myscoreiq_password", ssnLast4: "ssn_last4",
  reportPath: "report_path",
  fundedAmount: "funded_amount", commissionAmount: "commission_amount", declineReason: "decline_reason", loanProgram: "loan_program",
  automationPaused: "automation_paused", ownerEmail: "owner_email", product: "product", lenderTag: "lender_tag",
};
// Format a US phone as xxx-xxx-xxxx. Leaves anything that isn't 10/11 digits untouched.
function fmtPhone(v) {
  if (v == null) return v;
  let d = String(v).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return String(v).trim(); // unusual length: keep as-is rather than mangle
}

function leadPatchToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "phone") row.phone = fmtPhone(v);
    else if (k in FIELD_MAP) row[FIELD_MAP[k]] = v;
    else if (k === "linkSentAt") row.link_sent_at = v ? new Date(v).toISOString() : null;
    else if (k === "lastTouchAt") row.last_touch_at = v ? new Date(v).toISOString() : null;
    else if (k === "stageEnteredAt") row.stage_entered_at = v ? new Date(v).toISOString() : null;
    else if (k === "reportUploadedAt") row.report_uploaded_at = v ? new Date(v).toISOString() : null;
    else if (k === "fundedAt") row.funded_at = v ? new Date(v).toISOString() : null;
    else if (k === "commissionPaidAt") row.commission_paid_at = v ? new Date(v).toISOString() : null;
    else if (k === "readAt") row.read_at = v ? new Date(v).toISOString() : null;
    else if (k === "snoozeUntil") row.snooze_until = v ? new Date(v).toISOString() : null;
  }
  return row;
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";
const leadTitle = (l) => (l.businessName && l.businessName.trim()) || l.name || "Unnamed";

function normalizeSource(s) {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "Unknown";
  if (v.includes("google") || v.includes("gclid") || v.includes("adwords")) return "Google";
  if (v.includes("facebook") || v.includes("fb ") || v === "fb" || v.includes("fbclid") || v.includes("meta") || v.includes("instagram")) return "Facebook";
  if (v === "direct" || v.includes("direct traffic")) return "Direct";
  if (v.includes("referr")) return "Referral";
  // Anything else (form names like "...Qualification Form", website URLs, etc.) is not an ad source.
  return "Unknown";
}
const SOURCE_TONE = { Google: "bg-blue-100 text-blue-700", Facebook: "bg-indigo-100 text-indigo-700", Direct: "bg-slate-100 text-slate-600", Referral: "bg-emerald-100 text-emerald-700", Unknown: "bg-amber-100 text-amber-700" };
const SOURCE_CHOICES = ["Google", "Facebook", "Direct", "Referral", "Unknown"];

// ---- Origination tracker (folded in from the standalone ASAP tracker) ----
// Stored with NO database change: the current origination stage is the latest
// touch of kind "orig_stage"; report score/pull-date ride in touches of kind "orig_report".
const ORIG_STAGES = [
  { key: "new", label: "New", tone: "slate", group: "pipeline" },
  { key: "docs_incomplete", label: "Docs Incomplete", tone: "amber", group: "pipeline" },
  { key: "docs_in", label: "Docs In", tone: "blue", group: "pipeline" },
  { key: "underwriting", label: "Underwriting", tone: "indigo", group: "pipeline" },
  { key: "approved", label: "Approved", tone: "teal", group: "pipeline" },
  { key: "contracts_out", label: "Contracts Out", tone: "violet", group: "pipeline" },
  { key: "in_final", label: "In Final", tone: "purple", group: "pipeline" },
  { key: "funded", label: "Funded", tone: "emerald", group: "pipeline" },
  { key: "credit_partner", label: "Credit Partner", tone: "orange", group: "rescue" },
  { key: "cr_pitched", label: "Pitched", tone: "fuchsia", group: "credit_repair" },
  { key: "cr_scheduled", label: "Scheduled", tone: "pink", group: "credit_repair" },
  { key: "cr_purchased", label: "Purchased", tone: "emerald", group: "credit_repair" },
  { key: "dnq", label: "DNQ", tone: "rose", group: "dead" },
  { key: "declined", label: "Declined", tone: "rose", group: "dead" },
  { key: "merchant_decline", label: "Merchant Decline", tone: "rose", group: "dead" },
  { key: "killed_final", label: "Killed in Final", tone: "rose", group: "dead" },
  { key: "pitched_no_sale", label: "Pitched No Sale", tone: "rose", group: "dead" },
];
const ORIG_GROUPS = [
  ["pipeline", "Origination"],
  ["rescue", "Credit Partner"],
  ["credit_repair", "Credit Repair"],
  ["dead", "Dead"],
];
const MIN_FICO = 640;
const REPORT_DAYS = 7;
// Default origination stage from the contact-pipeline status, until the user moves it in the tracker.
const origDefaultFromStatus = (s) => ({
  funded: "funded", commission_paid: "funded",
  submitted: "underwriting", pre_approved: "approved", contracts_out: "contracts_out",
  agreement_signed: "in_final", getting_approvals: "approved",
  denied: "declined", declined: "declined",
  report_pulled: "docs_in", app_sent: "docs_incomplete", app_received: "docs_in", app_reports_received: "docs_in",
  looking_for_partner: "credit_partner", waiting_for_partner: "credit_partner",
  referred_cr: "cr_pitched", offer_cr: "cr_pitched", credit_repair: "cr_pitched",
}[s] || "new");
const origStageOf = (lead) => {
  const t = (lead.touches || []).filter((x) => x.kind === "orig_stage").sort((a, b) => b.at - a.at)[0];
  return (t && t.note) || origDefaultFromStatus(lead.status);
};
const origStageSince = (lead) => {
  const t = (lead.touches || []).filter((x) => x.kind === "orig_stage").sort((a, b) => b.at - a.at)[0];
  return t ? t.at : (lead.createdAt || null);
};
// Latest pulled report (real score + pull date), if one was logged in the tracker.
const origReport = (lead) => {
  const t = (lead.touches || []).filter((x) => x.kind === "orig_report").sort((a, b) => b.at - a.at)[0];
  if (!t || !t.note) return null;
  try { return JSON.parse(t.note); } catch { return null; }
};
const origReportDaysLeft = (rep) => {
  if (!rep || !rep.rd) return null;
  const pulled = new Date(rep.rd + "T12:00:00").getTime();
  return Math.ceil((pulled + REPORT_DAYS * 86400000 - Date.now()) / 86400000);
};
const leadSubName = (l) => ((l.businessName && l.businessName.trim()) ? l.name : "");

// Stable pseudo-random pick so a given lead+step always shows the same variant
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pickFrom(list, seed) { if (!list || !list.length) return null; return list[hashStr(String(seed)) % list.length]; }
// Rotate through a pool so a lead cycles every variant before any repeat.
// occurrence = which use of this pool it is (0,1,2...); base offsets per lead.
function pickRotate(list, leadId, pool, occurrence) {
  if (!list || !list.length) return null;
  const base = hashStr(leadId + ":" + pool);
  return list[(base + occurrence) % list.length];
}
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
// ---- Lender matching: parse the human-readable intake bands into comparable numbers ----
function parseMonthsInBiz(s) {
  if (!s) return null;
  const str = String(s).toLowerCase();
  const nums = (str.match(/\d+/g) || []).map(Number);
  if (!nums.length) return null;
  if (str.includes("year")) return nums[0] * 12; // "3+ Years" -> 36, "1-2 Years" -> 12 (conservative floor)
  return nums[0]; // "6 Months - 1 Year" -> 6
}
function parseMoneyLow(s) {
  if (!s) return null;
  const nums = (String(s).replace(/,/g, "").match(/\d+/g) || []).map(Number);
  return nums.length ? nums[0] : null; // lower bound of the band
}
function parseScoreLow(s) {
  if (!s) return null;
  const nums = (String(s).match(/\d{3}/g) || []).map(Number);
  return nums.length ? Math.min(...nums) : null; // conservative
}
// Rank saved lenders by fit for this lead. Each lender may carry: minScore, minMonths, minRevenue, needsBank.
function matchLenders(lead, lenders) {
  const score = parseScoreLow(lead.creditScore);
  const months = parseMonthsInBiz(lead.timeInBusiness);
  const rev = parseMoneyLow(lead.monthlyRevenue);
  const bank = lead.hasBankAccount || "";
  const evalOne = (l) => {
    const checks = [];
    let fail = false, unknown = false;
    const need = (label, min, val, fmt) => {
      if (!min) return;
      if (val == null) { checks.push({ k: label, s: "unknown" }); unknown = true; }
      else if (val >= min) { checks.push({ k: label, s: "pass", detail: fmt } ); }
      else { checks.push({ k: label, s: "fail", detail: fmt }); fail = true; }
    };
    need("Credit " + (l.minScore || ""), Number(l.minScore) || 0, score);
    need("Time " + (l.minMonths ? l.minMonths + "mo" : ""), Number(l.minMonths) || 0, months);
    need("Rev $" + (l.minRevenue ? Number(l.minRevenue).toLocaleString() : ""), Number(l.minRevenue) || 0, rev);
    if (l.needsBank) {
      const b = String(bank || "").trim().toLowerCase();
      if (!b) { checks.push({ k: "Bank acct", s: "unknown" }); unknown = true; }
      else if (b[0] === "y") { checks.push({ k: "Bank acct", s: "pass" }); }
      else { checks.push({ k: "Bank acct", s: "fail" }); fail = true; }
    }
    const status = fail ? "no" : (unknown ? "maybe" : "fit");
    return { lender: l, status, checks, passCount: checks.filter((c) => c.s === "pass").length };
  };
  const order = { fit: 0, maybe: 1, no: 2 };
  return (lenders || []).map(evalOne).sort((a, b) => (order[a.status] - order[b.status]) || (b.passCount - a.passCount));
}

function fillTokens(text, lead, config) {
  const rep = repInfo(lead, config);
  return (text || "")
    .replaceAll("{{opener}}", callOpener(lead))
    .replaceAll("{{first}}", firstName(lead.name))
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{link}}", config.reportLink || "[set your MyScoreIQ link in Settings]")
    .replaceAll("{{smartcredit}}", config.smartCreditLink || "https://www.smartcredit.com/?PID=52188")
    .replaceAll("{{applink}}", config.appLink || APP_LINK_DEFAULT)
    .replaceAll("{{repfirst}}", rep.first)
    .replaceAll("{{signature}}", rep.signature);
}
// Resolve the rep working this lead (their first name + email signature). Falls back to defaults.
function repInfo(lead, config) {
  const team = (config && config.team) || [];
  const owner = (lead && (lead.ownerEmail || lead.owner_email)) || "";
  const m = team.find((t) => (t.email || "").toLowerCase() === owner.toLowerCase());
  return {
    first: (m && m.first) || (config && config.defaultRepFirst) || "Joe",
    signature: (m && m.signature) || (config && config.signature) || "Joe at ASAP Funding USA",
  };
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
const APP_LINK_DEFAULT = "https://tranquil-muffin-691d4e.netlify.app/apply.html";
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
const STAGE_PLAYBOOK = {
  new: [
    "Call the lead now (use the Call button).",
    "Log what happened: no answer, or spoke to them.",
    "If no answer, the voicemail campaign starts automatically.",
    "If you spoke to them, pick Interested, Call back, or Not interested.",
  ],
  voicemail: [
    "Try calling again if you have time.",
    "Send the due follow-up texts and emails (they drive a callback).",
    "When they respond, log the call and move them to Interested.",
  ],
  interested: [
    "Send the MyScoreIQ link so they can pull their report (Text link / Email link).",
    "Next day, send the 'did you create your account?' follow-up.",
    "If they cannot access MyScoreIQ, send the SmartCredit backup link.",
    "Once the report is in, upload it and move to Report Pulled.",
  ],
  callback: [
    "Call them back at the time you agreed.",
    "Log the call with notes on what happened.",
    "If they are ready, move them to Interested and send the link.",
  ],
  not_interested: [
    "Leave them in the light nurture, no action needed.",
    "If they re-engage, move them back to Interested.",
  ],
  report_pulled: [
    "Review the credit report.",
    "Decide the likely loan program (top of file).",
    "Submit to Torro, or send the client the application if they want more.",
  ],
  app_sent: [
    "Application has been emailed to the client.",
    "Chase the signed application back (auto follow-ups are running).",
    "When it comes back, submit to Torro and move to Submitted.",
  ],
  submitted: [
    "Wait for Torro's response.",
    "When it comes back, mark Approved or Declined under Outcome from Torro.",
  ],
  pre_approved: [
    "Review the offer with the client.",
    "If they want more, send the application.",
    "When they accept, click 'Client accepted, contracts out'.",
  ],
  contracts_out: [
    "Make sure contracts get signed.",
    "Once funded, click 'Mark funded' and enter the amounts.",
  ],
  funded: [
    "Enter the funded amount and your commission.",
    "When Torro pays you, click 'Mark commission paid'.",
  ],
  declined: [
    "Note the decline reason.",
    "If it's credit, offer the credit accelerator and move to Offer Credit Repair. Otherwise revisit later.",
  ],
  offer_cr: [
    "Pitch the credit accelerator using the script (top of Scripts tab).",
    "Never say 'credit repair'. Lead with getting them approval-ready in 60 to 120 days.",
    "When they agree, move to Referred to Credit Repair.",
  ],
  referred_cr: [
    "Hand the client off to the credit repair team (live transfer or booked consult).",
    "Confirm they connected and enrolled.",
    "Once enrolled, move to In Credit Repair.",
  ],
  credit_repair: [
    "Client is enrolled and working to get approval-ready.",
    "Check back as their credit improves, then re-approach for funding.",
  ],
};

function nextStepFor(lead) {
  switch (lead.status) {
    case "new": return { text: "Call them. Log what happens below and the right campaign starts on its own.", tone: "slate" };
    case "voicemail": return { text: "Couldn't reach them. Callback texts and emails are going out. Try them again, or send the next when due.", tone: "amber" };
    case "interested": return { text: "They're in. Send the MyScoreIQ link so they can pull their report and get pre-approved.", tone: "sky" };
    case "callback": return { text: "Reconnect when you agreed. Reminder messages are running until you reach them.", tone: "violet" };
    case "not_interested": return { text: "Parked. Light check-ins go out in case their timing changes.", tone: "orange" };
    case "check_back": return { text: "Needs funding but wants to pause. Gentle check-ins go out every 30 days. Snooze or set a reminder for when they said to circle back.", tone: "blue" };
    case "report_pulled": return { text: "Report is in. Set the Product (SLOC/MCA), then send the application or submit to a lender.", tone: "teal" };
    case "app_sent": return { text: "Application sent. Chase the signed app + documents back, then submit to a lender.", tone: "purple" };
    case "submitted": return { text: "Submitted. Tag the lender you sent to and wait on their response. If more than one, use best-fit to pick the next.", tone: "indigo" };
    case "denied": return { text: "Lender denied. Try the next best-fit lender, or if it's a credit issue, offer Credit Repair.", tone: "rose" };
    case "pre_approved": return { text: "Approved. Review the offer with the client. When they accept, send the agreement for signature.", tone: "cyan" };
    case "contracts_out": return { text: "Agreement is out for signature. Once they sign, move to Agreement Signed.", tone: "amber" };
    case "agreement_signed": return { text: "Signed. Working through the lender's final approvals and verifications.", tone: "lime" };
    case "getting_approvals": return { text: "Final approvals in progress. Once cleared and funded, mark Client Funded.", tone: "sky" };
    case "funded": return { text: "Funded. Enter the funded amount and your commission, then mark Commission Paid when you're paid.", tone: "emerald" };
    case "commission_paid": return { text: "Paid in full. This one's done.", tone: "yellow" };
    case "declined": return { text: "Torro declined. Note the reason, then offer them Credit Repair to get approval-ready, or revisit later.", tone: "pink" };
    case "offer_cr": return { text: "Pitch the credit accelerator (use the script). Never say credit repair, lead with getting approval-ready in 60 to 120 days. Move to Referred when they say yes.", tone: "violet" };
    case "referred_cr": return { text: "They said yes. Hand off to the credit repair team (live transfer or booked consult). Move to In Credit Repair once they're enrolled.", tone: "fuchsia" };
    case "credit_repair": return { text: "Enrolled in credit repair, working to get approval-ready. Check back as their credit improves, then re-approach for funding.", tone: "purple" };
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

// Build the cadence step list for a lead's current stage.
// SEQUENTIAL: each step's clock starts when the PREVIOUS step was actually sent,
// not from absolute calendar days. So only one step is ever "due" at a time,
// and a lead that sat idle does not show a wall of overdue steps.
function cadenceSteps(lead, cadences, templates) {
  const steps = cadences[lead.status] || [];
  const entered = lead.stageEnteredAt || lead.createdAt;
  const snooze = lead.snoozeUntil || 0;
  const touches = lead.touches || [];
  // when each step index was actually sent (and whether the system sent it)
  const sentInfo = {};
  touches.forEach((t) => {
    if (t.kind === "cadence" && t.stage === lead.status && t.at >= entered - 5000) {
      sentInfo[t.step] = { at: t.at, auto: !!t.auto };
    }
  });

  let anchor = entered; // time the next gap counts from
  let prevDay = 0;
  let dueAssigned = false;
  const poolOcc = {}; // how many times each pool has appeared so far
  const lastTouch = lead.lastTouchAt || 0; // any recent interaction pushes the next step out

  return steps.map((s, i) => {
    const occ = (poolOcc[s.pool] = (poolOcc[s.pool] ?? -1) + 1);
    const tpl = s.pool
      ? pickRotate(poolTemplates(templates, s.pool), lead.id, s.pool, occ)
      : templates.find((t) => t.id === s.templateId);
    const sent = sentInfo[i];
    let state, dueAt = null;
    if (sent) {
      state = "sent";
      anchor = sent.at;          // next step's gap counts from the real send time
      prevDay = s.day;
    } else {
      const gap = Math.max(0, s.day - prevDay) * DAY;
      dueAt = Math.max(Math.max(anchor, lastTouch) + gap, snooze);
      if (!dueAssigned) { state = "due"; dueAssigned = true; }
      else state = "waiting";    // later steps wait until the due one is sent
    }
    return { i, day: s.day, template: tpl, channel: tpl?.channel, dueAt, state, sent, done: !!sent };
  });
}
function nextDue(lead, cadences, templates) {
  if (lead.automationPaused) return null; // paused: nothing is ever due
  const step = cadenceSteps(lead, cadences, templates).find((s) => s.state === "due" && s.template);
  return step || null;
}

// Send through the in-app backend (RingCentral / Outlook). Requires login.
// Retries automatically on rate-limit responses so batches don't fail.
async function apiSend(path, payload, attempt = 0) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  let j = {};
  try { j = await res.json(); } catch { /* ignore */ }
  const rateLimited = res.status === 429 || /rate.*exceed|too many|429/i.test(j.error || "");
  if (rateLimited && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); // 1.5s, 3s, 4.5s, 6s
    return apiSend(path, payload, attempt + 1);
  }
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

// Simplified linear journey shown as a stepper at the top of a lead
const JOURNEY = [
  { key: "new", label: "New", match: ["new", "called"] },
  { key: "contacted", label: "Contacted", match: ["voicemail", "callback", "not_interested"] },
  { key: "interested", label: "Interested", match: ["interested"] },
  { key: "booked", label: "Booked", match: ["appointment_booked"] },
  { key: "report", label: "Report", match: ["waiting_reports", "report_pulled"] },
  { key: "app_sent", label: "App Sent", match: ["app_sent"] },
  { key: "app_in", label: "App In", match: ["app_received", "app_reports_received"] },
  { key: "submitted", label: "Submitted", match: ["submitted", "looking_for_partner", "waiting_for_partner"] },
  { key: "decision", label: "Decision", match: ["pre_approved", "contracts_out", "declined"] },
  { key: "funded", label: "Funded", match: ["funded", "commission_paid"] },
];
function journeyIndex(status) {
  const i = JOURNEY.findIndex((j) => j.match.includes(status));
  return i === -1 ? 0 : i;
}
function StageStepper({ status }) {
  const special = status === "declined" || status === "credit_repair" || status === "dead";
  const current = journeyIndex(status);
  return (
    <div className="flex items-center">
      {JOURNEY.map((j, i) => {
        const done = i < current;
        const here = i === current;
        const isDecisionDeclined = j.key === "decision" && status === "declined";
        const dotCls = isDecisionDeclined
          ? "bg-rose-500 text-white ring-rose-500"
          : here ? "bg-blue-600 text-white ring-blue-600"
          : done ? "bg-blue-100 text-blue-700 ring-blue-200"
          : "bg-white text-slate-300 ring-slate-200";
        return (
          <div key={j.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-2 ${dotCls}`}>
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span className={`mt-1 whitespace-nowrap text-[10px] font-medium ${here ? (isDecisionDeclined ? "text-rose-600" : "text-blue-700") : done ? "text-slate-500" : "text-slate-300"}`}>
                {isDecisionDeclined ? "Declined" : j.label}
              </span>
            </div>
            {i < JOURNEY.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-blue-200" : "bg-slate-100"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// The talk track Lydia uses when a lead is declined for credit reasons
function AcceleratorScript({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60">
      <button onClick={() => setOpen((s) => !s)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <ListChecks size={15} className="text-fuchsia-600" />
        <span className="text-sm font-bold text-fuchsia-800">Script: turn this decline into a yes</span>
        <ChevronDown size={16} className={`ml-auto text-fuchsia-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-fuchsia-200 px-4 py-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Never say "credit repair." Never quote price. Goal: transfer or book a consultation.</p>

          <div><span className="font-semibold text-slate-800">1. Deliver it, keep momentum:</span> "Based on where your credit sits right now, the lenders aren't in a position to approve you just yet. But this is common and it's fixable. We have a way to get you approval-ready, usually in about 60 to 120 days."</div>

          <div><span className="font-semibold text-slate-800">2. Reframe:</span> "A no today is almost never a no forever. It usually comes down to a few things on your report dragging your profile down. Once that's cleaned up and your credit is built back up, lenders start saying yes."</div>

          <div><span className="font-semibold text-slate-800">3. What we do:</span> "We work two sides at once. We go through your report and work to remove the negative and inaccurate items holding you back, and we help you build your credit back up the right way. That combination is what gets you from a no to approved. And we move fast, most clients are looking at 60 to 120 days."</div>

          <div><span className="font-semibold text-slate-800">4. Trust:</span> "I talk to owners every day who were exactly where you are, got told no, and a few months later they're getting approved for the funding they needed."</div>

          <div><span className="font-semibold text-slate-800">5. Ask for the yes:</span> "Does that sound like something you'd want to get set up so you can finally get approved?"</div>

          <div className="rounded-lg bg-white p-2.5 ring-1 ring-fuchsia-200">
            <span className="font-semibold text-fuchsia-800">6. Hand off.</span> If a specialist is free: "Let me connect you right now, stay right there with me." Then introduce: "I've got [name] here, they went through funding and we need to get their credit approval-ready so we can get them funded." If nobody's free: book the consultation and confirm their callback number.
          </div>

          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">Common pushbacks</summary>
            <div className="mt-1.5 space-y-1.5">
              <div><b>Cost?</b> "That's exactly what the specialist goes over, they build the plan around what you actually need. That's why I want to connect you."</div>
              <div><b>Need to think?</b> "Fair, the specialist call is free with no obligation, worst case you walk away knowing exactly what your path to approved looks like."</div>
              <div><b>Is this credit repair?</b> "It's a full approval-readiness program, we work on removing what's hurting your report and building your credit back up. The specialist walks you through it."</div>
              <div><b>Will it hurt my credit?</b> "No, everything we do is designed to strengthen your profile, not hurt it."</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
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

// Editable chip: looks like the blue pill, click to edit inline, saves back to a chip.
function EditChip({ label, value, onChange, confirmed, onConfirm, placeholder }) {
  const [editing, setEditing] = useState(false);
  const hasValue = value != null && String(value).trim() !== "";
  const needs = hasValue && !confirmed;
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 ring-1 ring-inset ring-blue-300">
        <span className="text-[11px] text-blue-500">{label}</span>
        <input autoFocus value={value || ""} onChange={onChange} onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
          placeholder={placeholder} className="w-28 bg-transparent text-xs font-semibold text-slate-800 outline-none" />
      </span>
    );
  }
  return (
    <button onClick={() => setEditing(true)} title="Click to edit"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset transition ${needs ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-800 ring-blue-100 hover:bg-blue-100"}`}>
      <span className={needs ? "text-amber-500" : "text-blue-500"}>{label}</span>
      <span className="font-semibold">{hasValue ? value : <span className="font-normal italic opacity-60">add</span>}</span>
      {needs && <AlertCircle size={9} className="text-amber-500" onClick={(e) => { e.stopPropagation(); onConfirm(); }} />}
      {hasValue && confirmed && <Check size={9} className="text-emerald-500" />}
    </button>
  );
}

// Compact editable field for the top info bar. Amber flag until confirmed; editing auto-confirms.
function TopField({ label, value, onChange, confirmed, onConfirm, placeholder }) {
  const hasValue = value != null && String(value).trim() !== "";
  const needs = hasValue && !confirmed;
  return (
    <div className={`flex flex-col rounded-lg border px-2.5 py-1.5 ${needs ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        {hasValue && (confirmed
          ? <Check size={11} className="text-emerald-500" />
          : <button type="button" onClick={onConfirm} title="Confirm this is current"><AlertCircle size={11} className="text-amber-500" /></button>)}
      </div>
      <input value={value || ""} onChange={onChange} placeholder={placeholder} className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300" />
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

// A labeled input that shows a "confirm with client" flag until verified.
// Editing the value auto-confirms it.
function ConfirmField({ label, value, onChange, confirmed, onConfirm, placeholder }) {
  const hasValue = value != null && String(value).trim() !== "";
  const needsConfirm = hasValue && !confirmed;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        {hasValue && (confirmed ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600"><Check size={10} /> confirmed</span>
        ) : (
          <button type="button" onClick={onConfirm} title="Confirm this is current" className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-200"><AlertCircle size={10} /> confirm</button>
        ))}
      </div>
      <input value={value || ""} onChange={onChange} placeholder={placeholder} className={`${inputCls} ${needsConfirm ? "border-amber-300 bg-amber-50/40" : ""}`} />
    </div>
  );
}

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
  const [lenders, setLenders] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [cadences, setCadences] = useState(DEFAULT_CADENCES);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [profileId, setProfileId] = useState(null);
  // New-message alerts: sound + browser notification + tab-title flash for Lydia and the team.
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem("asap_sound") !== "off"; } catch { return true; } });
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; try { localStorage.setItem("asap_sound", soundOn ? "on" : "off"); } catch {} }, [soundOn]);
  const titleFlash = useRef(null);
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") { try { Notification.requestPermission(); } catch {} }
  }, []);
  const playBeep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.36);
      o.onended = () => ctx.close();
    } catch {}
  }, []);
  const notifyNewMessage = useCallback((row) => {
    if (soundOnRef.current) playBeep();
    // Tab-title flash so it's obvious even on another tab
    const original = "ASAP Funding";
    let on = true, count = 0;
    if (titleFlash.current) clearInterval(titleFlash.current);
    titleFlash.current = setInterval(() => {
      document.title = on ? "\ud83d\udd14 New message" : original; on = !on;
      if (++count > 10) { clearInterval(titleFlash.current); document.title = original; }
    }, 700);
    const clear = () => { if (titleFlash.current) { clearInterval(titleFlash.current); document.title = original; } window.removeEventListener("focus", clear); };
    window.addEventListener("focus", clear);
    // Browser notification (works even when the tab is in the background)
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification("New message received", { body: (row.body || "").slice(0, 120) || "A client just replied.", tag: "asap-msg" });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch {}
  }, [playBeep]);
  // Shareable deal links: keep the open profile in sync with the URL hash (#/lead/<id>).
  useEffect(() => {
    const applyHash = () => {
      const m = window.location.hash.match(/#\/lead\/([\w-]+)/);
      if (m) setProfileId(m[1]);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);
  useEffect(() => {
    if (profileId) {
      if (!window.location.hash.includes(profileId)) window.history.replaceState(null, "", `#/lead/${profileId}`);
    } else if (window.location.hash.startsWith("#/lead/")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [profileId]);
  const [compose, setCompose] = useState(null);
  const [live, setLive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [comms, setComms] = useState([]);
  const [activities, setActivities] = useState([]);
  // keep the auto-snooze setting available inside stable callbacks
  const autoSnoozeDaysRef = useRef(3);

  const refetchComms = useCallback(async () => {
    const { data } = await supabase.from("communications").select("*").order("at", { ascending: false }).limit(2000);
    if (data) setComms(data);
  }, []);

  const refetchActivities = useCallback(async () => {
    const { data } = await supabase.from("activities").select("*").order("due_at", { ascending: true });
    if (data) setActivities(data);
  }, []);

  const refetchLeads = useCallback(async () => {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setLeads(data.map(rowToLead));
  }, []);

  // Live updates: poll every 15s so inbound texts/emails, new leads, and server-created
  // alarms (like new-lead alerts) appear without a manual refresh, and refresh on tab focus.
  useEffect(() => {
    const pingBooking = () => { try { fetch("/.netlify/functions/run-booking", { method: "POST", keepalive: true }).catch(() => {}); } catch { /* best effort */ } };
    const tick = () => { if (!document.hidden) { refetchComms(); refetchActivities(); refetchLeads(); pingBooking(); } };
    const id = setInterval(tick, 15000);
    const onVisible = () => { if (!document.hidden) { refetchComms(); refetchActivities(); refetchLeads(); } };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [refetchComms, refetchActivities, refetchLeads]);

  // Fire the new-message alert whenever a newer inbound appears in comms (realtime OR poll).
  const lastInboundRef = useRef(null);
  useEffect(() => {
    if (!comms || comms.length === 0) return;
    let newest = null;
    for (const c of comms) {
      if (c.direction !== "in") continue;
      const t = new Date(c.at).getTime();
      if (!newest || t > newest.t) newest = { t, c };
    }
    if (!newest) return;
    if (lastInboundRef.current === null) { lastInboundRef.current = newest.t; return; }
    if (newest.t > lastInboundRef.current) { lastInboundRef.current = newest.t; notifyNewMessage(newest.c); }
  }, [comms, notifyNewMessage]);

  // Debounce realtime reloads so a burst of changes (or our own autosaves)
  // coalesces into one refetch instead of re-rendering on every keystroke-save.
  const refetchTimers = useRef({});
  const debouncedRefetch = useCallback((key, fn, ms = 1500) => {
    clearTimeout(refetchTimers.current[key]);
    refetchTimers.current[key] = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const keys = ["config", "templates", "cadences", "lenders"];
        const { data } = await supabase.from("app_config").select("key,value").in("key", keys);
        const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
        if (map.config) setConfig({ ...DEFAULT_CONFIG, ...map.config });
        else await supabase.from("app_config").upsert({ key: "config", value: DEFAULT_CONFIG });
        if (map.templates) setTemplates(map.templates);
        else await supabase.from("app_config").upsert({ key: "templates", value: DEFAULT_TEMPLATES });
        if (map.cadences) setCadences(map.cadences);
        else await supabase.from("app_config").upsert({ key: "cadences", value: DEFAULT_CADENCES });
        if (map.lenders) setLenders(map.lenders);
        await refetchLeads();
        // these tables are optional: if the migration has not run yet, ignore
        try { await refetchComms(); await refetchActivities(); } catch { /* not migrated yet */ }
      } catch (e) { setErr(String(e.message || e)); }
      finally { setLoaded(true); }
    })();
    const channel = supabase.channel("leads-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => debouncedRefetch("leads", refetchLeads))
      .on("postgres_changes", { event: "*", schema: "public", table: "communications" }, () => debouncedRefetch("comms", refetchComms, 800))
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => debouncedRefetch("acts", refetchActivities, 800))
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [refetchLeads, refetchComms, refetchActivities, debouncedRefetch]);

  useEffect(() => { autoSnoozeDaysRef.current = config.autoSnoozeDays ?? 3; }, [config.autoSnoozeDays]);

  const saveConfigKey = useCallback(async (key, value) => {
    await supabase.from("app_config").upsert({ key, value });
  }, []);
  const persistConfig = useCallback(async (next) => { setConfig(next); await saveConfigKey("config", next); }, [saveConfigKey]);
  const persistTemplates = useCallback(async (next) => { setTemplates(next); await saveConfigKey("templates", next); }, [saveConfigKey]);
  const persistCadences = useCallback(async (next) => { setCadences(next); await saveConfigKey("cadences", next); }, [saveConfigKey]);
  const persistLenders = useCallback(async (next) => { setLenders(next); await saveConfigKey("lenders", next); }, [saveConfigKey]);

  const updateLead = useCallback(async (id, patch) => {
    let finalPatch = patch;
    setLeads((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const p = { ...patch };
      // Only reset the cadence clock when the stage genuinely changes.
      if ("status" in patch && patch.status !== l.status) {
        p.stageEnteredAt = Date.now();
        p.lastTouchAt = Date.now();
        // Whoever first works the lead owns it (sticky: do not steal an existing owner).
        if (userEmail && !l.ownerEmail) p.ownerEmail = userEmail;
        // Moving a lead to Report Pulled means we obtained their credit report: log it for tracking.
        if (patch.status === "report_pulled") {
          p.touches = [...(l.touches || []), { at: Date.now(), kind: "report", by: userEmail || (l.ownerEmail || "") }];
        }
      }
      finalPatch = p;
      return { ...l, ...p };
    }));
    const row = leadPatchToRow(finalPatch);
    if (Object.keys(row).length) {
      const { error } = await supabase.from("leads").update(row).eq("id", id);
      if (error) setErr(error.message);
    }
  }, [userEmail]);

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
      // A real human touch (a logged call, or a note) means we are mid-conversation.
      // Push the next automated message out so we do not blast them.
      if (kind === "call" || extra.note) {
        const days = Number(autoSnoozeDaysRef.current) || 0;
        if (days > 0) patch.snoozeUntil = now + days * DAY;
      }
      // First person to work the lead (call, message, or note) becomes the owner.
      // Sticky: once set, a later touch by someone else does not steal it.
      if (!l.ownerEmail && userEmail) patch.ownerEmail = userEmail;
      computed = patch;
      return { ...l, ...patch };
    }));
    if (computed) {
      const { error } = await supabase.from("leads").update(leadPatchToRow(computed)).eq("id", id);
      if (error) setErr(error.message);
    }
  }, [userEmail]);

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

  const handleSent = useCallback((sent) => {
    setCompose((c) => {
      if (c && !c.lead) {
        // Standalone message to any number, nothing to log against a client.
        return null;
      }
      if (c) {
        const sentTo = (sent && sent.to) || c.to || null;
        const alt = sent && sent.altRecipient;
        logTouch(c.lead.id, c.channel, c.kind, { ...(c.extra || {}), ...(alt ? { note: `Sent to alternate ${c.channel === "sms" ? "number" : "email"}: ${sentTo}` } : {}) });
        // keep a full copy of what went out, so the thread reads like a conversation
        if (sent && sent.viaApp) {
          supabase.from("communications").insert({
            lead_id: c.lead.id,
            direction: "out",
            channel: c.channel,
            subject: sent.subject || null,
            body: (alt ? `[to ${sentTo}] ` : "") + (sent.body || ""),
            to_addr: sentTo,
            by_user: userEmail,
          }).then(({ error }) => { if (!error) refetchComms(); });
        }
        if (c.afterSent) c.afterSent();
        // If this message contained the application link, advance the lead to Application Sent.
        const appUrl = (config.appLink || APP_LINK_DEFAULT || "").toLowerCase();
        const bodyLc = String((sent && sent.body) || c.body || "").toLowerCase();
        const sentApp = (appUrl && bodyLc.includes(appUrl)) || bodyLc.includes("apply.html");
        const early = ["new", "voicemail", "interested", "callback", "check_back", "report_pulled"];
        if (sentApp && early.includes(c.lead.status)) {
          supabase.from("leads").update({ status: "app_sent" }).eq("id", c.lead.id).then(() => {});
          setLeads((prev) => prev.map((l) => l.id === c.lead.id ? { ...l, status: "app_sent" } : l));
        }
      }
      return null;
    });
  }, [logTouch, userEmail, refetchComms]);

  const addActivity = useCallback(async (leadId, act) => {
    const { error } = await supabase.from("activities").insert({
      lead_id: leadId, type: act.type, title: act.title || null, notes: act.notes || null,
      due_at: new Date(act.dueAt).toISOString(), created_by: userEmail, assigned_to: act.assignedTo || userEmail,
      alarm: !!act.alarm,
    });
    if (error) setErr(error.message); else refetchActivities();
  }, [userEmail, refetchActivities]);

  const updateActivity = useCallback(async (id, patch) => {
    const { error } = await supabase.from("activities").update(patch).eq("id", id);
    if (error) setErr(error.message); else refetchActivities();
  }, [refetchActivities]);

  const snoozeActivity = useCallback(async (id, mins) => {
    const { error } = await supabase.from("activities").update({ due_at: new Date(Date.now() + mins * 60000).toISOString() }).eq("id", id);
    if (error) setErr(error.message); else refetchActivities();
  }, [refetchActivities]);

  const completeActivity = useCallback(async (id, done = true) => {
    const { error } = await supabase.from("activities")
      .update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    if (error) setErr(error.message); else refetchActivities();
  }, [refetchActivities]);

  const deleteActivity = useCallback(async (id) => {
    await supabase.from("activities").delete().eq("id", id);
    refetchActivities();
  }, [refetchActivities]);

  // Reply to a lead from inside the app (text or email). Sends, then logs it.
  const sendReply = useCallback(async (lead, channel, subject, body) => {
    const to = channel === "sms" ? lead.phone : lead.email;
    await sendMessage(channel, to, subject, body); // throws on failure, surfaced by caller
    await supabase.from("communications").insert({
      lead_id: lead.id, direction: "out", channel,
      subject: subject || null, body, to_addr: to || null, by_user: userEmail,
    });
    logTouch(lead.id, channel, "reply", {});
    refetchComms();
  }, [userEmail, logTouch, refetchComms]);

  // Add a free-text note that lands in the client's timeline
  const addNote = useCallback(async (lead, text) => {
    if (!text || !text.trim()) return;
    // Store on the lead record first (this path is reliable and surfaces its own errors),
    // so the note is preserved even if the communications insert is blocked.
    logTouch(lead.id, "note", "note", { note: text.trim(), by: userEmail });
    const { error } = await supabase.from("communications").insert({
      lead_id: lead.id, direction: "out", channel: "note", body: text.trim(), by_user: userEmail,
    });
    if (error) {
      setErr("Note saved to the client record, but could not post to the timeline: " + error.message);
      return false;
    }
    refetchComms();
    return true;
  }, [userEmail, logTouch, refetchComms]);

  // Leads that replied are handled by a human (in the Inbox), not the auto-cadence.
  const repliedIds = useMemo(() => {
    const s = new Set();
    comms.forEach((c) => { if (c.direction === "in") s.add(c.lead_id); });
    return s;
  }, [comms]);

  const dueList = useMemo(() => (
    leads
      .filter((l) => !l.optedOut && !l.automationPaused && !repliedIds.has(l.id) && !(l.snoozeUntil && l.snoozeUntil > Date.now()))
      .map((l) => ({ l, step: nextDue(l, cadences, templates) }))
      .filter((x) => x.step && x.step.dueAt <= Date.now() + DAY)
      .sort((a, b) => a.step.dueAt - b.step.dueAt)
  ), [leads, cadences, templates, repliedIds]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, "");
    return leads.filter((l) => {
      if (filter === "active" && ["funded", "commission_paid", "dead", "credit_repair", "not_interested"].includes(l.status)) return false;
      if (filter !== "active" && filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      const hay = (l.name + l.phone + l.email + l.notes + l.source + l.businessName + l.opportunityName + l.desiredAmount + l.monthlyRevenue + l.creditScore + l.timeInBusiness + l.tags).toLowerCase();
      if (hay.includes(q)) return true;
      // Phone: match on digits only, so "(904) 762-3986", "904-762-3986", "9047623986" all work.
      if (qDigits.length >= 3) {
        const phoneDigits = (l.phone || "").replace(/\D/g, "");
        if (phoneDigits.includes(qDigits)) return true;
      }
      return false;
    }).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  }, [leads, query, filter]);

  const stats = useMemo(() => {
    const by = {}; STAGES.forEach((s) => (by[s.key] = 0));
    leads.forEach((l) => (by[l.status] = (by[l.status] || 0) + 1));
    return by;
  }, [leads]);

  const profileLead = leads.find((l) => l.id === profileId) || null;

  const actAlerts = useMemo(() => activities.filter((a) => !a.done && ["overdue", "today"].includes(actBucket(a))).length, [activities]);

  // A lead is "unread" when they sent us a message more recently than we last read it.
  const unreadLeadIds = useMemo(() => {
    const lastIn = {};
    for (const c of comms) {
      if (c.direction !== "in") continue;
      const t = new Date(c.at).getTime();
      if (!lastIn[c.lead_id] || t > lastIn[c.lead_id]) lastIn[c.lead_id] = t;
    }
    const readMap = {};
    leads.forEach((l) => { readMap[l.id] = l.readAt || 0; });
    return new Set(Object.entries(lastIn).filter(([id, t]) => t > (readMap[id] || 0)).map(([id]) => id));
  }, [comms, leads]);

  const markRead = useCallback((id) => {
    updateLead(id, { readAt: Date.now() });
  }, [updateLead]);
  const markAllRead = useCallback(() => {
    unreadLeadIds.forEach((id) => updateLead(id, { readAt: Date.now() }));
  }, [unreadLeadIds, updateLead]);

  // Applications that have come in but haven't been sent to a lender yet (the queue that needs action).
  const newAppsCount = useMemo(() => {
    return leads.filter((l) => {
      const docs = Array.isArray(l.documents) ? l.documents : [];
      const hasApp = docs.some((d) => /application/i.test((d.label || "") + (d.name || ""))) || ["app_sent", "app_received", "app_reports_received", "submitted", "pre_approved", "contracts_out", "funded"].includes(l.status);
      const sentToLender = (Array.isArray(l.submissions) ? l.submissions : []).length > 0;
      return hasApp && !sentToLender;
    }).length;
  }, [leads]);

  if (!loaded) return <div className="flex min-h-96 items-center justify-center font-sans text-slate-400">Loading your pipeline...</div>;

  const NAV = [["pipeline", "Pipeline", LayoutGrid], ["tracker", "Tracker", TrendingUp], ["inbox", "Inbox", MessageSquare], ["applications", "Applications", FileText], ["activities", "Activities", CalendarClock], ["calendar", "Calendar", CalendarDays], ["followups", "Follow-ups", Clock], ["commissions", "Commissions", DollarSign], ["team", "Team", User], ["messaging", "Templates", FileText], ["scripts", "Scripts", ListChecks], ["settings", "Settings", SettingsIcon]];
  const tabTitle = { pipeline: "Pipeline", tracker: "Origination tracker", inbox: "Inbox", activities: "Activities", followups: "Follow-ups", commissions: "Commissions", team: "Team activity", messaging: "Message templates", scripts: "Call scripts", settings: "Settings" }[tab];

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
              {k === "followups" && dueList.length > 0 && (
                <span className="ml-auto hidden rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white md:inline">{dueList.length}</span>
              )}
              {k === "activities" && actAlerts > 0 && (
                <span className="ml-auto hidden rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white md:inline">{actAlerts}</span>
              )}
              {k === "inbox" && unreadLeadIds.size > 0 && (
                <span className="ml-auto hidden rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white md:inline">{unreadLeadIds.size}</span>
              )}
              {k === "applications" && newAppsCount > 0 && (
                <span className="ml-auto hidden rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white md:inline">{newAppsCount}</span>
              )}
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
            {tab === "followups" && dueList.length > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{dueList.length}</span>}
            {tab === "activities" && actAlerts > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{actAlerts} due</span>}
            {tab === "inbox" && unreadLeadIds.size > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{unreadLeadIds.size} unread</span>}
            {tab === "applications" && newAppsCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{newAppsCount} to send</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setSoundOn((v) => !v); if (!soundOn) playBeep(); }} title={soundOn ? "New-message sound is ON (click to mute)" : "New-message sound is OFF (click to turn on)"} className={`rounded-lg p-2 ${soundOn ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 hover:bg-slate-100"}`}>
              {soundOn ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <button onClick={() => { setTab("pipeline"); setShowAdd(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} /> <span className="hidden sm:inline">Add client</span></button>
          </div>
        </header>

        <div className="px-5 pb-10">
          {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"><AlertCircle size={16} /> {err}</div>}

          {tab === "pipeline" && (
            <Pipeline leads={filtered} allLeads={leads} allCount={leads.length} dueList={dueList} stats={stats} config={config}
              query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} showAdd={showAdd} setShowAdd={setShowAdd}
              addLead={addLead} onOpen={setProfileId} logTouch={logTouch} updateLead={updateLead} cadences={cadences} templates={templates} openCompose={setCompose}
              onGoFollowups={() => setTab("followups")} removeLead={removeLead} />
          )}
          {tab === "followups" && <Followups dueList={dueList} config={config} onOpen={setProfileId} openCompose={setCompose} updateLead={updateLead} />}
          {tab === "inbox" && <Conversations leads={leads} comms={comms} unreadLeadIds={unreadLeadIds} onSend={sendReply} onAddNote={addNote} onOpen={setProfileId} markRead={markRead} markAllRead={markAllRead} templates={templates} config={config} openCompose={setCompose} />}
          {tab === "tracker" && <Tracker leads={leads} config={config} onOpen={setProfileId} logTouch={logTouch} userEmail={userEmail} />}
          {tab === "activities" && <Activities activities={activities} leads={leads} onOpen={setProfileId} completeActivity={completeActivity} deleteActivity={deleteActivity} />}
          {tab === "calendar" && <Calendar activities={activities} leads={leads} config={config} userEmail={userEmail} onOpen={setProfileId} addActivity={addActivity} updateActivity={updateActivity} deleteActivity={deleteActivity} />}
          {tab === "messaging" && <Messaging templates={templates} persistTemplates={persistTemplates} cadences={cadences} persistCadences={persistCadences} />}
          {tab === "commissions" && <Commissions leads={leads} onOpen={setProfileId} />}
          {tab === "applications" && <Applications leads={leads} lenders={lenders} onOpen={setProfileId} onDelete={removeLead} />}
          {tab === "team" && <Team leads={leads} onOpen={setProfileId} config={config} />}
          {tab === "scripts" && <Scripts />}
          {tab === "settings" && <Settings config={config} persistConfig={persistConfig} lenders={lenders} persistLenders={persistLenders} leads={leads} updateLead={updateLead} />}
        </div>
      </main>

      {profileLead && (
        <Profile lead={profileLead} config={config} templates={templates} cadences={cadences} userEmail={userEmail} lenders={lenders}
          comms={comms} activities={activities} addActivity={addActivity} completeActivity={completeActivity} deleteActivity={deleteActivity} sendReply={sendReply} addNote={addNote} markRead={markRead}
          onClose={() => setProfileId(null)} updateLead={updateLead} removeLead={removeLead} logTouch={logTouch} openCompose={setCompose} />
      )}

      {compose && <ComposeModal compose={compose} onClose={() => setCompose(null)} onSent={handleSent} templates={templates} config={config} />}
      <AlarmCenter activities={activities} userEmail={userEmail} completeActivity={completeActivity} snoozeActivity={snoozeActivity} onOpen={setProfileId} leads={leads} />
    </div>
  );
}

/* ================================================================== */
/*  Pipeline                                                          */
/* ================================================================== */
const BOARDS = {
  outreach: { label: "Outreach", stages: ["new", "appointment_booked", "voicemail", "waiting_reports", "app_sent", "callback", "check_back", "not_interested", "wrong_number", "interested"] },
  funding: { label: "Funding", stages: ["report_pulled", "app_received", "app_reports_received", "submitted", "looking_for_partner", "waiting_for_partner", "denied", "pre_approved", "contracts_out", "agreement_signed", "getting_approvals", "funded", "commission_paid"] },
  closed: { label: "Closed", stages: ["declined", "offer_cr", "referred_cr", "credit_repair", "dead"] },
};

function QuickStart() {
  const [open, setOpen] = useState(true);
  const steps = [
    ["Open a lead", "Click any card on the board to open the client's file."],
    ["Read before you dial", "Check the Call guide and Scripts for this stage at the top, they tell you what to say for exactly where this client is."],
    ["Call and log it", "Make the call, then under \"What happened on this call\" type a note (required) and pick the outcome. The outcome moves them to the right stage and starts the follow-up texts and emails automatically."],
    ["Confirm their info", "Tap the blue chips (Wants, Rev, Score, etc.) to confirm or fix them as you talk. They turn green when confirmed."],
    ["Reply in the Inbox", "When a client texts or emails back, it shows in the Inbox with a blue dot. Open it and reply right there. Automation pauses itself while you're talking to them."],
    ["Send the application", "When they're ready, send the application link (it's in the text/email templates). Once they submit, it lands on their file under Documents."],
    ["Match and submit to a lender", "On the file, Best-fit lenders shows who they qualify for. In Documents, hit Send package to lender to email the full application. Track the response under Lender submissions."],
  ];
  if (!open) return (
    <button onClick={() => setOpen(true)} className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200"><FileText size={13} /> Show quick start</button>
  );
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold text-blue-900">Quick start: how to work a lead</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-xs font-medium text-blue-500 hover:text-blue-700">Hide</button>
      </div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{i + 1}</span>
            <span><span className="font-semibold text-slate-900">{s[0]}.</span> {s[1]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Board groups shown in the tracker (mirrors the original 5-column layout)
const TGROUPS = [
  { key: "new_working", label: "New / Working", dot: "bg-slate-400", bg: "", stages: ["new","docs_incomplete","docs_in","underwriting","approved","contracts_out","in_final"] },
  { key: "credit_partner", label: "Credit Partner", dot: "bg-amber-500", bg: "bg-amber-50/60", stages: ["credit_partner"] },
  { key: "credit_repair", label: "Credit Repair", dot: "bg-violet-500", bg: "", stages: ["cr_pitched","cr_scheduled","cr_purchased"] },
  { key: "won", label: "Won", dot: "bg-emerald-500", bg: "", stages: ["funded"] },
  { key: "lost", label: "Lost", dot: "bg-rose-500", bg: "", stages: ["dnq","declined","merchant_decline","killed_final","pitched_no_sale"] },
];
const groupOfStage = (k) => (TGROUPS.find((g) => g.stages.includes(k)) || TGROUPS[0]).key;
const stageLabel = (k) => (ORIG_STAGES.find((s) => s.key === k) || { label: k }).label;
const docCount = (l) => leadDocEvents(l).length;
// A "doc collected" event can come from an uploaded file, a credit-report upload, or a
// manual "mark report pulled" touch. Count all three, with a date fallback so nothing is lost.
function leadDocEvents(l) {
  const evts = [];
  const seen = new Set();
  const push = (at, by) => {
    if (!at) return;
    const key = Math.round(at / 60000); // dedupe within the same minute (same collection recorded twice)
    if (seen.has(key)) return;
    seen.add(key);
    evts.push({ at, by: by || l.ownerEmail || "(unassigned)" });
  };
  (l.documents || []).forEach((d) => {
    const at = typeof d.uploadedAt === "number" ? d.uploadedAt : (d.uploadedAt ? new Date(d.uploadedAt).getTime() : (l.reportUploadedAt || l.lastTouchAt || l.createdAt || null));
    push(at, d.by);
  });
  if (l.reportPath && l.reportUploadedAt) push(l.reportUploadedAt, l.ownerEmail);
  (l.touches || []).forEach((t) => { if (t.kind === "report") push(t.at, t.by); });
  return evts;
}
const docEventsForLead = (l) => leadDocEvents(l).map((e) => e.at);
const startOfMonth = (d) => { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x.getTime(); };
const endOfMonth = (d) => { const x = new Date(d); x.setMonth(x.getMonth()+1, 1); x.setHours(0,0,0,0); return x.getTime(); };
const sameDay = (a, b) => { const x=new Date(a), y=new Date(b); return x.getFullYear()===y.getFullYear() && x.getMonth()===y.getMonth() && x.getDate()===y.getDate(); };

function TrackerCard({ lead, onOpen, onMove, config }) {
  const skey = origStageOf(lead);
  const rep = origReport(lead);
  const daysLeft = origReportDaysLeft(rep);
  const stale = daysLeft !== null && daysLeft < 0;
  const lowFico = rep && rep.fico && Number(rep.fico) < MIN_FICO;
  const since = origStageSince(lead);
  const days = since ? Math.floor((Date.now() - since) / 86400000) : null;
  const repName = (e) => { const m = (config.team || []).find((x) => (x.email||"").toLowerCase() === String(e||"").toLowerCase()); return m ? (m.first + (m.last ? " " + m.last : "")) : (e||"").split("@")[0]; };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300">
      <button onClick={() => onOpen(lead.id)} className="block w-full truncate text-left text-[15px] font-bold text-slate-800 hover:text-blue-700">{leadTitle(lead)}</button>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {lead.product && <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${lead.product === "SLOC" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>{lead.product}</span>}
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SOURCE_TONE[normalizeSource(lead.source)] || SOURCE_TONE.Unknown}`}>{normalizeSource(lead.source)}</span>
        {lead.lenderTag && <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-violet-600">{"\u2192 " + lead.lenderTag}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
        <span className="font-semibold text-blue-600">{"\u2713 " + docCount(lead) + " doc" + (docCount(lead) === 1 ? "" : "s")}</span>
        <span className="text-slate-300">\u00b7</span>
        <span>{repName(lead.ownerEmail) || "Unassigned"}</span>
        {days !== null && <><span className="text-slate-300">\u00b7</span><span>{days}d</span></>}
      </div>
      {rep && rep.fico ? (
        <div className={`mt-1 text-[11px] font-semibold ${lowFico ? "text-rose-600" : "text-emerald-600"}`}>FICO {rep.fico}{lowFico ? " \u26d4 under " + MIN_FICO : ""}{rep.rd ? (stale ? " \u00b7 report expired" : " \u00b7 " + daysLeft + "d left") : ""}</div>
      ) : null}
      <div className="mt-1.5">
        <select value={skey} onChange={(e) => onMove(lead, e.target.value)} onClick={(e) => e.stopPropagation()} className="cursor-pointer rounded border-0 bg-transparent p-0 text-[12px] text-slate-500 hover:text-blue-600 focus:outline-none focus:ring-0">
          {ORIG_GROUPS.map(([g, label]) => (
            <optgroup key={g} label={label}>
              {ORIG_STAGES.filter((s) => s.group === g).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatCard({ n, label, tone }) {
  const c = { slate: "text-slate-800", green: "text-emerald-600", red: "text-rose-600", blue: "text-blue-600", purple: "text-violet-600", amber: "text-amber-600" }[tone] || "text-slate-800";
  return (
    <div className="min-w-[120px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className={`text-2xl font-bold ${c}`}>{n}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Tracker({ leads, config, onOpen, logTouch, userEmail }) {
  const [view, setView] = useState("pipeline");
  const [monthOffset, setMonthOffset] = useState(0);
  const [product, setProduct] = useState("all");
  const move = (lead, stageKey) => logTouch(lead.id, "orig_stage", "orig_stage", { note: stageKey, by: userEmail });
  const repName = (e) => { const m = (config.team || []).find((x) => (x.email||"").toLowerCase() === String(e||"").toLowerCase()); return m ? (m.first + (m.last ? " " + m.last : "")) : (e||"").split("@")[0]; };

  const monthDate = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset); return d; })();
  const mStart = startOfMonth(monthDate), mEnd = endOfMonth(monthDate);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }) + (monthOffset === 0 ? " (current)" : "");
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  const counts = { all: leads.length, MCA: leads.filter((l) => l.product === "MCA").length, SLOC: leads.filter((l) => l.product === "SLOC").length, cr: leads.filter((l) => groupOfStage(origStageOf(l)) === "credit_repair").length };
  const shown = leads.filter((l) => {
    if (product === "MCA") return l.product === "MCA";
    if (product === "SLOC") return l.product === "SLOC";
    if (product === "cr") return groupOfStage(origStageOf(l)) === "credit_repair";
    return true;
  });

  const byGroup = {}; TGROUPS.forEach((g) => (byGroup[g.key] = []));
  shown.forEach((l) => byGroup[groupOfStage(origStageOf(l))].push(l));

  // pipeline stats
  const wonLeads = byGroup.won, lostLeads = byGroup.lost;
  const wonN = wonLeads.length, lostN = lostLeads.length;
  const winRate = wonN + lostN > 0 ? Math.round((wonN / (wonN + lostN)) * 100) : 0;
  const wonValue = wonLeads.reduce((s, l) => s + (Number(l.fundedAmount) || Number(l.desiredAmount) || 0), 0);
  const scheduledN = shown.filter((l) => origStageOf(l) === "cr_scheduled").length;
  const boughtN = shown.filter((l) => origStageOf(l) === "cr_purchased").length;

  // leaderboard: doc events in month
  const evtsAll = [];
  shown.forEach((l) => docEventsForLead(l).forEach((at) => { if (at >= mStart && at < mEnd) evtsAll.push({ at, owner: l.ownerEmail || "(unassigned)", leadId: l.id }); }));
  const docsToday = evtsAll.filter((e) => sameDay(e.at, Date.now())).length;
  const docsMonth = evtsAll.length;
  const workedDays = new Set(evtsAll.map((e) => new Date(e.at).getDate())).size;
  const dailyAvg = workedDays > 0 ? (docsMonth / workedDays).toFixed(1) : "0";
  const leads2plus = shown.filter((l) => docEventsForLead(l).filter((at) => at >= mStart && at < mEnd).length >= 2).length;
  const chasing = shown.filter((l) => origStageOf(l) === "docs_incomplete").length;
  const perDay = Array.from({ length: daysInMonth }, (_, i) => evtsAll.filter((e) => new Date(e.at).getDate() === i + 1).length);
  const maxDay = Math.max(1, ...perDay);

  // agent board
  const agents = {};
  shown.forEach((l) => { const o = l.ownerEmail || "(unassigned)"; agents[o] = agents[o] || { leadsIn: 0, docs: 0, docsToday: 0, days: new Set(), won: 0, value: 0 }; agents[o].leadsIn++; if (groupOfStage(origStageOf(l)) === "won") { agents[o].won++; agents[o].value += Number(l.fundedAmount) || Number(l.desiredAmount) || 0; } });
  evtsAll.forEach((e) => { agents[e.owner] = agents[e.owner] || { leadsIn: 0, docs: 0, docsToday: 0, days: new Set(), won: 0, value: 0 }; agents[e.owner].docs++; agents[e.owner].days.add(new Date(e.at).getDate()); if (sameDay(e.at, Date.now())) agents[e.owner].docsToday++; });
  const agentRows = Object.entries(agents).map(([email, a]) => ({ email, ...a, days: a.days.size })).sort((x, y) => y.docs - x.docs);
  const closerRows = agentRows.filter((a) => a.won > 0).sort((x, y) => y.won - x.won);

  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400";
  const td = "px-3 py-2.5 text-sm text-slate-700";

  return (
    <div className="mt-2">
      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button onClick={() => setView("pipeline")} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "pipeline" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Pipeline</button>
          <button onClick={() => setView("leaderboard")} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "leaderboard" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Leaderboard</button>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-0.5">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><ChevronDown size={16} className="rotate-90" /></button>
          <span className="px-2 text-sm font-semibold text-slate-700">{monthLabel}</span>
          <button onClick={() => setMonthOffset((m) => Math.min(0, m + 1))} disabled={monthOffset >= 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={16} className="-rotate-90" /></button>
        </div>
      </div>

      {/* product tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["all", "All", counts.all], ["MCA", "MCA", counts.MCA], ["SLOC", "SLOC", counts.SLOC], ["cr", "Credit Repair", counts.cr]].map(([k, label, n]) => (
          <button key={k} onClick={() => setProduct(k)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${product === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label} <span className={product === k ? "text-slate-300" : "text-slate-400"}>{n}</span></button>
        ))}
      </div>

      {view === "pipeline" ? (
        <>
          <div className="mb-5 flex flex-wrap gap-2.5">
            <StatCard n={shown.length} label="Leads In" tone="slate" />
            <StatCard n={byGroup.new_working.length} label="In Pipeline" tone="slate" />
            <StatCard n={wonN} label="Won" tone="green" />
            <StatCard n={lostN} label="Lost" tone="red" />
            <StatCard n={winRate + "%"} label="Win Rate" tone="slate" />
            <StatCard n={money(wonValue)} label="Won Value" tone="green" />
            <StatCard n={scheduledN} label="Scheduled" tone="blue" />
            <StatCard n={boughtN} label="Actually Bought" tone="purple" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {TGROUPS.map((g) => (
              <div key={g.key} className={`rounded-xl border border-slate-200 ${g.bg || "bg-white"} p-3`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700"><span className={`h-2 w-2 rounded-full ${g.dot}`} /> {g.label}</span>
                  <span className="text-xs font-bold text-slate-400">{byGroup[g.key].length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {byGroup[g.key].length === 0 ? <div className="py-6 text-center text-sm text-slate-300">Nothing here</div>
                    : byGroup[g.key].map((l) => <TrackerCard key={l.id} lead={l} onOpen={onOpen} onMove={move} config={config} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2.5">
            <StatCard n={docsToday} label="Docs Today" tone="green" />
            <StatCard n={docsMonth} label={"Docs in " + monthDate.toLocaleDateString(undefined, { month: "long" })} tone="slate" />
            <StatCard n={workedDays} label="Days Worked" tone="slate" />
            <StatCard n={dailyAvg} label="Daily Average" tone="slate" />
            <StatCard n={leads2plus} label="Leads With 2+ Docs" tone="purple" />
            <StatCard n={chasing} label="Chasing Docs" tone="amber" />
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-base font-bold text-slate-800">Docs collected per day, {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
            <div className="mb-3 text-xs text-slate-400">Every collection counts, including a second one on the same lead. Green is today.</div>
            <div className="flex items-end gap-0.5" style={{ height: "150px" }}>
              {perDay.map((n, i) => {
                const isToday = monthOffset === 0 && (i + 1) === new Date().getDate();
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`Day ${i + 1}: ${n}`}>
                    {n > 0 && <div className="mb-0.5 text-[10px] font-semibold text-slate-500">{n}</div>}
                    <div className={`w-full rounded-t ${isToday ? "bg-emerald-500" : "bg-blue-500"}`} style={{ height: `${Math.max(2, (n / maxDay) * 120)}px` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              {[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31].filter((d) => d <= daysInMonth).map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4"><div className="text-base font-bold text-slate-800">Agent board</div><div className="text-xs text-slate-400">Ranked by docs collected.</div></div>
            <table className="w-full">
              <thead><tr className="border-b border-slate-100"><th className={th}>#</th><th className={th}>Agent</th><th className={th}>Docs Today</th><th className={th}>Docs</th><th className={th}>Days</th><th className={th}>Avg / Day</th><th className={th}>Leads In</th><th className={th}>Won</th><th className={th}>Win %</th><th className={th}>Value</th></tr></thead>
              <tbody>
                {agentRows.length === 0 ? <tr><td className="p-4 text-sm text-slate-400" colSpan={10}>No activity in {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</td></tr>
                  : agentRows.map((a, i) => (
                    <tr key={a.email} className="border-b border-slate-50">
                      <td className={td + " font-bold text-amber-500"}>{i + 1}</td>
                      <td className={td + " font-bold"}>{repName(a.email)}</td>
                      <td className={td}>{a.docsToday}</td>
                      <td className={td + " font-semibold"}>{a.docs}</td>
                      <td className={td}>{a.days}</td>
                      <td className={td}>{a.days > 0 ? (a.docs / a.days).toFixed(1) : "0"}</td>
                      <td className={td}>{a.leadsIn}</td>
                      <td className={td}>{a.won}</td>
                      <td className={td}>{a.won + (a.leadsIn - a.won) > 0 ? Math.round((a.won / a.leadsIn) * 100) : 0}%</td>
                      <td className={td}>{a.value > 0 ? money(a.value) : "\u2014"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4"><div className="text-base font-bold text-slate-800">Closer board</div><div className="text-xs text-slate-400">Ranked by deals won.</div></div>
            {closerRows.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Nothing in {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
              : <table className="w-full"><thead><tr className="border-b border-slate-100"><th className={th}>#</th><th className={th}>Agent</th><th className={th}>Won</th><th className={th}>Value</th></tr></thead>
                <tbody>{closerRows.map((a, i) => (<tr key={a.email} className="border-b border-slate-50"><td className={td + " font-bold text-amber-500"}>{i + 1}</td><td className={td + " font-bold"}>{repName(a.email)}</td><td className={td + " font-semibold"}>{a.won}</td><td className={td}>{a.value > 0 ? money(a.value) : "\u2014"}</td></tr>))}</tbody></table>}
          </div>

          {/* lead source conversion */}
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4"><div className="text-base font-bold text-slate-800">Lead source board</div><div className="text-xs text-slate-400">Where deals come from, and which sources actually convert. Ranked by leads.</div></div>
            {(() => {
              const srcMap = {};
              shown.forEach((l) => {
                const s = normalizeSource(l.source);
                srcMap[s] = srcMap[s] || { leads: 0, sold: 0, lost: 0, value: 0 };
                srcMap[s].leads++;
                const g = groupOfStage(origStageOf(l));
                if (g === "won") { srcMap[s].sold++; srcMap[s].value += Number(l.fundedAmount) || Number(l.desiredAmount) || 0; }
                if (g === "lost") srcMap[s].lost++;
              });
              const rows = Object.entries(srcMap).map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads);
              if (rows.length === 0) return <div className="p-8 text-center text-sm text-slate-400">No leads yet</div>;
              return (
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100"><th className={th}>Source</th><th className={th}>Leads</th><th className={th}>Sold</th><th className={th}>Lost</th><th className={th}>Conversion</th><th className={th}>Won Value</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.source} className="border-b border-slate-50">
                        <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_TONE[r.source] || SOURCE_TONE.Unknown}`}>{r.source}</span></td>
                        <td className={td + " font-semibold"}>{r.leads}</td>
                        <td className={td + " font-semibold text-emerald-600"}>{r.sold}</td>
                        <td className={td + " text-rose-500"}>{r.lost}</td>
                        <td className={td + " font-bold"}>{r.leads > 0 ? Math.round((r.sold / r.leads) * 100) : 0}%</td>
                        <td className={td}>{r.value > 0 ? money(r.value) : "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

function Pipeline({ leads, allLeads, allCount, dueList, stats, config, query, setQuery, filter, setFilter, showAdd, setShowAdd, addLead, onOpen, logTouch, updateLead, cadences, templates, openCompose, onGoFollowups, removeLead }) {
  const [view, setView] = useState("board");
  const [boardTab, setBoardTab] = useState("outreach");
  const [dragId, setDragId] = useState(null);
  const [overTrash, setOverTrash] = useState(false);

  const q = query.toLowerCase();
  const boardLeads = (allLeads || leads).filter((l) => !q || (l.name + l.phone + l.email + l.businessName + l.opportunityName + l.source + l.tags).toLowerCase().includes(q));
  const colLeads = (key) => boardLeads.filter((l) => l.status === key).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  const onDrop = (key) => { if (dragId) { updateLead(dragId, { status: key }); setDragId(null); } };

  return (
    <div className="mt-4">
      <QuickStart />
      {dueList.length > 0 && (
        <button onClick={onGoFollowups} className="mb-4 flex w-full items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-left text-sm font-semibold text-orange-800 hover:bg-orange-100">
          <Clock size={15} /> {dueList.length} follow-up{dueList.length === 1 ? "" : "s"} due
          <span className="ml-auto text-xs font-medium text-orange-600">Open Follow-ups &rarr;</span>
        </button>
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
        q ? (
          /* Searching: show all matches across every board, no tab needed */
          <>
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
              <Search size={14} /> {leads.length} result{leads.length !== 1 ? "s" : ""} across all stages for "{query}"
              <button onClick={() => setQuery("")} className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-200">Clear</button>
            </div>
            {leads.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No clients match "{query}".</div>
              : <div className="flex flex-col gap-2">{leads.map((l) => <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l.id)} cadences={cadences} templates={templates} config={config} logTouch={logTouch} updateLead={updateLead} openCompose={openCompose} />)}</div>}
          </>
        ) : (
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

          {dragId && (
            <div
              onDragOver={(e) => { e.preventDefault(); setOverTrash(true); }}
              onDragLeave={() => setOverTrash(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOverTrash(false);
                const victim = (allLeads || []).find((x) => x.id === dragId);
                const who = victim ? (victim.name || victim.businessName || "this client") : "this client";
                if (window.confirm(`Delete ${who}? This removes the client and everything on their file. This cannot be undone.`)) removeLead(dragId);
                setDragId(null);
              }}
              className={`fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-dashed px-6 py-4 shadow-lg transition ${overTrash ? "scale-105 border-rose-500 bg-rose-100" : "border-rose-300 bg-white"}`}>
              <Trash2 size={20} className="text-rose-500" />
              <span className="text-sm font-bold text-rose-600">{overTrash ? "Release to delete" : "Drag here to delete"}</span>
            </div>
          )}

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
        )
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
          <div className="truncate text-sm font-semibold text-slate-800">{leadTitle(lead)}</div>
          {leadSubName(lead) && <div className="truncate text-xs text-slate-400">{leadSubName(lead)}</div>}
        </div>
        {lead.automationPaused
          ? <span className="shrink-0 rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">PAUSED</span>
          : rel && <span className={`shrink-0 text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
      </div>
      {lead.appointmentAt && (() => {
        const t = new Date(lead.appointmentAt);
        if (isNaN(t.getTime())) return null;
        const past = t.getTime() < Date.now();
        return (
          <div className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${past ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}>
            <CalendarDays size={11} />
            {t.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </div>
        );
      })()}
      {(lead.desiredAmount || lead.commissionAmount) && (
        <div className="mt-1 text-xs text-slate-500">
          {lead.commissionAmount ? <span className="font-semibold text-blue-700">{money(lead.commissionAmount)} comm</span> : lead.desiredAmount ? <span>Wants {lead.desiredAmount}</span> : null}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1" onClick={stop}>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SOURCE_TONE[normalizeSource(lead.source)] || SOURCE_TONE.Unknown}`}>{normalizeSource(lead.source)}</span>
        {lead.product && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${lead.product === "SLOC" ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>{lead.product}</span>}
        {lead.lenderTag && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{lead.lenderTag}</span>}
        {lead.optedOut && <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"><Ban size={10} /> DND</span>}
      </div>
      <div className="mt-2 flex items-center gap-1" onClick={stop}>
        <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} title="Call" className={`rounded-md p-1.5 ${lead.phone ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "pointer-events-none bg-slate-50 text-slate-300"}`}><Phone size={13} /></a>
        <button disabled={!lead.phone || lead.optedOut} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens(tplSms?.body || "{{link}}", lead, config), kind: "link" })} title={lead.optedOut ? "Do Not Contact" : "Text"} className={`rounded-md p-1.5 ${lead.phone && !lead.optedOut ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-50 text-slate-300"}`}><MessageSquare size={13} /></button>
        <button disabled={!lead.email || lead.optedOut} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens(tplEmail?.subject || "", lead, config), body: fillTokens(tplEmail?.body || "{{link}}", lead, config), kind: "link" })} title={lead.optedOut ? "Do Not Contact" : "Email"} className={`rounded-md p-1.5 ${lead.email && !lead.optedOut ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-50 text-slate-300"}`}><Mail size={13} /></button>
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
            <span className="truncate font-semibold">{leadTitle(lead)}</span>
            <StagePill status={lead.status} />
            {rel && <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-slate-500">
            {lead.phone && <span>{lead.phone}</span>}
            {lead.email && <span className="truncate">{lead.email}</span>}
            {leadSubName(lead) && <span className="not-italic text-slate-400">{leadSubName(lead)}</span>}
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
function ComposeModal({ compose, onClose, onSent, templates = [], config = {} }) {
  const { lead, channel, to, subject: subj0, body: body0 } = compose;
  const [subject, setSubject] = useState(subj0 || "");
  const [body, setBody] = useState(body0 || "");
  const [toAddr, setToAddr] = useState(to || "");
  const [busy, setBusy] = useState(false);
  const picks = templates.filter((t) => t.channel === channel);
  const onFile = (to || "").replace(/\D/g, "");
  const typed = (toAddr || "").replace(/\D/g, "");
  const differs = channel === "sms" ? (onFile && typed && onFile !== typed) : (to && toAddr && to !== toAddr);
  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (channel === "email") setSubject(fillTokens(t.subject, lead || {}, config));
    setBody(fillTokens(t.body, lead || {}, config));
  };
  const sendViaApp = async () => {
    if (!toAddr.trim()) { alert("Enter a number or email to send to."); return; }
    setBusy(true);
    try { await sendMessage(channel, toAddr, subject, body); onSent({ viaApp: true, subject, body, to: toAddr, altRecipient: differs }); }
    catch (e) { alert("Could not send via app: " + e.message + "\n\nYou can still copy the message and send it manually."); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2 font-bold">
            {channel === "sms" ? <MessageSquare size={16} className="text-blue-600" /> : <Mail size={16} className="text-blue-600" />}
            {channel === "sms" ? "Text" : "Email"} {lead?.name || ""}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">To ({channel === "sms" ? "phone number" : "email"})</label>
            <input value={toAddr} onChange={(e) => setToAddr(e.target.value)} placeholder={channel === "sms" ? "e.g. 904-762-3986" : "name@email.com"} className={inputCls} />
            <div className="mt-1 flex items-center gap-2 text-xs">
              {to && <button onClick={() => setToAddr(to)} className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-200">Use {lead?.name ? lead.name + "'s" : "the"} number on file</button>}
              {differs && <span className="text-amber-600">Sending to a different {channel === "sms" ? "number" : "email"} than what's on file.</span>}
            </div>
          </div>
          {picks.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Insert a saved template</label>
              <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className={inputCls}>
                <option value="">Pick a template to insert...</option>
                {picks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
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
          {lead?.optedOut && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              <Ban size={16} /> This lead is on Do Not Contact. Sending is blocked. Remove DND on their profile if you truly need to reach them.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button onClick={sendViaApp} disabled={busy || lead?.optedOut} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50 disabled:opacity-40"><Send size={15} /> {busy ? "Sending..." : "Send via app"}</button>
            <button onClick={() => onSent({ viaApp: true, subject, body, to: toAddr, altRecipient: differs })} disabled={lead?.optedOut} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Check size={15} /> Mark as sent</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Profile (client detail)                                           */
/* ================================================================== */
const LOAN_PROGRAMS = [
  { label: "SLOC", hint: "680+ credit score" },
  { label: "MCA", hint: "Has business bank account, bad credit OK" },
  { label: "Term Loan", hint: "Established revenue, fair credit" },
  { label: "Line of Credit", hint: "Revolving, moderate credit" },
];

// Stage-driven file: which "phase" a stage belongs to, so the file shows only what matters.
const PHASE = {
  new: "qualify", voicemail: "qualify", interested: "qualify", callback: "qualify", check_back: "qualify", not_interested: "qualify", dead: "qualify",
  appointment_booked: "qualify", wrong_number: "qualify",
  waiting_reports: "collect", report_pulled: "collect", app_sent: "collect", app_received: "collect", app_reports_received: "submit",
  submitted: "submit", denied: "submit", pre_approved: "submit",
  looking_for_partner: "submit", waiting_for_partner: "submit",
  contracts_out: "close", agreement_signed: "close", getting_approvals: "close", funded: "close", commission_paid: "close",
  declined: "credit_repair", offer_cr: "credit_repair", referred_cr: "credit_repair", credit_repair: "credit_repair",
};
const phaseOf = (status) => PHASE[status] || "qualify";
// Which phases each section is relevant to.
const SHOW_IN = {
  productLender: ["submit", "close"],
  bestfit: ["submit"],
  documents: ["collect", "submit", "close", "credit_repair"],
  lenderSubs: ["submit", "close"],
  creditRepair: ["credit_repair", "submit"],
  creditReport: ["qualify", "collect", "submit", "credit_repair"],
  application: ["collect", "submit", "close"],
  submitFunder: ["submit", "close"],
};
function DealTracker({ lead, activities = [], addActivity, completeActivity, logTouch, addNote, userEmail, config = {} }) {
  const [statusText, setStatusText] = useState("");
  const [emailText, setEmailText] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const statusTouches = (lead.touches || []).filter((t) => t.kind === "status").sort((a, b) => b.at - a.at);
  const current = statusTouches[0];
  const openActs = (activities || []).filter((a) => a.lead_id === lead.id && !a.done).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const nextAct = openActs[0];
  const overdue = nextAct && new Date(nextAct.due_at).getTime() < Date.now();
  const repName = (email) => { const m = (config.team || []).find((x) => (x.email || "").toLowerCase() === String(email || "").toLowerCase()); return m ? m.first : email; };
  const saveStatus = () => { if (!statusText.trim()) return; logTouch(lead.id, "status", "status", { note: statusText.trim(), by: userEmail }); setStatusText(""); };
  const setFollowUp = (days) => { const d = days === "custom" ? new Date(customDate + "T12:00:00").getTime() : Date.now() + days * 86400000; if (isNaN(d)) return; addActivity(lead.id, { type: "call", title: "Follow up on deal", dueAt: d, alarm: true }); setCustomDate(""); };
  const logEmail = () => { if (!emailText.trim()) return; addNote(lead, "[Email] " + emailText.trim()); setEmailText(""); setShowEmail(false); };
  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-indigo-900"><Clock size={15} /> Deal tracker</div>
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current status</div>
        {current ? (
          <div className="mt-0.5 text-sm text-slate-800">{current.note} <span className="text-xs text-slate-400">— {repName(current.by)}, {fmtDateTime(current.at)}</span></div>
        ) : <div className="mt-0.5 text-sm text-slate-400">No status logged yet.</div>}
        <div className="mt-1.5 flex gap-2">
          <input value={statusText} onChange={(e) => setStatusText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveStatus(); }} placeholder="Update status (e.g. Offer $75k 12mo, waiting on client to accept)" className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
          <button onClick={saveStatus} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">Update</button>
        </div>
      </div>
      <div className="rounded-lg bg-white p-3 ring-1 ring-indigo-100">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next follow-up</div>
        {nextAct ? (
          <div className="mt-0.5 flex items-center gap-2">
            <span className={`text-sm font-bold ${overdue ? "text-rose-600" : "text-slate-800"}`}>{overdue ? "\u26a0 Overdue: " : ""}{fmtDateTime(new Date(nextAct.due_at).getTime())}</span>
            <button onClick={() => completeActivity(nextAct.id, true)} className="ml-auto rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Done</button>
          </div>
        ) : (
          <div className="mt-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">{"\u26a0"} No follow-up set. Set one so this deal doesn't slip.</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!nextAct && <button onClick={() => setFollowUp(2)} className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600">Set default: 2 days</button>}
          <button onClick={() => setFollowUp(1)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Tomorrow</button>
          <button onClick={() => setFollowUp(2)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">2 days</button>
          <button onClick={() => setFollowUp(3)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">3 days</button>
          <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          {customDate && <button onClick={() => setFollowUp("custom")} className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white">Set</button>}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">Follow-ups here ring as an alarm until you snooze or mark done.</p>
      </div>
      <div className="mt-2">
        {!showEmail ? (
          <button onClick={() => setShowEmail(true)} className="text-xs font-medium text-indigo-600 hover:underline">+ Log email conversation</button>
        ) : (
          <div className="rounded-lg bg-white p-2 ring-1 ring-indigo-100">
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} rows={3} placeholder="Paste the email thread or latest reply to save it to this deal's timeline" className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
            <div className="mt-1 flex gap-2">
              <button onClick={logEmail} className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">Save to timeline</button>
              <button onClick={() => { setShowEmail(false); setEmailText(""); }} className="rounded-md px-3 py-1 text-sm text-slate-500">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlarmCenter({ activities = [], userEmail, completeActivity, snoozeActivity, onOpen, leads = [] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  const due = (activities || []).filter((a) => a.alarm && !a.done && new Date(a.due_at).getTime() <= now && (a.assigned_to === userEmail || a.assigned_to === "all"));
  const hasDue = due.length > 0;
  // Ask once for desktop-notification permission so reminders pop up even
  // when the CRM tab is in the background.
  useEffect(() => {
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch {}
  }, []);
  const notified = useRef(new Set());
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    for (const a of due) {
      if (notified.current.has(a.id)) continue;
      notified.current.add(a.id);
      try {
        const n = new Notification(a.title || "ASAP CRM reminder", { body: "Open the CRM to see details.", tag: String(a.id), requireInteraction: true });
        n.onclick = () => { try { window.focus(); if (a.lead_id) onOpen(a.lead_id); n.close(); } catch {} };
      } catch {}
    }
  }, [due, onOpen]);
  useEffect(() => {
    if (!hasDue) return;
    const beep = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
        const ctx = new Ctx();
        [0, 0.28].forEach((offset) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "square"; o.frequency.value = 760;
          const t0 = ctx.currentTime + offset;
          g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
          o.start(t0); o.stop(t0 + 0.24);
        });
        setTimeout(() => { try { ctx.close(); } catch {} }, 800);
      } catch {}
    };
    beep();
    const t = setInterval(beep, 4000);
    return () => clearInterval(t);
  }, [hasDue]);
  if (!hasDue) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col gap-px shadow-lg">
      {due.map((a) => {
        const lead = leads.find((l) => l.id === a.lead_id);
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-2 bg-rose-600 px-4 py-2.5 text-white">
            <BellRing size={18} className="animate-pulse" />
            <span className="font-bold">{/^new lead/i.test(a.title || "") ? "\ud83c\udd95 New lead" : "Call due:"}</span>
            <span className="font-semibold">{a.title || "Scheduled call"}</span>
            {lead && <button onClick={() => onOpen(a.lead_id)} className="rounded bg-white/20 px-2 py-0.5 text-sm font-semibold hover:bg-white/30">{lead.name || lead.businessName} →</button>}
            <span className="text-sm text-rose-100">was due {fmtDateTime(new Date(a.due_at).getTime())}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-rose-100">Snooze:</span>
              <button onClick={() => snoozeActivity(a.id, 5)} className="rounded bg-white/20 px-2 py-1 text-xs font-bold hover:bg-white/30">5m</button>
              <button onClick={() => snoozeActivity(a.id, 15)} className="rounded bg-white/20 px-2 py-1 text-xs font-bold hover:bg-white/30">15m</button>
              <button onClick={() => snoozeActivity(a.id, 30)} className="rounded bg-white/20 px-2 py-1 text-xs font-bold hover:bg-white/30">30m</button>
              <button onClick={() => completeActivity(a.id, true)} className="rounded bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50">Done</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Gated({ show, label, children }) {
  const [open, setOpen] = useState(false);
  if (show || open) return children;
  return (
    <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600">
      <Plus size={12} /> Show {label}
    </button>
  );
}

function Profile({ lead, config, templates, cadences, onClose, updateLead, removeLead, logTouch, openCompose, userEmail, lenders = [], comms = [], activities = [], addActivity, completeActivity, deleteActivity, sendReply, addNote, markRead }) {
  const phase = phaseOf(lead.status);
  const [linkCopied, setLinkCopied] = useState(false);
  const EDITABLE = ["name", "phone", "email", "notes", "loanProgram", "product", "lenderTag", "confirmedFields", "desiredAmount", "fundingPurpose", "fundingTimeline", "monthlyRevenue", "creditScore", "timeInBusiness",
    "businessName", "businessType", "einStatus", "bestTime", "nextStep", "myscoreiqUsername", "myscoreiqPassword", "ssnLast4", "fundedAmount", "commissionAmount", "declineReason"];
  const [draft, setDraft] = useState(lead);
  const [savedAt, setSavedAt] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [guideOpen, setGuideOpen] = useState(lead.status === "new");
  const [rawOpen, setRawOpen] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reportCreditRep, setReportCreditRep] = useState("");
  const [reportPulledMsg, setReportPulledMsg] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const markReportPulled = () => {
    const by = reportCreditRep || lead.ownerEmail || userEmail || "";
    // Use the chosen date (noon local, so timezone can't push it to the previous/next day).
    let at = Date.now();
    if (reportDate) { const d = new Date(reportDate + "T12:00:00"); if (!isNaN(d)) at = d.getTime(); }
    logTouch(lead.id, "report", "report", { by, manual: true, at });
    if (["new", "voicemail", "interested", "callback", "check_back"].includes(lead.status)) updateLead(lead.id, { status: "report_pulled" });
    const who = (config.team || []).find((m) => (m.email || "").toLowerCase() === by.toLowerCase());
    setReportPulledMsg(`Credit report pull logged${who ? " for " + who.first : ""}.`);
    setTimeout(() => setReportPulledMsg(""), 3000);
  };
  const [crBusy, setCrBusy] = useState(false);
  const [crResult, setCrResult] = useState(null);
  const sendToCreditRepair = async () => {
    if (crBusy) return;
    if (!window.confirm("Send this client to Credit Repair? This creates their lead in Pipedrive with the credit report and funding history, and moves them to Referred to Credit Repair.")) return;
    setCrBusy(true); setCrResult(null);
    try {
      const res = await fetch("/.netlify/functions/send-to-credit-repair", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setCrResult({ ok: true, dealId: j.dealId, fileUploaded: j.fileUploaded, hadReport: j.hadReport });
      updateLead(lead.id, { status: "referred_cr" });
    } catch (e) {
      setCrResult({ ok: false, error: e.message });
    } finally { setCrBusy(false); }
  };
  const [callNote, setCallNote] = useState("");
  const [noteErr, setNoteErr] = useState(false);
  const [docLabel, setDocLabel] = useState("Bank statements");
  const [docBusy, setDocBusy] = useState(false);
  const [lenderOpen, setLenderOpen] = useState(false);
  const [lenderEmail, setLenderEmail] = useState("");
  const [lenderCc, setLenderCc] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [lenderNote, setLenderNote] = useState("");
  const [lenderBusy, setLenderBusy] = useState(false);
  const [lenderMsg, setLenderMsg] = useState("");
  const [spoke, setSpoke] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  useEffect(() => { setDraft(lead); setGuideOpen(lead.status === "new"); setSpoke(false); setDeclineOpen(false); markRead && markRead(lead.id); }, [lead.id]); // reload + mark read when switching leads
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  // Confirm helpers: editing a field auto-confirms it; the check confirms without editing.
  const confirmedList = draft.confirmedFields || [];
  const isConfirmed = (k) => confirmedList.includes(k);
  const confirmField = (k) => { if (!confirmedList.includes(k)) setDraft({ ...draft, confirmedFields: [...confirmedList, k] }); };
  const setC = (k) => (e) => setDraft({ ...draft, [k]: e.target.value, confirmedFields: confirmedList.includes(k) ? confirmedList : [...confirmedList, k] });

  // Autosave: persist changed fields shortly after you stop typing
  useEffect(() => {
    const patch = {};
    EDITABLE.forEach((k) => { if (draft[k] !== lead[k]) patch[k] = draft[k]; });
    if (Object.keys(patch).length === 0) return;
    const t = setTimeout(() => { updateLead(lead.id, { ...patch, lastTouchAt: Date.now() }); setSavedAt(Date.now()); setTimeout(() => setSavedAt(0), 1500); }, 700);
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

  const uploadDoc = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setDocBusy(true);
    try {
      const added = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${lead.id}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
        const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });
        if (error) throw error;
        added.push({ name: file.name, path, label: docLabel, uploadedAt: Date.now(), by: userEmail });
      }
      await updateLead(lead.id, { documents: [...(lead.documents || []), ...added], lastTouchAt: Date.now() });
      // Uploading a credit report counts as obtaining a report, log it for tracking.
      if (docLabel === "Credit report") logTouch(lead.id, "report", "report", { by: userEmail, label: "Credit report" });
    } catch (e) { alert("Upload failed: " + (e.message || e)); }
    finally { setDocBusy(false); }
  };
  const downloadDoc = async (path) => {
    try { const { data } = await supabase.storage.from("reports").createSignedUrl(path, 3600); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); else alert("Could not open file."); }
    catch { alert("Could not open file."); }
  };
  const deleteDoc = async (path) => {
    if (!confirm("Remove this document?")) return;
    try { await supabase.storage.from("reports").remove([path]); } catch {}
    await updateLead(lead.id, { documents: (lead.documents || []).filter((d) => d.path !== path) });
  };
  const sendToLender = async () => {
    if (!lenderEmail.trim()) return;
    setLenderBusy(true); setLenderMsg("");
    try {
      const res = await fetch("/.netlify/functions/send-to-lender", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, toEmail: lenderEmail.trim(), cc: lenderCc.trim(), lenderName: (lenderName || lenderEmail).trim(), note: lenderNote.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to send");
      setLenderMsg(`Sent ${j.sent} files to ${j.to}`);
      setLenderEmail(""); setLenderNote(""); setLenderCc(""); setLenderName("");
      // Auto-advance the stage: once a package is sent to a lender, they're Submitted.
      if (["new", "voicemail", "interested", "callback", "appointment_booked", "check_back", "waiting_reports", "report_pulled", "app_sent", "app_received", "app_reports_received"].includes(lead.status)) {
        updateLead(lead.id, { status: "submitted", lenderTag: lenderName || j.to || lead.lenderTag });
      } else if (lenderName && !lead.lenderTag) {
        updateLead(lead.id, { lenderTag: lenderName });
      }
      setTimeout(() => { setLenderOpen(false); setLenderMsg(""); }, 2500);
    } catch (e) { setLenderMsg(String(e.message || e)); }
    finally { setLenderBusy(false); }
  };

  const logOutcome = (stage, label) => {
    if (!callNote.trim()) { setNoteErr(true); return; }
    logTouch(lead.id, "call", "call", { disposition: label, note: callNote.trim(), by: userEmail });
    setCallNote(""); setSpoke(false); setNoteErr(false);
    if (stage) updateLead(lead.id, { status: stage }); // stage null = just log the call, keep current stage
  };

  // Call outcomes change with where the client is in the pipeline.
  const OUTCOME_BTN = { sky:"bg-sky-600 hover:bg-sky-700", violet:"bg-violet-600 hover:bg-violet-700", orange:"bg-orange-500 hover:bg-orange-600", emerald:"bg-emerald-600 hover:bg-emerald-700", fuchsia:"bg-fuchsia-600 hover:bg-fuchsia-700", rose:"bg-rose-500 hover:bg-rose-600" };
  const spokeOutcomes = (() => {
    const s = lead.status;
    if (["report_pulled", "app_sent", "app_received", "app_reports_received", "submitted", "pre_approved", "contracts_out"].includes(s)) return [
      { label: "Moving forward", disp: "Spoke, moving forward", stage: null, c: "emerald" },
      { label: "Offer credit repair", disp: "Spoke, offered credit repair", stage: "offer_cr", c: "fuchsia" },
      { label: "Call back later", disp: "Spoke, call back", stage: null, c: "violet" },
      { label: "Check back later", disp: "Spoke, check back later", stage: "check_back", c: "sky" },
      { label: "Not interested", disp: "Spoke, not interested", stage: "dead", c: "orange" },
    ];
    if (["declined", "offer_cr", "referred_cr", "credit_repair"].includes(s)) return [
      { label: "Offered credit repair", disp: "Spoke, offered credit repair", stage: "offer_cr", c: "fuchsia" },
      { label: "Referred to credit team", disp: "Spoke, referred to credit", stage: "referred_cr", c: "fuchsia" },
      { label: "Funding path (680 / co-signer)", disp: "Spoke, funding path", stage: null, c: "sky" },
      { label: "Call back later", disp: "Spoke, call back", stage: null, c: "violet" },
      { label: "Check back later", disp: "Spoke, check back later", stage: "check_back", c: "sky" },
      { label: "Not interested", disp: "Spoke, not interested", stage: "dead", c: "orange" },
    ];
    return [ // outreach default
      { label: "Interested", disp: "Spoke, interested", stage: "interested", c: "sky" },
      { label: "Call back later", disp: "Spoke, call back", stage: "callback", c: "violet" },
      { label: "Check back later", disp: "Spoke, check back later", stage: "check_back", c: "sky" },
      { label: "Not interested", disp: "Spoke, not interested", stage: "not_interested", c: "orange" },
    ];
  })();
  // Leaving a voicemail only sends outreach leads into the voicemail cadence; deeper in the
  // pipeline it just logs the call so the client is not yanked back to an outreach stage.
  const lvmStage = ["new", "voicemail", "interested", "callback", "not_interested", ""].includes(lead.status) ? "voicemail" : null;

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
  const nextStep = nextDue(lead, cadences, templates);
  const leadComms = comms.filter((c) => c.lead_id === lead.id);
  const leadActivities = activities.filter((a) => a.lead_id === lead.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100">
      <div className="mx-auto min-h-full w-full max-w-6xl bg-white shadow-sm">
        {/* back bar */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-2.5">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronDown size={16} className="rotate-90" /> Back to pipeline</button>
          <button onClick={() => { const url = `${window.location.origin}${window.location.pathname}#/lead/${lead.id}`; navigator.clipboard?.writeText(url).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50" title="Copy a link to this client to share with your team">
            {linkCopied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy link</>}
          </button>
          {savedAt > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Check size={13} /> Saved</span>}
        </div>
        {/* journey stepper */}
        <div className="border-b border-slate-100 px-5 py-3">
          <StageStepper status={lead.status} />
        </div>

        {/* head */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <input value={draft.businessName || ""} onChange={set("businessName")} placeholder="Business name"
                className="min-w-0 flex-1 rounded-md bg-transparent px-1 -mx-1 text-lg font-bold text-slate-900 outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-200 placeholder:font-semibold placeholder:text-slate-300" />
              <span className="inline-flex shrink-0 items-center gap-1" onClick={stop}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SOURCE_TONE[normalizeSource(lead.source)] || SOURCE_TONE.Unknown}`}>{normalizeSource(lead.source)}</span>
              </span>
              <StagePill status={lead.status} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="inline-flex min-w-0 items-center gap-1"><User size={13} className="shrink-0 text-slate-400" />
                <input value={draft.name || ""} onChange={set("name")} placeholder="Contact name"
                  className="min-w-0 rounded-md bg-transparent px-1 -mx-1 font-medium text-slate-700 outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-200 placeholder:text-slate-300" />
              </span>
              {lead.phone && <a href={telHref(lead.phone)} className="font-mono text-xs text-slate-400 hover:text-blue-600">{lead.phone}</a>}
              <span className="inline-flex items-center gap-1" onClick={stop}>
                <span className="text-[10px] uppercase tracking-wide text-slate-300">source</span>
                <select value={SOURCE_CHOICES.includes(normalizeSource(lead.source)) ? normalizeSource(lead.source) : "Other"} onChange={(e) => updateLead(lead.id, { source: e.target.value })} title="Change lead source" className="cursor-pointer rounded border-0 bg-transparent p-0 text-[11px] text-slate-400 hover:text-blue-600 focus:outline-none focus:ring-0">
                  {SOURCE_CHOICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lead.phone && <a href={telHref(lead.phone)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"><Phone size={14} /> Call</a>}
          </div>
        </div>

        {/* editable info bar: chips look the same, click to edit */}
        <div className="border-b border-slate-100 bg-white px-5 py-3">
          {(() => {
            const FIELDS = [
              ["desiredAmount", "Wants", "$"],
              ["monthlyRevenue", "Rev/mo", ""],
              ["creditScore", "Score", ""],
              ["hasBankAccount", "Bank acct", "Yes/No"],
              ["timeInBusiness", "In biz", ""],
              ["loanProgram", "Loan program", ""],
              ["fundingPurpose", "Needs it for", "use of funds"],
              ["fundingTimeline", "How soon", ""],
              ["businessType", "Industry", ""],
              ["einStatus", "EIN / entity", ""],
              ["bestTime", "Best time", ""],
            ];
            const unconfirmed = FIELDS.filter(([k]) => draft[k] && String(draft[k]).trim() && !isConfirmed(k)).map(([k]) => k);
            return (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {FIELDS.map(([k, label, ph]) => (
                    <EditChip key={k} label={label} value={draft[k]} onChange={setC(k)} confirmed={isConfirmed(k)} onConfirm={() => confirmField(k)} placeholder={ph} />
                  ))}
                </div>
                {unconfirmed.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
                    <AlertCircle size={13} /> {unconfirmed.length} still to confirm with the client.
                    <button onClick={() => setDraft({ ...draft, confirmedFields: [...new Set([...confirmedList, ...FIELDS.map(([k]) => k)])] })} className="rounded-md bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-700">Confirm all</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Product + Lender tabs (click to set, shows as chips on the card) */}
          <Gated show={SHOW_IN.productLender.includes(phase)} label="product / lender tags"><div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Product</span>
            {["SLOC", "MCA"].map((p) => {
              const on = draft.product === p;
              const color = p === "SLOC" ? "bg-indigo-600" : "bg-orange-500";
              return (
                <button key={p} onClick={() => { const v = on ? "" : p; setDraft({ ...draft, product: v }); updateLead(lead.id, { product: v }); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ${on ? color + " text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{p}</button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lender</span>
            {(lenders || []).length === 0 && <span className="text-xs text-slate-400">Add lenders in Settings</span>}
            {(lenders || []).map((l) => {
              const on = draft.lenderTag === l.name;
              return (
                <button key={l.id} onClick={() => { const v = on ? "" : l.name; setDraft({ ...draft, lenderTag: v }); updateLead(lead.id, { lenderTag: v }); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${on ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l.name}</button>
              );
            })}
          </div>
        </div></Gated>


        <div className="grid gap-5 px-5 py-4 lg:grid-cols-5">
          {/* LEFT COLUMN: work this client now */}
          <div className="space-y-5 lg:col-span-3">

          {["submitted", "denied", "pre_approved", "contracts_out", "agreement_signed", "getting_approvals"].includes(lead.status) && (
            <DealTracker lead={lead} activities={activities} addActivity={addActivity} completeActivity={completeActivity} logTouch={logTouch} addNote={addNote} userEmail={userEmail} config={config} />
          )}

          {/* Interested / just-sent: the two next steps are report link or application (or both) */}
          {["interested", "app_sent"].includes(lead.status) && (
            <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-4">
              <div className="mb-0.5 text-sm font-bold text-sky-900">{lead.status === "app_sent" ? "Send anything else they need" : "They're interested, send the next step"}</div>
              <p className="mb-3 text-xs text-sky-700">Send the report link so they can pull their credit, the application, or both. You can send by text and email.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3 ring-1 ring-sky-100">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><KeyRound size={15} className="text-amber-500" /> Send Report Link</div>
                  <div className="flex gap-2">
                    <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens((poolTemplates(templates, "int_sms")[0]?.body) || "{{first}}, here's the link to pull your report so we can see what you qualify for: {{link}}", lead, config), kind: "link" })} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300"}`}><MessageSquare size={14} className="mr-1 inline" />Text</button>
                    <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens((poolTemplates(templates, "int_email")[0]?.subject) || "Your report link", lead, config), body: fillTokens((poolTemplates(templates, "int_email")[0]?.body) || "{{link}}", lead, config), kind: "link" })} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={14} className="mr-1 inline" />Email</button>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-sky-100">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><FileText size={15} className="text-blue-600" /> Send Application</div>
                  <div className="flex gap-2">
                    <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens((templates.find(t => t.id === "app_sms")?.body) || APP_SMS_DEFAULT, lead, config), kind: "link" })} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300"}`}><MessageSquare size={14} className="mr-1 inline" />Text</button>
                    <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens((templates.find(t => t.id === "app_email")?.subject) || APP_EMAIL_SUBJECT_DEFAULT, lead, config), body: fillTokens((templates.find(t => t.id === "app_email")?.body) || APP_EMAIL_DEFAULT, lead, config), kind: "link" })} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={14} className="mr-1 inline" />Email</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* what happened on this call */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Phone size={15} className="text-blue-600" /> What happened on this call? <span className="text-rose-500">*</span></div>
            <textarea value={callNote} onChange={(e) => { setCallNote(e.target.value); if (e.target.value.trim()) setNoteErr(false); }} rows={2} placeholder="Required: what did you discuss? (logged with your name and the time)" className={`${inputCls} mb-1 ${noteErr ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100" : ""}`} />
            {noteErr && <p className="mb-2 text-xs font-medium text-rose-600">Please add a call note before logging the outcome.</p>}
            {!spoke ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => logOutcome(lvmStage, "Left voicemail")} className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-200">No answer / left voicemail</button>
                <button onClick={() => setSpoke(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Spoke to them</button>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">How did it go?</div>
                <div className="flex flex-wrap gap-2">
                  {spokeOutcomes.map((o) => (
                    <button key={o.label} onClick={() => logOutcome(o.stage, o.disp)} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${OUTCOME_BTN[o.c]}`}>{o.label}</button>
                  ))}
                  <button onClick={() => setSpoke(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Back</button>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">A call note is required. Outcomes match where this client is in the pipeline. "Moving forward," "Call back," and "Funding path" log the call without changing the stage.</p>
          </div>

          {/* call log & notes: every logged call/note on this client */}
          {(() => {
            const log = (lead.touches || [])
              .filter((t) => t.note && String(t.note).trim())
              .sort((a, b) => (b.at || 0) - (a.at || 0));
            if (!log.length) return null;
            const repName = (email) => {
              if (!email) return "";
              const m = (config.team || []).find((x) => (x.email || "").toLowerCase() === String(email).toLowerCase());
              return m ? m.first : email;
            };
            return (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Phone size={15} className="text-blue-600" /> Call log & notes <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{log.length}</span></div>
                <div className="flex flex-col gap-2">
                  {log.map((t, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        {t.disposition && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">{t.disposition}</span>}
                        {t.by && <span className="font-medium text-slate-500">{repName(t.by)}</span>}
                        <span className="ml-auto text-slate-400">{fmtDateTime(t.at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{t.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}



          {/* best-fit lenders (only once an application is in) */}
          {lenders.length > 0 && ((lead.documents||[]).some(d => /application/i.test((d.label||"")+(d.name||""))) || ["app_sent","app_received","app_reports_received","submitted","pre_approved","contracts_out","funded"].includes(lead.status)) && (() => {
            const ranked = matchLenders(lead, lenders);
            const chip = (s) => s === "pass" ? "bg-emerald-100 text-emerald-700" : s === "fail" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500";
            const badge = { fit: ["Best fit", "bg-emerald-600"], maybe: ["Possible", "bg-amber-500"], no: ["Not a fit", "bg-rose-500"] };
            return (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-900"><Send size={15} /> Best-fit lenders</div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Based on:</span>
                  <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">Score {lead.creditScore || "?"}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{lead.timeInBusiness || "time ?"}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">Rev {lead.monthlyRevenue || "?"}</span>
                  <label className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">Bank acct
                    <select value={lead.hasBankAccount || ""} onChange={(e) => updateLead(lead.id, { hasBankAccount: e.target.value })} className="bg-transparent text-xs font-semibold outline-none">
                      <option value="">?</option><option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  {ranked.map(({ lender, status, checks }) => (
                    <div key={lender.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${badge[status][1]}`}>{badge[status][0]}</span>
                        <span className="font-semibold text-slate-800">{lender.name}</span>
                        <button onClick={() => { setLenderOpen(true); setLenderName(lender.name); setLenderEmail(lender.email); setLenderCc(lender.cc || ""); }} className="ml-auto rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Send</button>
                      </div>
                      {checks.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {checks.map((c, i) => <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${chip(c.s)}`}>{c.k} {c.s === "pass" ? "✓" : c.s === "fail" ? "✗" : "?"}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">Ranked by fit. Set each lender's criteria under Settings. "Send" jumps to the package sender (documents must be on file).</p>
              </div>
            );
          })()}

          {/* call guide (top, above the composer) */}
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
                    Hi {firstName(draft.name)}, this is {config.signature}.{" "}
                    {(() => {
                      const bn = (draft.businessName || "").trim();
                      const dupe = bn && bn.toLowerCase() === (draft.name || "").trim().toLowerCase();
                      const bits = [
                        draft.desiredAmount && `From what you sent over I see you're looking for ${draft.desiredAmount}`,
                        draft.fundingPurpose && `to put toward ${draft.fundingPurpose}`,
                        (bn && !dupe) && `for ${bn}`,
                        draft.fundingTimeline && `and you need it ${draft.fundingTimeline}`,
                      ].filter(Boolean);
                      return bits.length ? bits.join(", ") + ". " : "";
                    })()}
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

          {/* stage-aware scripts */}
          <ProfileScripts lead={lead} userEmail={userEmail} />

          {/* conversation: where you left off */}
          <Conversation lead={lead} comms={comms} onSend={sendReply} onAddNote={addNote} templates={templates} config={config} compact />

          {/* scheduled calls and tasks */}
          <ActivityPanel lead={lead} activities={leadActivities} addActivity={addActivity} completeActivity={completeActivity} deleteActivity={deleteActivity} config={config} userEmail={userEmail} />

          {/* automation control */}
          {/* Do Not Contact: hard stop on all texting + emailing (manual and automated) */}
          <div className={`rounded-xl border px-4 py-3 ${lead.optedOut ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Ban size={16} className={lead.optedOut ? "text-rose-600" : "text-slate-400"} />
              <div>
                <div className="text-sm font-bold text-slate-800">{lead.optedOut ? "Do Not Contact is ON" : "Contact allowed"}</div>
                <div className="text-xs text-slate-500">{lead.optedOut ? "All texts and emails are blocked for this lead." : "Turn on to stop all outreach immediately."}</div>
              </div>
              <button onClick={() => updateLead(lead.id, lead.optedOut ? { optedOut: false } : { optedOut: true, automationPaused: true })} className={`ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold ${lead.optedOut ? "bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50" : "bg-rose-600 text-white hover:bg-rose-700"}`}>
                {lead.optedOut ? "Allow contact" : "Stop all outreach"}
              </button>
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 ${lead.automationPaused ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Automated follow-ups</div>
              {lead.optedOut ? (
                <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-bold text-rose-900">Opted out (STOP)</span>
              ) : lead.automationPaused ? (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">Paused</span>
              ) : nextStep ? (
                <span className="text-xs text-slate-500">Next: <span className="font-semibold text-slate-700">{nextStep.template?.name}</span> {relativeDue(nextStep.dueAt).label.toLowerCase()}</span>
              ) : (
                <span className="text-xs text-slate-400">Nothing scheduled</span>
              )}
              <div className="ml-auto">
                {lead.automationPaused ? (
                  <button onClick={() => updateLead(lead.id, { automationPaused: false })} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900">Resume</button>
                ) : (
                  <button onClick={() => updateLead(lead.id, { automationPaused: true })} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Pause</button>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-400">Owner</span>
              <span className="font-semibold text-slate-700">{repInfo(lead, config).first}{lead.ownerEmail ? "" : " (default)"}</span>
              {(() => {
                const seen = new Set();
                const validTeam = (config.team || []).filter((m) => {
                  const e = (m.email || "").trim().toLowerCase();
                  if (!e || !m.first || !m.first.trim() || seen.has(e)) return false;
                  seen.add(e); return true;
                });
                return validTeam.length > 0 ? (
                  <select value={lead.ownerEmail || ""} onChange={(e) => updateLead(lead.id, { ownerEmail: e.target.value })} className="ml-auto rounded border border-slate-200 px-1.5 py-1 text-xs">
                    <option value="">Unassigned</option>
                    {validTeam.map((m) => <option key={m.email} value={m.email}>{m.first}</option>)}
                  </select>
                ) : null;
              })()}
            </div>
            {!lead.automationPaused && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400">Push next follow-up out</span>
                {[1, 3, 7, 14].map((d) => (
                  <button key={d} onClick={() => updateLead(lead.id, { snoozeUntil: Date.now() + d * DAY })} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 hover:bg-slate-200">{d}d</button>
                ))}
                <input type="date" onChange={(e) => e.target.value && updateLead(lead.id, { snoozeUntil: new Date(e.target.value + "T09:00:00").getTime() })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                {lead.snoozeUntil > Date.now() && (
                  <span className="ml-1 text-slate-500">Paused until <span className="font-semibold">{fmtDate(lead.snoozeUntil)}</span></span>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Logging a call or note automatically pushes the next message out {config.autoSnoozeDays ?? 3} days, so nobody gets blasted mid-conversation.
            </p>
          </div>

          {/* contact actions */}
          <div className="flex flex-wrap gap-2">
            <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-slate-800 text-white hover:bg-slate-900" : "pointer-events-none bg-slate-100 text-slate-300"}`}><Phone size={15} /> Call</a>
            <button disabled={!lead.phone} onClick={() => openCompose({ lead, channel: "sms", to: lead.phone, subject: "", body: fillTokens(templates.find(t=>t.id==="first_sms")?.body || "{{link}}", lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300"}`}><MessageSquare size={15} /> Text link</button>
            <button disabled={!lead.email} onClick={() => openCompose({ lead, channel: "email", to: lead.email, subject: fillTokens(templates.find(t=>t.id==="first_email")?.subject||"", lead, config), body: fillTokens(templates.find(t=>t.id==="first_email")?.body||"{{link}}", lead, config), kind: "link" })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.email ? "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={15} /> Email link</button>
            <CopyButton text={config.reportLink || ""} label="Copy link" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
          </div>




          {/* command bar: move stage, tag program, see next */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Move to stage</label>
                <select value={lead.status} onChange={(e) => updateLead(lead.id, { status: e.target.value })} className={inputCls}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {nextStepFor(lead).text && (
              <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium ${TONE[nextStepFor(lead).tone]}`}>
                <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide opacity-70">Next</span>
                <span>{nextStepFor(lead).text}</span>
              </div>
            )}
          </div>

          </div>{/* end left column */}

          {/* RIGHT COLUMN: record & pipeline */}
          <div className="space-y-5 lg:col-span-2">

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
              <>
                <p className="mb-2 text-xs text-slate-400">Messages send one at a time. The next only unlocks after the current one goes out.</p>
                <div className="flex flex-col gap-1.5">
                  {steps.map((st) => {
                    const rel = st.dueAt ? relativeDue(st.dueAt) : null;
                    const isDue = st.state === "due";
                    const isWaiting = st.state === "waiting";
                    return (
                      <div key={st.i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isDue ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "bg-slate-50"} ${isWaiting ? "opacity-55" : ""}`}>
                        <span className="font-mono text-xs text-slate-400">D{st.day}</span>
                        {st.channel === "sms" ? <MessageSquare size={14} className="text-blue-600" /> : <Mail size={14} className="text-blue-600" />}
                        <span className="min-w-0 flex-1 truncate">{st.template?.name || "deleted template"}</span>

                        {st.state === "sent" && (
                          st.sent?.auto
                            ? <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700"><Zap size={11} /> Auto-sent</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Check size={13} /> Sent</span>
                        )}
                        {isDue && <span className={`text-xs font-semibold ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
                        {isWaiting && <span className="text-xs font-medium text-slate-400">Waiting</span>}

                        {st.template && st.state !== "waiting" && (
                          <button onClick={() => openCompose({ lead, channel: st.channel, to: st.channel === "sms" ? lead.phone : lead.email, subject: fillTokens(st.template.subject, lead, config), body: fillTokens(st.template.body, lead, config), kind: "cadence", extra: { stage: lead.status, step: st.i } })} className={`rounded-md px-2 py-1 text-xs font-semibold ${st.state === "sent" ? "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>{st.state === "sent" ? "Resend" : "Send"}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Section>

          {/* qualification + business (editable) */}
          {/* contact details editable */}
          <Section icon={<User size={15} />} title="Contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Name"><input value={draft.name} onChange={set("name")} className={inputCls} /></Labeled>
              <Labeled label="Phone"><input value={draft.phone} onChange={set("phone")} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Email"><input value={draft.email} onChange={set("email")} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Next step"><input value={draft.nextStep} onChange={set("nextStep")} className={inputCls} /></Labeled>
            </div>
          </Section>

          {/* MyScoreIQ credentials (sensitive) */}
          <Section icon={<KeyRound size={15} className="text-amber-500" />} title="MyScoreIQ access" collapsible defaultOpen={false}>
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

          {/* labeled documents */}
          <Gated show={SHOW_IN.documents.includes(phase)} label="documents"><Section icon={<FileText size={15} />} title={`Documents${(lead.documents || []).length ? ` (${lead.documents.length})` : ""}`} collapsible defaultOpen={true}>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Label</label>
                <select value={docLabel} onChange={(e) => setDocLabel(e.target.value)} className={inputCls}>
                  {["Bank statements", "Voided check", "Driver's license", "Credit report", "Application", "Business formation / EIN", "Tax return", "Proof of ownership", "Signed agreement", "Other"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${docBusy ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                <FileText size={15} /> {docBusy ? "Uploading..." : "Upload file"}
                <input type="file" multiple className="hidden" disabled={docBusy} onChange={(e) => { if (e.target.files?.length) uploadDoc(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            {(lead.documents || []).length === 0 ? (
              <p className="text-sm text-slate-400">No documents yet. Pick a label and upload bank statements, a voided check, ID, etc.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {[...(lead.documents || [])].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0)).map((d) => (
                  <div key={d.path} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{d.label || "Other"}</span>
                    <button onClick={() => downloadDoc(d.path)} className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-blue-700">{d.name}</button>
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{d.uploadedAt ? fmtDateTime(d.uploadedAt).split(",")[0] : ""}</span>
                    <button onClick={() => downloadDoc(d.path)} title="Download" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><ChevronDown size={15} className="rotate-0" /></button>
                    <button onClick={() => deleteDoc(d.path)} title="Remove" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            {(lead.documents || []).length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {!lenderOpen ? (
                  <button onClick={() => setLenderOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Send size={14} /> Send package to lender</button>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">Email application + all documents</div>
                    {lenders.length > 0 && (
                      <select value="" onChange={(e) => { const l = lenders.find((x) => x.id === e.target.value); if (l) { setLenderEmail(l.email); setLenderCc(l.cc || ""); setLenderName(l.name); } }} className={`${inputCls} mb-2`}>
                        <option value="">Pick a saved lender...</option>
                        {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    )}
                    <input value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="Lender name" className={`${inputCls} mb-2`} />
                    <input value={lenderEmail} onChange={(e) => setLenderEmail(e.target.value)} placeholder="Lender email address" className={`${inputCls} mb-2 font-mono`} />
                    <input value={lenderCc} onChange={(e) => setLenderCc(e.target.value)} placeholder="CC (optional, comma-separated)" className={`${inputCls} mb-2 font-mono`} />
                    <textarea value={lenderNote} onChange={(e) => setLenderNote(e.target.value)} rows={2} placeholder="Optional note to the lender..." className={`${inputCls} mb-2`} />
                    {lenderMsg && <div className={`mb-2 text-xs font-medium ${lenderMsg.startsWith("Sent") ? "text-emerald-700" : "text-rose-600"}`}>{lenderMsg}</div>}
                    <div className="flex gap-2">
                      <button disabled={lenderBusy || !lenderEmail.trim()} onClick={sendToLender} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${lenderBusy || !lenderEmail.trim() ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"}`}>{lenderBusy ? "Sending..." : `Send ${(lead.documents || []).length} files`}</button>
                      <button onClick={() => { setLenderOpen(false); setLenderMsg(""); }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">Emails the full package straight to the lender from your funding inbox. Add lenders under Settings.</p>
                  </div>
                )}
              </div>
            )}
          </Section></Gated>

          {/* lender submissions + responses */}
          {(lead.submissions || []).length > 0 && (
            <Gated show={SHOW_IN.lenderSubs.includes(phase)} label="lender submissions"><Section icon={<Send size={15} />} title={`Lender submissions (${lead.submissions.length})`} collapsible defaultOpen={true}>
              <div className="flex flex-col gap-2">
                {lead.submissions.map((s) => {
                  const setSub = (patch) => updateLead(lead.id, { submissions: lead.submissions.map((x) => x.id === s.id ? { ...x, ...patch } : x) });
                  // When a lender response is logged, advance the client's stage to match.
                  const setSubStatus = (status) => {
                    const extra = {};
                    if (["Approved", "Pre-approved", "Funded"].includes(status) && !["pre_approved", "contracts_out", "funded"].includes(lead.status)) extra.status = status === "Funded" ? "funded" : "pre_approved";
                    if (status === "Declined" && lead.status === "submitted") extra.status = "declined";
                    updateLead(lead.id, { submissions: lead.submissions.map((x) => x.id === s.id ? { ...x, status, respondedAt: Date.now() } : x), ...extra });
                  };
                  const statusColor = { "Submitted": "bg-slate-100 text-slate-700", "Pre-approved": "bg-amber-100 text-amber-800", "Approved": "bg-emerald-100 text-emerald-800", "Declined": "bg-rose-100 text-rose-700", "Funded": "bg-blue-100 text-blue-800" }[s.status] || "bg-slate-100 text-slate-700";
                  return (
                    <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{s.lender}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>{s.status}</span>
                        <span className="ml-auto text-xs text-slate-400">{s.sentAt ? fmtDateTime(s.sentAt).split(",")[0] : ""} · {s.files} files</span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                        <select value={s.status} onChange={(e) => setSubStatus(e.target.value)} className={inputCls}>
                          {["Submitted", "Pre-approved", "Approved", "Declined", "Funded"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <input value={s.amount || ""} onChange={(e) => setSub({ amount: e.target.value })} placeholder="Offer / approved amount" className={inputCls} />
                      </div>
                      <input value={s.note || ""} onChange={(e) => setSub({ note: e.target.value })} placeholder="Lender response notes (rate, terms, decline reason...)" className={`${inputCls} mt-2`} />
                    </div>
                  );
                })}
              </div>
            </Section></Gated>
          )}

          {/* send to credit repair (Pipedrive) */}
          <Gated show={SHOW_IN.creditRepair.includes(phase)} label="credit repair referral"><Section icon={<RefreshCw size={15} className="text-fuchsia-600" />} title="Credit Repair referral" collapsible defaultOpen={["declined", "offer_cr", "referred_cr", "credit"].includes(lead.status)}>
            <p className="mb-2 text-sm text-slate-500">Creates this client in the Credit Repair Pipedrive with a copy of their credit report and funding history, then moves them to Referred to Credit Repair.</p>
            {(() => {
              const docs = lead.documents || [];
              const hasCR = docs.some((d) => /credit/i.test((d.label || "") + (d.name || "")));
              return (
                <>
                  {!hasCR && <div className="mb-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">No credit report on file yet. You can still send the referral, but no report will be attached. Upload the credit report first if you have it.</div>}
                  <button onClick={sendToCreditRepair} disabled={crBusy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${crBusy ? "bg-slate-300" : "bg-fuchsia-600 hover:bg-fuchsia-700"}`}>
                    <RefreshCw size={15} /> {crBusy ? "Sending to Credit Repair..." : "Send to Credit Repair"}
                  </button>
                  {crResult && crResult.ok && (
                    <div className="mt-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Sent. Pipedrive deal #{crResult.dealId} created.{crResult.fileUploaded ? " Credit report attached." : crResult.hadReport ? " (Report found but attach failed, check the report file.)" : " (No credit report was on file.)"}
                    </div>
                  )}
                  {crResult && !crResult.ok && (
                    <div className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">Could not send: {crResult.error}</div>
                  )}
                </>
              );
            })()}
          </Section></Gated>
          <Gated show={SHOW_IN.creditReport.includes(phase)} label="credit report"><Section icon={<FileText size={15} />} title="Credit report" collapsible defaultOpen={["interested", "report_pulled", "submitted", "pre_approved"].includes(lead.status)}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
                <Upload size={15} /> {uploading ? "Uploading..." : lead.reportPath ? "Replace PDF" : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadReport(e.target.files?.[0])} />
              </label>
              {lead.reportPath && <button onClick={viewReport} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50"><ExternalLink size={15} /> View report</button>}
              {lead.reportUploadedAt && <span className="text-xs text-slate-400">Uploaded {fmtDate(lead.reportUploadedAt)}</span>}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Report pulled outside the app?</div>
              <p className="mb-2 text-xs text-slate-500">Log a credit report pull (e.g. done in another system) so the rep gets credit for it in the Team report.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="rounded border border-slate-200 px-2 py-1.5 text-sm" title="Date the report was pulled" />
                {(() => {
                  const seen = new Set();
                  const validTeam = (config.team || []).filter((m) => { const e = (m.email || "").trim().toLowerCase(); if (!e || !m.first || seen.has(e)) return false; seen.add(e); return true; });
                  return validTeam.length > 0 ? (
                    <select value={reportCreditRep} onChange={(e) => setReportCreditRep(e.target.value)} className="rounded border border-slate-200 px-2 py-1.5 text-sm">
                      <option value="">{lead.ownerEmail ? "Credit the owner" : "Credit me"}</option>
                      {validTeam.map((m) => <option key={m.email} value={m.email}>Credit {m.first}</option>)}
                    </select>
                  ) : null;
                })()}
                <button onClick={markReportPulled} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"><FileText size={14} /> Mark credit report pulled</button>
                {reportPulledMsg && <span className="text-xs font-medium text-emerald-600">{reportPulledMsg}</span>}
              </div>
            </div>
          </Section></Gated>

          {/* application (after pre-approval, if they want more) */}
          <Gated show={SHOW_IN.application.includes(phase)} label="application"><Section icon={<FileText size={15} />} title="Application" collapsible defaultOpen={["report_pulled","app_sent","app_received","app_reports_received","pre_approved"].includes(lead.status)}>
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
            {lead.status !== "app_sent" && (
              <button onClick={() => updateLead(lead.id, { status: "app_sent" })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"><Check size={15} /> Mark application sent</button>
            )}
            {lead.status === "app_sent" && (
              <div className="mt-2 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">Application sent. Auto follow-ups are chasing the signed app. Submit to Torro when it's back.</div>
            )}
            <p className="mt-2 text-xs text-slate-400">Send the application, then mark it sent to move the client into Application Sent and start the chase sequence. The client signs and uploads their bank statements, voided check, license, and report in the form.</p>
          </Section></Gated>

          {/* submit to funder */}
          <Gated show={SHOW_IN.submitFunder.includes(phase)} label="submit to funder"><Section icon={<Send size={15} />} title={`Submit to ${config.funderName || "funder"}`}>
            <button onClick={submitToFunder} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Send size={15} /> Email report to {config.funderName || "funder"}</button>
            <p className="mt-2 text-xs text-slate-500">Opens an email to {config.funderEmail} with the subject set to the client's name. If you uploaded the report, a 7 day download link is included; otherwise attach the PDF yourself.</p>
            <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
              Just send Torro the report to start. They send back a pre-approval. The full application only goes out later if the client wants more funding.
            </div>
          </Section></Gated>

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
                  <div className="mt-2 mb-3">
                    <AcceleratorScript defaultOpen={/credit|score/i.test(lead.declineReason || "")} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => updateLead(lead.id, { status: "credit_repair" })} className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700">Interested, transferring now</button>
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
            <Section icon={<FileText size={15} />} title="Imported data (from GHL)" collapsible defaultOpen={false}>
              <button onClick={() => setRawOpen((o) => !o)} className="text-sm font-medium text-blue-700 hover:underline">{rawOpen ? "Hide" : "Show"} exactly what GHL sent</button>
              {rawOpen && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{JSON.stringify(lead.raw.customData || lead.raw, null, 2)}</pre>}
            </Section>
          )}

          </div>{/* end right column */}

          {/* footer actions (full width) */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 lg:col-span-5">
            <button onClick={() => { if (confirm(`Remove ${lead.name || "this client"}?`)) { removeLead(lead.id); onClose(); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"><Trash2 size={13} /> Remove</button>
            <span className="text-xs text-slate-400">Changes save automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function Section({ icon, title, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">{icon} {title}</h3>
        {children}
      </div>
    );
  }
  return (
    <div>
      <button onClick={() => setOpen((s) => !s)} className="mb-2 flex w-full items-center gap-1.5 text-sm font-bold text-slate-800">
        {icon} {title}
        <ChevronDown size={15} className={`ml-auto text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
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
  acct_sms: "Account check, text", acct_email: "Account check, email",
  story_sms: "Success story, text", story_email: "Success story, email",
  cb_sms: "Call back, text", cb_email: "Call back, email",
  ni_email: "Not interested, email", pulled_sms: "Report pulled, text",
  app_sms: "Application, text", app_email: "Application, email",
  vm_first_sms: "Voicemail first touch, text", urgency_sms: "Urgency nudge, text", value_email: "Value / education, email",
  appchase_sms: "Application chase, text", appchase_email: "Application chase, email",
  proof_email: "Social proof, email", breakup_sms: "Breakup / final, text", breakup_email: "Breakup / final, email",
  manual: "Manual only (not auto-sent)",
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
// Which scripts matter at each stage (by title), plus objections always on hand.
const OBJECTIONS = ["Objection: why do you need my credit?", "Objection: is this safe?", "Objection: I am busy right now"];
const STAGE_SCRIPTS = {
  new: { lead: ["Cold call open", "Warm / inbound", "Voicemail"], hint: "First contact. Open, then drive to the report link." },
  voicemail: { lead: ["Voicemail", "Cold call open"], hint: "Left a voicemail. Keep trying; use the opener when they pick up." },
  interested: { lead: ["Warm / inbound", "After they pull it"], hint: "They engaged. Get the report pulled, then walk options." },
  callback: { lead: ["Warm / inbound", "Cold call open"], hint: "They asked you to call back. Reconnect and move to the report." },
  report_pulled: { lead: ["After they pull it"], hint: "Report is in. Walk their options and decide the loan program." },
  app_sent: { lead: ["After they pull it"], hint: "Application sent. Chase the signed app back." },
};

function ProfileScripts({ lead, userEmail }) {
  const [open, setOpen] = useState(false);
  const cfg = STAGE_SCRIPTS[lead.status];
  const isCreditPivot = ["declined", "offer_cr", "referred_cr"].includes(lead.status) || /credit|score/i.test(lead.declineReason || "");
  if (!cfg && !isCreditPivot) return null;
  const fill = (t) => (t || "").replace(/\{NAME\}/g, firstName(lead.name)).replace(/\{YOUR NAME\}/g, (userEmail || "").split("@")[0] || "me");
  const picks = cfg ? SCRIPTS.filter((s) => cfg.lead.includes(s.title)) : [];

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-900"><FileText size={15} /> Scripts for this stage</span>
        <ChevronDown size={16} className={`text-emerald-700 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-emerald-100 px-4 py-3">
          {cfg && <p className="text-xs font-medium text-emerald-700">{cfg.hint}</p>}
          {isCreditPivot && (
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-fuchsia-700">Credit accelerator pivot</div>
              <AcceleratorScript defaultOpen />
            </div>
          )}
          {picks.map((s) => (
            <details key={s.title} className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">{s.title}</summary>
              <div className="whitespace-pre-wrap border-t border-slate-100 px-3 py-2 text-sm text-slate-600">{fill(s.body)}</div>
            </details>
          ))}
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Objection handling</div>
            <div className="space-y-1.5">
              {SCRIPTS.filter((s) => OBJECTIONS.includes(s.title)).map((s) => (
                <details key={s.title} className="rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">{s.title.replace("Objection: ", "")}</summary>
                  <div className="whitespace-pre-wrap border-t border-slate-100 px-3 py-2 text-sm text-slate-600">{fill(s.body)}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Scripts() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">Swap <span className="font-mono text-slate-700">{"{NAME}"}</span> and <span className="font-mono text-slate-700">{"{YOUR NAME}"}</span> as you go.</p>

      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-fuchsia-800"><ListChecks size={15} /> When funding is declined (credit)</h3>
        <p className="mb-2 text-xs text-slate-500">Pivot a decline into the accelerator program and hand off to a specialist. Also appears automatically on any declined lead.</p>
        <AcceleratorScript defaultOpen />
      </div>

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
function Settings({ config, persistConfig, lenders = [], persistLenders, leads = [], updateLead }) {
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const save = async () => { await persistConfig(draft); setSaved(true); setTimeout(() => setSaved(false), 1600); };

  // --- Import lead sources from a GHL opportunities CSV ---
  const [srcPreview, setSrcPreview] = useState(null); // { matches:[{lead,source}], counts:{}, unmatched:n }
  const [srcBusy, setSrcBusy] = useState(false);
  const [srcDone, setSrcDone] = useState("");
  const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
  const parseCsv = (text) => {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.length > 1);
  };
  const onCsv = async (file) => {
    if (!file) return;
    setSrcDone(""); setSrcPreview(null);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { setSrcDone("Could not read that file."); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iPhone = head.indexOf("phone"), iEmail = head.indexOf("email"), iSrc = head.indexOf("source");
    if (iSrc < 0 || (iPhone < 0 && iEmail < 0)) { setSrcDone("That CSV needs a 'source' column and a phone or email column."); return; }
    // index leads by phone/email
    const byPhone = new Map(), byEmail = new Map();
    leads.forEach((l) => { const p = last10(l.phone); if (p.length === 10) byPhone.set(p, l); if (l.email) byEmail.set(l.email.trim().toLowerCase(), l); });
    const matches = new Map(); let unmatched = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const src = normalizeSource(iSrc >= 0 ? row[iSrc] : "");
      if (src === "Unknown") continue;
      let lead = null;
      if (iPhone >= 0) lead = byPhone.get(last10(row[iPhone]));
      if (!lead && iEmail >= 0) lead = byEmail.get(String(row[iEmail] || "").trim().toLowerCase());
      if (!lead) { unmatched++; continue; }
      if (normalizeSource(lead.source) !== src) matches.set(lead.id, { lead, source: src });
    }
    const counts = {};
    matches.forEach(({ source }) => { counts[source] = (counts[source] || 0) + 1; });
    setSrcPreview({ matches: Array.from(matches.values()), counts, unmatched });
  };
  const applySources = async () => {
    if (!srcPreview) return;
    setSrcBusy(true);
    let done = 0;
    for (const m of srcPreview.matches) { try { await updateLead(m.lead.id, { source: m.source }); done++; } catch {} }
    setSrcBusy(false); setSrcDone(`Updated ${done} lead${done === 1 ? "" : "s"}.`); setSrcPreview(null);
  };

  const [newLender, setNewLender] = useState({ name: "", email: "", cc: "" });
  const team = draft.team || [];
  const setTeam = (t) => setDraft({ ...draft, team: t });
  const [newMember, setNewMember] = useState({ email: "", first: "", signature: "" });
  const addMember = () => {
    if (!newMember.email.trim() || !newMember.first.trim()) return;
    setTeam([...team, { email: newMember.email.trim(), first: newMember.first.trim(), signature: newMember.signature.trim() || `${newMember.first.trim()} at ASAP Funding USA` }]);
    setNewMember({ email: "", first: "", signature: "" });
  };
  const updateMember = (i, patch) => setTeam(team.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const removeMember = (i) => setTeam(team.filter((_, idx) => idx !== i));
  const addLender = async () => {
    if (!newLender.name.trim() || !newLender.email.trim()) return;
    await persistLenders([...(lenders || []), { id: Date.now().toString(36), name: newLender.name.trim(), email: newLender.email.trim(), cc: newLender.cc.trim() }]);
    setNewLender({ name: "", email: "", cc: "" });
  };
  const updateLender = async (id, patch) => { await persistLenders((lenders || []).map((l) => l.id === id ? { ...l, ...patch } : l)); };
  const removeLender = async (id) => { if (confirm("Remove this lender?")) await persistLenders((lenders || []).filter((l) => l.id !== id)); };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800"><SettingsIcon size={15} className="text-blue-600" /> Core setup</h3>
        <div className="flex flex-col gap-3">
          <Labeled label="MyScoreIQ link (under $10k path)"><input value={draft.reportLink} onChange={set("reportLink")} className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="SmartCredit link (backup report tool)"><input value={draft.smartCreditLink || ""} onChange={set("smartCreditLink")} className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Auto-snooze days after a logged call or note"><input type="number" min={0} value={draft.autoSnoozeDays ?? 3} onChange={(e) => setDraft({ ...draft, autoSnoozeDays: Number(e.target.value) })} className={inputCls} /></Labeled>
          <Labeled label="Email signature (added to the bottom of emails you send)"><textarea value={draft.emailSignature || ""} onChange={set("emailSignature")} rows={3} className={`${inputCls} resize-none`} /></Labeled>
          <Labeled label="Application link (over $10k path)"><input value={draft.appLink || ""} onChange={set("appLink")} placeholder="https://tranquil-muffin-691d4e.netlify.app/apply.html" className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Signature / who it is from"><input value={draft.signature} onChange={set("signature")} className={inputCls} /></Labeled>
          <Labeled label="Funder name"><input value={draft.funderName || ""} onChange={set("funderName")} className={inputCls} /></Labeled>
          <Labeled label="Funder submission email"><input value={draft.funderEmail || ""} onChange={set("funderEmail")} className={`${inputCls} font-mono`} /></Labeled>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Send size={15} /> Save</button>
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"><Check size={15} /> Saved</span>}
        </div>
      </div>

      {/* Import lead sources from a GHL opportunities CSV */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><TrendingUp size={15} className="text-blue-600" /> Import lead sources</h3>
        <p className="mb-3 text-xs text-slate-500">Upload your GoHighLevel opportunities export (CSV). It matches each row to a lead by phone or email and sets the real source (Facebook, Google, Direct). Only leads whose source would change are touched.</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900">
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
          Choose CSV file
        </label>
        {srcDone && <span className="ml-3 text-sm font-medium text-emerald-600">{srcDone}</span>}
        {srcPreview && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-700">Ready to update {srcPreview.matches.length} lead{srcPreview.matches.length === 1 ? "" : "s"}:</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {Object.entries(srcPreview.counts).map(([s, n]) => <span key={s} className={`rounded-full px-2 py-0.5 font-semibold ${SOURCE_TONE[s] || SOURCE_TONE.Unknown}`}>{n} → {s}</span>)}
              {srcPreview.matches.length === 0 && <span className="text-slate-400">Nothing to change (sources already set or no matches found).</span>}
            </div>
            {srcPreview.unmatched > 0 && <div className="mt-1 text-xs text-slate-400">{srcPreview.unmatched} CSV row(s) had no matching lead in the app.</div>}
            {srcPreview.matches.length > 0 && (
              <button disabled={srcBusy} onClick={applySources} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {srcBusy ? "Updating..." : "Apply sources"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Team: who works leads, and the name their messages send under */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><User size={15} className="text-blue-600" /> Team</h3>
        <p className="mb-3 text-sm text-slate-500">Map each person's login to their first name. Whoever moves a lead becomes its owner, and that lead's texts and emails go out under their name (the <span className="font-mono">{"{{repfirst}}"}</span> and signature in your templates). Leads with no owner use the default ({draft.defaultRepFirst || "Joe"}).</p>
        <div className="mb-3">
          <Labeled label="Default rep first name (for unassigned leads)"><input value={draft.defaultRepFirst || ""} onChange={set("defaultRepFirst")} className={inputCls} /></Labeled>
        </div>
        <div className="flex flex-col gap-2">
          {team.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 sm:grid-cols-[1.4fr_0.8fr_1.4fr_auto]">
              <input value={m.email} onChange={(e) => updateMember(i, { email: e.target.value })} placeholder="login email" className={`${inputCls} font-mono`} />
              <input value={m.first} onChange={(e) => updateMember(i, { first: e.target.value })} placeholder="First name" className={inputCls} />
              <input value={m.signature || ""} onChange={(e) => updateMember(i, { signature: e.target.value })} placeholder="Email signature" className={inputCls} />
              <button onClick={() => removeMember(i)} className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-2 sm:grid-cols-[1.4fr_0.8fr_1.4fr_auto]">
            <input value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="login email" className={`${inputCls} font-mono`} />
            <input value={newMember.first} onChange={(e) => setNewMember({ ...newMember, first: e.target.value })} placeholder="First name" className={inputCls} />
            <input value={newMember.signature} onChange={(e) => setNewMember({ ...newMember, signature: e.target.value })} placeholder="Signature (optional)" className={inputCls} />
            <button onClick={addMember} className="rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">Remember to Save (top) after editing the team.</p>
      </div>

      {/* Lenders directory */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Send size={15} className="text-emerald-600" /> Lenders</h3>
        <p className="mb-3 text-sm text-slate-500">Save the lenders you submit to. From any client file you can forward the full application package to any of these in one click. CC is optional (comma-separate multiple addresses).</p>
        <div className="flex flex-col gap-2">
          {(lenders || []).map((l) => (
            <div key={l.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.3fr_1.3fr_auto]">
                <input value={l.name} onChange={(e) => updateLender(l.id, { name: e.target.value })} placeholder="Lender name" className={inputCls} />
                <input value={l.email} onChange={(e) => updateLender(l.id, { email: e.target.value })} placeholder="Submission email" className={`${inputCls} font-mono`} />
                <input value={l.cc || ""} onChange={(e) => updateLender(l.id, { cc: e.target.value })} placeholder="CC (optional)" className={`${inputCls} font-mono`} />
                <button onClick={() => removeLender(l.id)} className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Qualifies if</span>
                <label className="flex items-center gap-1 text-xs text-slate-500">min score <input type="number" value={l.minScore || ""} onChange={(e) => updateLender(l.id, { minScore: e.target.value })} placeholder="—" className="w-16 rounded border border-slate-200 px-1.5 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs text-slate-500">min months in biz <input type="number" value={l.minMonths || ""} onChange={(e) => updateLender(l.id, { minMonths: e.target.value })} placeholder="—" className="w-16 rounded border border-slate-200 px-1.5 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs text-slate-500">min monthly rev $<input type="number" value={l.minRevenue || ""} onChange={(e) => updateLender(l.id, { minRevenue: e.target.value })} placeholder="—" className="w-24 rounded border border-slate-200 px-1.5 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={!!l.needsBank} onChange={(e) => updateLender(l.id, { needsBank: e.target.checked })} /> needs business bank account</label>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-2 sm:grid-cols-[1fr_1.3fr_1.3fr_auto]">
            <input value={newLender.name} onChange={(e) => setNewLender({ ...newLender, name: e.target.value })} placeholder="New lender name" className={inputCls} />
            <input value={newLender.email} onChange={(e) => setNewLender({ ...newLender, email: e.target.value })} placeholder="Submission email" className={`${inputCls} font-mono`} />
            <input value={newLender.cc} onChange={(e) => setNewLender({ ...newLender, cc: e.target.value })} placeholder="CC (optional)" className={`${inputCls} font-mono`} />
            <button onClick={addLender} className="rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700">Add</button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Zap size={15} className="text-blue-600" /> Automated outreach</h3>
        <p className="mb-3 text-sm text-slate-500">When on, the app auto-sends the next due message and auto-schedules follow-up calls for leads in Left Voicemail, Interested, and Call Back, during business hours only (Mon to Fri, 8am to 5pm Central). It skips anyone who replied, opted out, is paused, or snoozed, and never stacks calls.</p>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!draft.autoSendEnabled} onChange={(e) => { const next = { ...draft, autoSendEnabled: e.target.checked }; setDraft(next); persistConfig(next); }} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
          <span className="text-sm font-medium text-slate-700">Auto-send messages and schedule calls</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${draft.autoSendEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{draft.autoSendEnabled ? "ON" : "OFF"}</span>
        </label>
        <p className="mt-2 text-xs text-slate-400">This toggle saves instantly, no need to hit Save.</p>
        <p className="mt-3 text-xs text-slate-400">Call sequence: days 1, 2, 3, 4, 6, 8, 10, 13, 16, 19, 21 after a lead enters the stage. Moving stages restarts the sequence.</p>
      </div>

      <InboundTexts />
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Build your messages and per-stage follow-up sequences under the <span className="font-semibold text-slate-700">Messaging</span> tab.
      </div>
    </div>
  );
}

function InboundTexts() {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const call = async (method) => {
    setBusy(method); setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/rc-subscribe", {
        method,
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || `Failed (${res.status})`);
      if (method === "POST") {
        setMsg({ ok: true, text: `Connected. RingCentral will now push replies here. Subscription ${j.id} is ${j.status}.` });
      } else {
        const records = j.subscriptions?.records || [];
        setMsg({ ok: true, text: records.length ? `${records.length} active subscription(s). Delivering to ${j.deliveryUrl}` : "No subscription yet. Click Connect." });
      }
    } catch (e) {
      setMsg({ ok: false, text: String(e.message || e) });
    } finally { setBusy(""); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><MessageSquare size={15} className="text-blue-600" /> Inbound texts</div>
      <p className="mb-3 text-sm text-slate-500">
        Connect once so client replies land in each lead's conversation. Your RingCentral app needs the <span className="font-medium text-slate-700">Read Messages</span> scope first.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => call("POST")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">
          <Zap size={15} /> {busy === "POST" ? "Connecting..." : "Connect inbound texts"}
        </button>
        <button onClick={() => call("GET")} disabled={!!busy} className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">
          {busy === "GET" ? "Checking..." : "Check status"}
        </button>
      </div>
      {msg && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${msg.ok ? "bg-blue-50 text-blue-800 ring-blue-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Commissions                                                       */
/* ================================================================== */
const money = (n) => "$" + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const ACT_TYPES = [
  { key: "call", label: "Call" },
  { key: "followup", label: "Follow-up" },
  { key: "meeting", label: "Meeting" },
  { key: "appointment", label: "Appointment" },
  { key: "task", label: "Task" },
];

function actBucket(a) {
  const due = new Date(a.due_at).getTime();
  const now = Date.now();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  if (due < now) return "overdue";
  if (due <= endOfToday.getTime()) return "today";
  if (due <= endOfToday.getTime() + 7 * DAY) return "week";
  return "later";
}

function ActivityPanel({ lead, activities, addActivity, completeActivity, deleteActivity, config = {}, userEmail }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("call");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [alarm, setAlarm] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const team = (() => { const seen = new Set(); return (config.team || []).filter((m) => { const e = (m.email || "").trim().toLowerCase(); if (!e || !m.first || seen.has(e)) return false; seen.add(e); return true; }); })();

  const openActs = activities.filter((a) => !a.done).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const doneActs = activities.filter((a) => a.done);

  const save = () => {
    if (!when) return;
    addActivity(lead.id, { type, title: title || ACT_TYPES.find((t) => t.key === type).label, dueAt: new Date(when).getTime(), notes, alarm, assignedTo: assignedTo || userEmail });
    setTitle(""); setWhen(""); setNotes(""); setAlarm(false); setAssignedTo(""); setOpen(false);
  };

  // default to tomorrow 10am when opening the form
  const openForm = () => {
    const d = new Date(Date.now() + DAY);
    d.setHours(10, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    setWhen(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setOpen(true);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <CalendarClock size={14} /> Scheduled calls &amp; tasks
          {openActs.length > 0 && <span className="rounded-full bg-blue-100 px-1.5 text-[11px] font-bold text-blue-700">{openActs.length}</span>}
        </div>
        {!open && <button onClick={openForm} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={14} /> Schedule</button>}
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Labeled label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {ACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Labeled>
            <Labeled label="When">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
            </Labeled>
          </div>
          <div className="mt-2"><Labeled label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call back about the report" className={inputCls} /></Labeled></div>
          <div className="mt-2"><Labeled label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Labeled></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Labeled label="Assign to">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputCls}>
                <option value="">Me</option>
                {team.map((m) => <option key={m.email} value={m.email}>{m.first}</option>)}
                <option value="all">Everyone</option>
              </select>
            </Labeled>
            <div className="flex items-end">
              <label className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${alarm ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}>
                <input type="checkbox" checked={alarm} onChange={(e) => setAlarm(e.target.checked)} className="h-4 w-4 accent-rose-600" />
                <BellRing size={15} /> Alarm alert (rings until dismissed)
              </label>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
            <button onClick={save} disabled={!when} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Save</button>
          </div>
        </div>
      )}

      {openActs.length === 0 && !open && <p className="mt-2 text-sm text-slate-400">Nothing scheduled for this lead.</p>}

      {openActs.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {openActs.map((a) => {
            const due = new Date(a.due_at).getTime();
            const overdue = due < Date.now();
            return (
              <div key={a.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 ring-inset ${overdue ? "bg-rose-50 ring-rose-200" : "bg-slate-50 ring-slate-100"}`}>
                <button onClick={() => completeActivity(a.id, true)} title="Mark done" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-white" />
                <span className="rounded bg-white px-1.5 text-xs font-medium capitalize text-slate-600 ring-1 ring-slate-200">{a.type}</span>
                <span className="font-medium text-slate-800">{a.title}</span>
                {a.notes && <span className="text-xs text-slate-400">{a.notes}</span>}
                <span className={`ml-auto text-xs font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}>{fmtDateTime(due)}</span>
                <button onClick={() => deleteActivity(a.id)} className="rounded p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}

      {doneActs.length > 0 && <p className="mt-2 text-xs text-slate-400">{doneActs.length} completed</p>}
    </div>
  );
}


function Conversation({ lead, comms, onSend, onAddNote, templates = [], config = {}, compact = false }) {
  const [mode, setMode] = useState("sms"); // sms | email | note
  const [filter, setFilter] = useState("all"); // all | note | call | sms | email
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [includeSig, setIncludeSig] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const endRef = useRef(null);

  // Merge messages (texts/emails/notes) + logged calls into one timeline
  const items = useMemo(() => {
    const msgs = comms.filter((c) => c.lead_id === lead.id).map((c) => ({
      id: c.id, kind: c.channel === "note" ? "note" : c.channel,
      direction: c.direction, at: new Date(c.at).getTime(),
      subject: c.subject, body: c.body, by: c.by_user, attachments: Array.isArray(c.attachments) ? c.attachments : [],
    }));
    const calls = (lead.touches || []).filter((t) => t.kind === "call").map((t, i) => ({
      id: "call-" + t.at + "-" + i, kind: "call", direction: "log", at: t.at,
      body: t.note || "", disposition: t.disposition, by: t.by,
    }));
    return [...msgs, ...calls].sort((a, b) => a.at - b.at);
  }, [comms, lead.id, lead.touches]);

  const counts = useMemo(() => {
    const c = { all: items.length, note: 0, call: 0, sms: 0, email: 0 };
    items.forEach((i) => { if (c[i.kind] !== undefined) c[i.kind]++; });
    return c;
  }, [items]);

  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [items.length]);

  const picks = templates.filter((t) => t.channel === mode);
  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (mode === "email") setSubject(fillTokens(t.subject, lead, config));
    setBody(fillTokens(t.body, lead, config));
  };

  const sig = config.emailSignature || "";
  const emailPreviewBody = body + (includeSig && sig ? "\n\n" + sig : "");
  const canSend = mode === "sms" ? !!lead.phone : !!lead.email;

  const send = async () => {
    if (!body.trim() || !canSend) return;
    setBusy(true); setErr("");
    const outBody = mode === "email" ? emailPreviewBody : body;
    const label = mode === "sms" ? "Text sent" : "Email sent";
    try { await onSend(lead, mode, subject, outBody); setBody(""); setSubject(""); setOkMsg(label); setTimeout(() => setOkMsg(""), 3000); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await onAddNote(lead, note); setNote(""); setOkMsg("Note added"); setTimeout(() => setOkMsg(""), 3000); }
    finally { setBusy(false); }
  };

  const CHIPS = [["all", "All"], ["note", "Notes"], ["call", "Calls"], ["sms", "Texts"], ["email", "Emails"]];

  const downloadAttachment = async (path) => {
    try {
      const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) { alert("Could not open file."); return; }
      window.open(data.signedUrl, "_blank");
    } catch { alert("Could not open file."); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* header + filters */}
      <div className="border-b border-slate-100 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <MessageSquare size={14} className="text-blue-600" /> Activity timeline
        </div>
        <div className="flex flex-wrap gap-1">
          {CHIPS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${filter === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {label}{counts[k] > 0 && <span className={filter === k ? "text-blue-100" : "text-slate-400"}> {counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* timeline */}
      <div className={`flex flex-col gap-2 overflow-y-auto px-4 py-3 ${compact ? "max-h-80" : "max-h-[420px]"}`}>
        {shown.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nothing here yet. Send a text or email, or add a note below.</p>}
        {shown.map((it) => {
          if (it.kind === "note") {
            return (
              <div key={it.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"><FileText size={10} /> Note <span className="font-normal normal-case text-amber-600/70">{fmtDateTime(it.at)}{it.by ? " · " + it.by : ""}</span></div>
                <div className="whitespace-pre-wrap text-slate-700">{it.body}</div>
              </div>
            );
          }
          if (it.kind === "call") {
            return (
              <div key={it.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><Phone size={10} /> Call{it.disposition ? " · " + it.disposition : ""} <span className="font-normal normal-case text-slate-400">{fmtDateTime(it.at)}{it.by ? " · " + it.by : ""}</span></div>
                {it.body && <div className="whitespace-pre-wrap text-slate-700">{it.body}</div>}
              </div>
            );
          }
          // sms / email bubble
          const inbound = it.direction === "in";
          const chanLabel = it.kind === "sms" ? "SMS" : "Email";
          return (
            <div key={it.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${inbound ? "rounded-bl-sm bg-slate-100 text-slate-800" : "rounded-br-sm bg-blue-600 text-white"}`}>
                <div className={`mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${inbound ? "text-slate-500" : "text-blue-100"}`}>
                  <span className={`rounded px-1 py-px ${it.kind === "sms" ? (inbound ? "bg-blue-100 text-blue-700" : "bg-blue-500/60 text-white") : (inbound ? "bg-violet-100 text-violet-700" : "bg-violet-500/60 text-white")}`}>
                    {it.kind === "sms" ? <MessageSquare size={9} className="mr-0.5 inline" /> : <Mail size={9} className="mr-0.5 inline" />}{chanLabel}
                  </span>
                  {inbound ? "In" : "Out"}
                  <span className="font-normal normal-case opacity-80">{fmtDateTime(it.at)}</span>
                </div>
                {it.subject && <div className={`text-xs font-semibold ${inbound ? "text-slate-600" : "text-blue-100"}`}>{it.subject}</div>}
                <div className="whitespace-pre-wrap">{it.body}</div>
                {it.attachments && it.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {it.attachments.map((a, ai) => (
                      <button key={ai} onClick={() => downloadAttachment(a.path)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${inbound ? "bg-white text-blue-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50" : "bg-blue-500/60 text-white hover:bg-blue-500/80"}`}>
                        <FileText size={11} /> {a.name || "attachment"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => setMode("sms")} className={`rounded-md py-1.5 font-medium ${mode === "sms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><MessageSquare size={13} className="mr-1 inline" /> Text</button>
          <button onClick={() => setMode("email")} className={`rounded-md py-1.5 font-medium ${mode === "email" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Mail size={13} className="mr-1 inline" /> Email</button>
          <button onClick={() => setMode("note")} className={`rounded-md py-1.5 font-medium ${mode === "note" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"}`}><FileText size={13} className="mr-1 inline" /> Note</button>
        </div>

        {mode === "note" ? (
          <div className="flex items-end gap-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note to this client's timeline..." className="flex-1 resize-none rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm outline-none focus:border-amber-400" />
            <button onClick={saveNote} disabled={busy || !note.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"><FileText size={15} /> {busy ? "..." : "Add note"}</button>
          </div>
        ) : (
          <>
            {picks.length > 0 && (
              <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-400">
                <option value="">Insert a template...</option>
                {picks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {mode === "email" && (
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={mode === "email" ? 4 : 2} placeholder={canSend ? `Type a ${mode === "sms" ? "text" : "email"}...` : mode === "sms" ? "No phone on file" : "No email on file"} disabled={!canSend}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50" />

            {mode === "email" && (
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <input type="checkbox" checked={includeSig} onChange={(e) => setIncludeSig(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                    Include signature
                  </label>
                  <button onClick={() => setShowPreview((s) => !s)} className="text-xs font-medium text-blue-600 hover:underline">{showPreview ? "Hide" : "Show"} preview</button>
                </div>
                {showPreview && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Preview</div>
                    {subject && <div className="mb-1 font-semibold text-slate-800">{subject}</div>}
                    <div className="whitespace-pre-wrap text-slate-700">{emailPreviewBody || <span className="text-slate-400">Your email will appear here...</span>}</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex justify-end">
              <button onClick={send} disabled={busy || !body.trim() || !canSend} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">
                <Send size={15} /> {busy ? "Sending..." : mode === "sms" ? "Send text" : "Send email"}
              </button>
            </div>
          </>
        )}
        {err && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{err}</div>}
        {okMsg && <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Check size={13} /> {okMsg}</div>}
      </div>
    </div>
  );
}

// GHL-style inbox: leads with messages on the left, the thread + reply on the right
function Conversations({ leads, comms, unreadLeadIds, onSend, onAddNote, onOpen, markRead, markAllRead, templates = [], config = {}, openCompose }) {
  const newText = () => openCompose && openCompose({ lead: null, channel: "sms", to: "", subject: "", body: "", kind: "message" });
  const withMsgs = useMemo(() => {
    const latest = {};
    for (const c of comms) {
      const t = new Date(c.at).getTime();
      if (!latest[c.lead_id] || t > latest[c.lead_id].t) latest[c.lead_id] = { t, c };
    }
    return Object.entries(latest)
      .map(([leadId, v]) => ({ lead: leads.find((l) => l.id === leadId), last: v.c, t: v.t }))
      .filter((x) => x.lead)
      .sort((a, b) => b.t - a.t);
  }, [comms, leads]);

  const [selId, setSelId] = useState(withMsgs[0]?.lead.id || null);
  const selected = leads.find((l) => l.id === selId) || withMsgs[0]?.lead || null;
  const openThread = (id) => { setSelId(id); markRead && markRead(id); };
  const unreadCount = unreadLeadIds.size;

  if (withMsgs.length === 0) {
    return (
      <div className="mt-4">
        <div className="mb-3 flex justify-end"><button onClick={newText} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><MessageSquare size={15} /> New text</button></div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <MessageSquare size={28} className="mx-auto text-slate-300" />
          <div className="mt-2 text-sm font-medium text-slate-600">No conversations yet</div>
          <div className="mt-1 text-sm text-slate-400">Texts and emails you send, and replies you receive, show up here. Use New text to message any number.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-end">
        <button onClick={newText} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><MessageSquare size={15} /> New text</button>
      </div>
      <div className="grid gap-3 md:grid-cols-[320px_1fr]">
      <div className="flex max-h-[560px] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {unreadCount > 0 && (
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold text-blue-700">{unreadCount} unread</span>
            <button onClick={markAllRead} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">Mark all read</button>
          </div>
        )}
        {withMsgs.map(({ lead, last }) => {
          const unread = unreadLeadIds.has(lead.id);
          const active = selected?.id === lead.id;
          return (
            <button key={lead.id} onClick={() => openThread(lead.id)}
              className={`flex flex-col gap-0.5 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
              <div className="flex items-center gap-2">
                {unread ? <span onClick={(e) => { e.stopPropagation(); markRead && markRead(lead.id); }} title="Mark read" className="h-2.5 w-2.5 shrink-0 cursor-pointer rounded-full bg-blue-600 hover:ring-2 hover:ring-blue-200" /> : <span className="h-2.5 w-2.5 shrink-0" />}
                <span className={`truncate text-sm ${unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{leadTitle(lead)}</span>
                <span className="ml-auto shrink-0 text-[10px] text-slate-400">{fmtDateTime(new Date(last.at).getTime()).split(",")[0]}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                {last.direction === "in" ? "" : "You: "}
                <span className="truncate">{last.body}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div>
        {selected && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <button onClick={() => onOpen(selected.id)} className="text-sm font-bold text-slate-800 hover:text-blue-700">{leadTitle(selected)}</button>
              <StagePill status={selected.status} />
            </div>
            {(() => {
              const bits = [
                ["Business", selected.businessName],
                ["Rev/mo", selected.monthlyRevenue],
                ["In biz", selected.timeInBusiness],
                ["Score", selected.creditScore],
                ["Wants", selected.desiredAmount],
                ["Use", selected.fundingPurpose],
                ["Phone", selected.phone],
              ].filter(([, v]) => v);
              return (
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                  {bits.length === 0 && <span className="italic text-slate-400">No business info captured yet, open the file to add it.</span>}
                  {bits.map(([k, v]) => <span key={k}><span className="text-slate-400">{k}:</span> <b className="text-slate-700">{v}</b></span>)}
                  {selected.product && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${selected.product === "SLOC" ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>{selected.product}</span>}
                  {selected.lenderTag && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{selected.lenderTag}</span>}
                </div>
              );
            })()}
            <Conversation lead={selected} comms={comms} onSend={onSend} onAddNote={onAddNote} templates={templates} config={config} />
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* ---------------- Calendar ---------------- */

function ApptModal({ onClose, onSave, leads, team, userEmail, editing }) {
  const pad = (n) => String(n).padStart(2, "0");
  const start = editing ? new Date(editing.due_at) : new Date(Date.now() + 3600000);
  const [leadId, setLeadId] = useState(editing?.lead_id || "");
  const [q, setQ] = useState("");
  const [date, setDate] = useState(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
  const [time, setTime] = useState(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
  const [owner, setOwner] = useState(editing?.assigned_to || userEmail || "");
  const [title, setTitle] = useState(editing?.title || "");
  const [note, setNote] = useState(editing?.notes || "");

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = leads || [];
    if (!s) return pool.slice(0, 6);
    return pool.filter((l) => `${l.name || ""} ${l.businessName || ""} ${l.phone || ""} ${l.email || ""}`.toLowerCase().includes(s)).slice(0, 6);
  }, [q, leads]);
  const picked = (leads || []).find((l) => l.id === leadId);

  const save = () => {
    const when = new Date(`${date}T${time}:00`);
    if (isNaN(when.getTime())) return;
    onSave({
      id: editing?.id,
      lead_id: leadId || null,
      title: title || (picked ? `Call with ${picked.name || picked.businessName || "client"}` : "Appointment"),
      notes: note || null,
      due_at: when.toISOString(),
      assigned_to: owner || userEmail || "all",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="mt-10 w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">{editing ? "Edit appointment" : "New appointment"}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-3">
          <Labeled label="Client">
            {picked ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-700">{picked.name || picked.businessName}</span>
                <button onClick={() => { setLeadId(""); setQ(""); }} className="ml-auto text-xs font-semibold text-blue-600 hover:underline">change</button>
              </div>
            ) : (
              <>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email" className={inputCls} />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-100">
                  {matches.map((l) => (
                    <button key={l.id} onClick={() => setLeadId(l.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-blue-50">
                      <span className="font-medium text-slate-700">{l.name || l.businessName || "(no name)"}</span>
                      <span className="ml-auto text-xs text-slate-400">{l.phone || l.email || ""}</span>
                    </button>
                  ))}
                  {!matches.length && <div className="px-3 py-2 text-xs text-slate-400">No matches</div>}
                </div>
              </>
            )}
          </Labeled>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Labeled label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Labeled>
          <Labeled label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} /></Labeled>
        </div>

        <div className="mt-2"><Labeled label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with client" className={inputCls} /></Labeled></div>
        <div className="mt-2"><Labeled label="Notes (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Labeled></div>

        <div className="mt-2">
          <Labeled label="Owner">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls}>
              <option value={userEmail || ""}>Me</option>
              {(team || []).map((m) => <option key={m.email} value={m.email}>{m.first}{m.last ? " " + m.last : ""}</option>)}
              <option value="all">Everyone</option>
            </select>
          </Labeled>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">{editing ? "Save changes" : "Add appointment"}</button>
        </div>
      </div>
    </div>
  );
}

const CONFIRM_UI = {
  confirmed: { chip: "bg-emerald-600 text-white", dot: "bg-emerald-100 text-emerald-800", row: "border-emerald-300 bg-emerald-50", label: "Confirmed" },
  sent: { chip: "bg-amber-500 text-white", dot: "bg-amber-100 text-amber-800", row: "border-amber-200 bg-amber-50", label: "Awaiting reply" },
  declined: { chip: "bg-rose-600 text-white", dot: "bg-rose-100 text-rose-800", row: "border-rose-300 bg-rose-50", label: "Needs reschedule" },
};
function confirmUi(a) { return CONFIRM_UI[a && a.confirm_state] || null; }

function Calendar({ activities = [], leads = [], config = {}, userEmail, onOpen, addActivity, updateActivity, deleteActivity }) {
  const team = config.team || [];
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); });
  const [modal, setModal] = useState(null); // null | {} | {editing}
  const [who, setWho] = useState("all");

  const appts = useMemo(() => (activities || []).filter((a) => a.type === "appointment" && !a.done), [activities]);
  const visible = useMemo(() => who === "all" ? appts : appts.filter((a) => a.assigned_to === who), [appts, who]);

  const leadName = (id) => { const l = (leads || []).find((x) => x.id === id); return l ? (l.name || l.businessName || "(no name)") : ""; };
  const ownerName = (e) => { if (!e || e === "all") return "Everyone"; const m = team.find((x) => (x.email || "").toLowerCase() === String(e).toLowerCase()); return m ? m.first : String(e).split("@")[0]; };
  const sameDay = (ms, d) => { const x = new Date(ms); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };

  const byDay = useMemo(() => {
    const m = new Map();
    for (const a of visible) { const d = new Date(a.due_at); const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; if (!m.has(k)) m.set(k, []); m.get(k).push(a); }
    for (const v of m.values()) v.sort((x, y) => new Date(x.due_at) - new Date(y.due_at));
    return m;
  }, [visible]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startPad = first.getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let i = 1; i <= days; i++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    return out;
  }, [cursor]);

  const dayList = useMemo(() => {
    const k = `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`;
    return byDay.get(k) || [];
  }, [byDay, selected]);

  const upcoming = useMemo(() => visible.filter((a) => new Date(a.due_at).getTime() >= Date.now()).sort((x, y) => new Date(x.due_at) - new Date(y.due_at)).slice(0, 8), [visible]);

  const save = (row) => {
    if (row.id) updateActivity(row.id, { title: row.title, notes: row.notes, due_at: row.due_at, assigned_to: row.assigned_to, lead_id: row.lead_id });
    else addActivity(row.lead_id, { type: "appointment", title: row.title, notes: row.notes, dueAt: new Date(row.due_at).getTime(), alarm: false, assignedTo: row.assigned_to });
  };

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const timeOf = (a) => new Date(a.due_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50">‹</button>
        <h2 className="text-lg font-bold text-slate-800">{monthLabel}</h2>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50">›</button>
        <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(new Date(d.getFullYear(), d.getMonth(), d.getDate())); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Today</button>
        <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="all">Everyone</option>
          {team.map((m) => <option key={m.email} value={m.email}>{m.first}</option>)}
        </select>
        <button onClick={() => setModal({})} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} /> Appointment</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`p${i}`} />;
            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const list = byDay.get(k) || [];
            const isToday = sameDay(Date.now(), d);
            const isSel = sameDay(d.getTime(), selected);
            return (
              <button key={k} onClick={() => setSelected(d)}
                className={`flex min-h-[62px] flex-col rounded-lg border p-1 text-left transition ${isSel ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:bg-slate-50"}`}>
                <span className={`text-xs font-bold ${isToday ? "text-blue-600" : "text-slate-600"}`}>{d.getDate()}</span>
                {list.slice(0, 2).map((a) => (
                  <span key={a.id} className={`mt-0.5 truncate rounded px-1 text-[10px] font-semibold ${(confirmUi(a) || { dot: "bg-slate-100 text-slate-600" }).dot}`}>{timeOf(a)} {leadName(a.lead_id) || a.title}</span>
                ))}
                {list.length > 2 && <span className="mt-0.5 text-[10px] font-semibold text-slate-400">+{list.length - 2} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-700">{selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
        {!dayList.length && <p className="mt-2 text-sm text-slate-400">No appointments this day.</p>}
        <div className="mt-2 space-y-2">
          {dayList.map((a) => (
            <div key={a.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${(confirmUi(a) || { row: "border-slate-100 bg-slate-50" }).row}`}>
              <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-white">{timeOf(a)}</span>
              <span className="text-sm font-semibold text-slate-800">{a.title || "Appointment"}</span>
              {a.lead_id && <button onClick={() => onOpen(a.lead_id)} className="text-xs font-semibold text-blue-600 hover:underline">{leadName(a.lead_id)} →</button>}
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{ownerName(a.assigned_to)}</span>
              {confirmUi(a) && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${confirmUi(a).chip}`}>{confirmUi(a).label}</span>}
              {a.confirm_state !== "confirmed" && <button onClick={() => updateActivity(a.id, { confirm_state: "confirmed", confirmed_at: new Date().toISOString() })} className="rounded border border-emerald-300 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">Mark confirmed</button>}
              {a.notes && <span className="w-full text-xs text-slate-500">{a.notes}</span>}
              <div className="ml-auto flex gap-1">
                <button onClick={() => setModal({ editing: a })} className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm("Delete this appointment?")) deleteActivity(a.id); }} className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-700">Coming up</h3>
        {!upcoming.length && <p className="mt-2 text-sm text-slate-400">Nothing scheduled yet.</p>}
        <div className="mt-2 space-y-1.5">
          {upcoming.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-40 shrink-0 text-xs font-semibold text-slate-500">{new Date(a.due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} {timeOf(a)}</span>
              <span className="font-medium text-slate-700">{a.title || "Appointment"}</span>
              {a.lead_id && <button onClick={() => onOpen(a.lead_id)} className="text-xs font-semibold text-blue-600 hover:underline">{leadName(a.lead_id)} →</button>}
              {confirmUi(a) && <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${confirmUi(a).chip}`}>{confirmUi(a).label}</span>}
              <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ${confirmUi(a) ? "" : "ml-auto"}`}>{ownerName(a.assigned_to)}</span>
            </div>
          ))}
        </div>
      </div>

      {modal && <ApptModal onClose={() => setModal(null)} onSave={save} leads={leads} team={team} userEmail={userEmail} editing={modal.editing} />}
    </div>
  );
}

function Activities({ activities, leads, onOpen, completeActivity, deleteActivity }) {
  const [showDone, setShowDone] = useState(false);
  const leadById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const open = activities.filter((a) => !a.done);
  const done = activities.filter((a) => a.done).slice(-30).reverse();

  const groups = [
    ["overdue", "Overdue", "border-rose-200 bg-rose-50 text-rose-700"],
    ["today", "Today", "border-orange-200 bg-orange-50 text-orange-700"],
    ["week", "Next 7 days", "border-slate-200 bg-white text-slate-600"],
    ["later", "Later", "border-slate-200 bg-white text-slate-500"],
  ];

  const Row = ({ a }) => {
    const lead = leadById[a.lead_id];
    const due = new Date(a.due_at).getTime();
    const overdue = !a.done && due < Date.now();
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-sm last:border-0">
        {!a.done && (
          <button onClick={() => completeActivity(a.id, true)} title="Mark done"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50" />
        )}
        {a.done && <Check size={16} className="shrink-0 text-emerald-500" />}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">{a.type}</span>
        <span className={`font-medium ${a.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{a.title || "(untitled)"}</span>
        {lead && <button onClick={() => onOpen(lead.id)} className="text-xs font-semibold text-blue-700 hover:underline">{leadTitle(lead)}</button>}
        {a.notes && <span className="text-xs text-slate-400">{a.notes}</span>}
        <span className={`ml-auto text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-500"}`}>{fmtDateTime(due)}</span>
        <button onClick={() => deleteActivity(a.id)} className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={14} /></button>
      </div>
    );
  };

  const counts = { overdue: 0, today: 0 };
  open.forEach((a) => { const b = actBucket(a); if (counts[b] !== undefined) counts[b]++; });

  const clearAllOverdue = () => {
    const overdue = open.filter((a) => actBucket(a) === "overdue");
    if (!overdue.length) return;
    if (!confirm(`Mark all ${overdue.length} overdue tasks as done?`)) return;
    overdue.forEach((a) => completeActivity(a.id, true));
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">Overdue</div>
          <div className="mt-1 text-2xl font-bold text-rose-800">{counts.overdue}</div>
          {counts.overdue > 0 && <button onClick={clearAllOverdue} className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Clear all overdue</button>}
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Today</div>
          <div className="mt-1 text-2xl font-bold text-orange-800">{counts.today}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">All open</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{open.length}</div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <CalendarClock size={28} className="mx-auto text-slate-300" />
          <div className="mt-2 text-sm font-medium text-slate-600">Nothing scheduled</div>
          <div className="mt-1 text-sm text-slate-400">Open a lead and use "Schedule a call or task" to add one.</div>
        </div>
      ) : groups.map(([key, label, cls]) => {
        const items = open.filter((a) => actBucket(a) === key);
        if (items.length === 0) return null;
        return (
          <div key={key} className={`rounded-xl border ${cls.split(" ").slice(0, 2).join(" ")} p-1`}>
            <div className={`px-3 py-2 text-sm font-bold ${cls.split(" ").slice(2).join(" ")}`}>{label} ({items.length})</div>
            <div className="rounded-lg bg-white">{items.map((a) => <Row key={a.id} a={a} />)}</div>
          </div>
        );
      })}

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone((s) => !s)} className="text-sm font-medium text-slate-400 hover:text-slate-600">
            {showDone ? "Hide" : "Show"} completed ({done.length})
          </button>
          {showDone && <div className="mt-2 rounded-xl border border-slate-200 bg-white p-1">{done.map((a) => <Row key={a.id} a={a} />)}</div>}
        </div>
      )}
    </div>
  );
}

function Followups({ dueList, config, onOpen, openCompose, updateLead }) {
  const [showAll, setShowAll] = useState(false);
  const sendStep = (lead, step) => {
    const tpl = step.template;
    if (!tpl) return;
    openCompose({
      lead, channel: tpl.channel,
      to: tpl.channel === "sms" ? lead.phone : lead.email,
      subject: fillTokens(tpl.subject, lead, config),
      body: fillTokens(tpl.body, lead, config),
      kind: "cadence", extra: { stage: lead.status, step: step.i },
    });
  };
  const snooze = (lead, days) => updateLead(lead.id, { snoozeUntil: Date.now() + days * DAY });
  const pause = (lead) => updateLead(lead.id, { automationPaused: true });

  const overdue = dueList.filter((x) => relativeDue(x.step.dueAt).overdue);
  const upcoming = dueList.filter((x) => !relativeDue(x.step.dueAt).overdue);
  const shown = showAll ? dueList : dueList.slice(0, 25);

  if (dueList.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
        <Check size={28} className="mx-auto text-emerald-400" />
        <div className="mt-2 text-sm font-medium text-slate-600">All caught up</div>
        <div className="mt-1 text-sm text-slate-400">No follow-ups are due right now.</div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">Overdue</div>
          <div className="mt-1 text-2xl font-bold text-rose-800">{overdue.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due soon</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{upcoming.length}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {shown.map(({ l, step }) => {
          const rel = relativeDue(step.dueAt);
          return (
            <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onOpen(l.id)} className="font-semibold text-slate-800 hover:text-blue-700">{leadTitle(l)}</button>
                <StagePill status={l.status} />
                <span className={`text-xs font-semibold ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>
                <span className="text-xs text-slate-400">{step.template?.name}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => sendStep(l, step)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${step.channel === "sms" ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50"}`}>
                    {step.channel === "sms" ? <MessageSquare size={14} /> : <Mail size={14} />} Send
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400">Snooze</span>
                {[1, 3, 7].map((d) => (
                  <button key={d} onClick={() => snooze(l, d)} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 hover:bg-slate-200">{d}d</button>
                ))}
                <button onClick={() => pause(l)} className="ml-1 rounded-md px-2 py-1 font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600">Pause automation</button>
              </div>
            </div>
          );
        })}
      </div>

      {!showAll && dueList.length > 25 && (
        <button onClick={() => setShowAll(true)} className="rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
          Show all {dueList.length}
        </button>
      )}
    </div>
  );
}

function Applications({ leads, lenders = [], onOpen, onDelete }) {
  // Leads that have submitted an application (an Application doc on file) or are past that point.
  const apps = useMemo(() => {
    return (leads || [])
      .map((l) => {
        const docs = Array.isArray(l.documents) ? l.documents : [];
        const appDoc = docs.find((d) => /application/i.test((d.label || "") + (d.name || "")));
        const hasApp = !!appDoc || ["app_sent", "app_received", "app_reports_received", "submitted", "pre_approved", "contracts_out", "funded"].includes(l.status);
        return { lead: l, docs, appDoc, submittedAt: appDoc?.uploadedAt || l.lastTouchAt || 0, subs: Array.isArray(l.submissions) ? l.submissions : [], hasApp };
      })
      .filter((a) => a.hasApp)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }, [leads]);

  const stLabel = (s) => (STAGES.find((x) => x.key === s) || {}).label || s;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800">Applications</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{apps.length}</span>
      </div>
      {apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No applications submitted yet. When a client completes the application form, they show up here.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {apps.map(({ lead, docs, submittedAt, subs }) => (
            <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onOpen(lead.id)} className="text-base font-bold text-blue-700 hover:underline">{lead.businessName || lead.name || "Unknown"}</button>
                <span className="text-sm text-slate-400">{lead.name}</span>
                {docs.length > 0
                  ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Completed by client</span>
                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Sent, waiting on client</span>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{stLabel(lead.status)}</span>
                {submittedAt > 0 && <span className="ml-auto text-xs text-slate-400">{docs.length > 0 ? "Received" : "Sent"} {fmtDateTime(submittedAt).split(",")[0]}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-400">Docs:</span>
                {docs.length ? docs.map((d, i) => <span key={i} className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">{d.label || d.name}</span>) : <span className="text-slate-400">none</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {subs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sent to:</span>
                    {subs.map((s) => {
                      const c = { "Submitted": "bg-slate-100 text-slate-700", "Pre-approved": "bg-amber-100 text-amber-800", "Approved": "bg-emerald-100 text-emerald-800", "Declined": "bg-rose-100 text-rose-700", "Funded": "bg-blue-100 text-blue-800" }[s.status] || "bg-slate-100 text-slate-700";
                      return <span key={s.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{s.lender}: {s.status}</span>;
                    })}
                  </div>
                ) : (
                  <span className="text-xs italic text-slate-400">Not sent to any lender yet</span>
                )}
                <button onClick={() => onOpen(lead.id)} className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Open & send to lender</button>
                <button onClick={() => { if (window.confirm(`Delete the application for ${lead.businessName || lead.name || "this client"}? This removes the client and their application entirely. This cannot be undone.`)) onDelete(lead.id); }} className="rounded-lg border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50" title="Delete application"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Team({ leads, onOpen, config = {} }) {
  // Show friendly first names instead of raw emails.
  const repName = (rep) => {
    if (rep === "automation") return "Automation";
    if (rep === "(unassigned)") return "Unassigned";
    const m = (config.team || []).find((t) => (t.email || "").toLowerCase() === String(rep || "").toLowerCase());
    return m ? m.first : rep;
  };
  const [range, setRange] = useState("today"); // today | yesterday | week | month | custom
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [repFilter, setRepFilter] = useState("all");

  // Resolve the active window [start, end)
  const { start, end, label } = useMemo(() => {
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
    const now = new Date();
    if (range === "today") { const s = startOfDay(now); return { start: s, end: s + 86400000, label: "Today" }; }
    if (range === "yesterday") { const s = startOfDay(now) - 86400000; return { start: s, end: s + 86400000, label: "Yesterday" }; }
    if (range === "week") { const s = startOfDay(now) - 6 * 86400000; return { start: s, end: startOfDay(now) + 86400000, label: "Last 7 days" }; }
    if (range === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { start: d.getTime(), end: startOfDay(now) + 86400000, label: "This month" }; }
    return { start: startOfDay(from + "T00:00:00"), end: startOfDay(to + "T00:00:00") + 86400000, label: `${from} to ${to}` };
  }, [range, from, to]);

  // Flatten all touches with lead context, within the window
  const acts = useMemo(() => {
    const out = [];
    for (const l of leads) for (const t of (l.touches || [])) {
      if (t.at >= start && t.at < end) out.push({ ...t, leadId: l.id, leadName: leadTitle(l), rep: t.by || (t.auto ? "automation" : "(unassigned)") });
    }
    return out;
  }, [leads, start, end]);

  // Lender-submission outcomes per rep (attributed to the lead's owner).
  const subStats = useMemo(() => {
    const m = {};
    const bump = (rep, key) => { m[rep] = m[rep] || { submitted: 0, approved: 0, declined: 0 }; m[rep][key]++; };
    for (const l of leads) {
      const owner = l.ownerEmail || "(unassigned)";
      for (const s of (l.submissions || [])) {
        if (s.sentAt >= start && s.sentAt < end) bump(owner, "submitted");
        if (s.respondedAt && s.respondedAt >= start && s.respondedAt < end) {
          if (["Approved", "Pre-approved", "Funded"].includes(s.status)) bump(owner, "approved");
          else if (s.status === "Declined") bump(owner, "declined");
        }
      }
    }
    return m;
  }, [leads, start, end]);

  // Credit reports per rep: count leads that have a credit report on file (document or uploaded report),
  // attributed to the lead's owner, by when the report landed. Robust regardless of how it arrived.
  const reportStats = useMemo(() => {
    const m = {};
    for (const l of leads) {
      let when = 0, by = null;
      for (const d of (Array.isArray(l.documents) ? l.documents : [])) {
        if (/credit/i.test((d.label || "") + (d.name || "")) && d.uploadedAt && d.uploadedAt > when) { when = d.uploadedAt; by = d.by; }
      }
      if (l.reportPath && l.reportUploadedAt && l.reportUploadedAt > when) { when = l.reportUploadedAt; by = null; }
      // manual "report pulled" logs (e.g. reports pulled outside the app), credited to the rep
      for (const t of (Array.isArray(l.touches) ? l.touches : [])) {
        if (t.kind === "report" && t.at && t.at > when) { when = t.at; by = t.by; }
      }
      if (when && when >= start && when < end) {
        const rep = (by && String(by).includes("@")) ? by : (l.ownerEmail || "(unassigned)");
        m[rep] = (m[rep] || 0) + 1;
      }
    }
    return m;
  }, [leads, start, end]);

  const reps = useMemo(() => [...new Set([...acts.map((a) => a.rep), ...Object.keys(subStats), ...Object.keys(reportStats)])].sort(), [acts, subStats, reportStats]);
  const shownReps = repFilter === "all" ? reps : reps.filter((r) => r === repFilter);

  const statsFor = (rep) => {
    const mine = acts.filter((a) => a.rep === rep);
    const calls = mine.filter((a) => a.kind === "call");
    const sub = subStats[rep] || { submitted: 0, approved: 0, declined: 0 };
    return {
      calls: calls.length,
      voicemails: calls.filter((a) => /voicemail/i.test(a.disposition || "")).length,
      spoke: calls.filter((a) => /spoke/i.test(a.disposition || "")).length,
      texts: mine.filter((a) => a.channel === "sms").length,
      emails: mine.filter((a) => a.channel === "email").length,
      notes: mine.filter((a) => a.kind === "note" || (a.kind === "call" && a.note)).length,
      reports: reportStats[rep] || 0,
      submitted: sub.submitted,
      approved: sub.approved,
      declined: sub.declined,
      total: mine.length,
    };
  };

  // Combined totals across the humans (exclude automation from the "team" totals)
  const humanReps = reps.filter((r) => r !== "automation");
  const totals = humanReps.reduce((acc, r) => { const s = statsFor(r); Object.keys(s).forEach((k) => acc[k] = (acc[k] || 0) + s[k]); return acc; }, {});

  const recent = useMemo(() => [...acts].filter((a) => repFilter === "all" || a.rep === repFilter).sort((a, b) => b.at - a.at).slice(0, 120), [acts, repFilter]);

  const RANGES = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["month", "This month"], ["custom", "Custom"]];
  const cellsOf = (s) => [["Calls", s.calls], ["Voicemails", s.voicemails], ["Spoke to", s.spoke], ["Texts", s.texts], ["Emails", s.emails], ["Reports", s.reports], ["Notes", s.notes]];

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {RANGES.map(([k, lbl]) => (
            <button key={k} onClick={() => setRange(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${range === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{lbl}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-1.5 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-blue-400" />
            <span className="text-slate-400">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-blue-400" />
          </div>
        )}
        <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400">
          <option value="all">All employees</option>
          {reps.map((r) => <option key={r} value={r}>{repName(r)}</option>)}
        </select>
      </div>

      {/* team totals */}
      {repFilter === "all" && humanReps.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-900"><User size={15} /> All employees · {label} <span className="font-normal text-blue-500">({humanReps.length} active)</span></div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {cellsOf(totals).map(([lbl, val]) => (
              <div key={lbl} className="rounded-lg bg-white p-3 text-center"><div className="text-2xl font-bold text-blue-800">{val || 0}</div><div className="text-xs text-slate-400">{lbl}</div></div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white p-3 text-center"><div className="text-2xl font-bold text-slate-800">{totals.submitted || 0}</div><div className="text-xs text-slate-500">Apps submitted</div></div>
            <div className="rounded-lg bg-white p-3 text-center"><div className="text-2xl font-bold text-emerald-700">{totals.approved || 0}</div><div className="text-xs text-emerald-600">Approvals</div></div>
            <div className="rounded-lg bg-white p-3 text-center"><div className="text-2xl font-bold text-rose-700">{totals.declined || 0}</div><div className="text-xs text-rose-600">Declines</div></div>
          </div>
        </div>
      )}

      {/* per-employee */}
      {shownReps.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">No activity logged for {label}.</div>}
      {shownReps.map((rep) => {
        const s = statsFor(rep);
        return (
          <div key={rep} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              {rep === "automation" ? <Zap size={15} className="text-violet-500" /> : <User size={15} className="text-blue-600" />} {repName(rep)}
              <span className="ml-auto text-xs font-medium text-slate-400">{s.total} actions</span>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {cellsOf(s).map(([lbl, val]) => (
                <div key={lbl} className="rounded-lg bg-slate-50 p-3 text-center"><div className="text-2xl font-bold text-slate-800">{val}</div><div className="text-xs text-slate-400">{lbl}</div></div>
              ))}
            </div>
            {rep !== "automation" && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-100 p-3 text-center"><div className="text-2xl font-bold text-slate-800">{s.submitted}</div><div className="text-xs text-slate-500">Apps submitted</div></div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center"><div className="text-2xl font-bold text-emerald-700">{s.approved}</div><div className="text-xs text-emerald-600">Approvals</div></div>
                <div className="rounded-lg bg-rose-50 p-3 text-center"><div className="text-2xl font-bold text-rose-700">{s.declined}</div><div className="text-xs text-rose-600">Declines</div></div>
              </div>
            )}
          </div>
        );
      })}

      {/* activity log */}
      <div className="rounded-xl border border-slate-200 bg-white p-1">
        <div className="px-3 py-2 text-sm font-bold text-slate-800">Activity · {label} ({recent.length})</div>
        {recent.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-400">No activity in this range.</p> : (
          <div className="flex flex-col">
            {recent.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-0">
                <span className="text-xs text-slate-400">{fmtDateTime(a.at)}</span>
                <button onClick={() => onOpen(a.leadId)} className="font-semibold text-slate-700 hover:text-blue-700">{a.leadName}</button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.kind === "call" ? (a.disposition || "call") : (a.channel === "sms" ? "text" : a.channel === "email" ? "email" : a.kind)}</span>
                {a.note && <span className="text-slate-500">{a.note}</span>}
                <span className="ml-auto text-xs font-medium text-slate-400">{a.rep}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
