import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  { key: "app_sent", label: "Application Sent", tone: "purple" },
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
  appLink: "https://tinyurl.com/asapfundingapp",
  signature: "Joe at ASAP Funding USA",
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
    body: `Hi {{first}}, it's Joe with ASAP. I just gave you a call about the Facebook ad you responded to on getting your business approved. Give me a quick call back or shoot me a text when you get a sec.` },
  { id: "vm_sms_b", pool: "vm_sms", name: "VM text: story", channel: "sms", subject: "",
    body: `Hi {{first}}, Joe with ASAP here. I just called you about the Facebook ad you responded to on getting your business approved. Call or text me back and I will walk you through it.` },
  { id: "vm_sms_c", pool: "vm_sms", name: "VM text: myth bust", channel: "sms", subject: "",
    body: `Hi {{first}}, it's Joe from ASAP. I just tried calling you about the Facebook ad you responded to on getting your business approved. This is not spam, just following up like you asked. Text me back a good time to connect.` },
  { id: "vm_sms_d", pool: "vm_sms", name: "VM text: curiosity", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. I just gave you a call about the Facebook ad you responded to on getting your business approved. Whenever you have a sec, call or text me back and I will keep it quick.` },

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
    body: `Hi {{first}}, Joe with ASAP. Here is the one thing between you and knowing exactly what you qualify for, your report: {{link}} 5 minutes, soft pull, zero hit to your score. Text me DONE when it is in and I will get to work.` },
  { id: "int_sms_b", pool: "int_sms", name: "Interested text: story", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. You did the hard part by reaching out. This part takes 5 minutes: pull your report here so I can show you real numbers, not guesses: {{link}} No hit to your score.` },
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
    body: `{{first}}, Joe with ASAP. Quick one: were you able to get your MyScoreIQ account created? That report is the only thing between you and knowing exactly what you qualify for. Here is the link again, 5 minutes: {{link}} Reply DONE when it is set and I will take it from there.` },
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
    body: `{{first}}, Joe with ASAP. Just thinking about your business, still want to help you get where you are trying to go. Got a couple minutes to talk this week?` },
  { id: "app_email_a", pool: "app_email", name: "Application: more funding (email)", channel: "email", subject: "Your funding application, {{first}}",
    body: `Hi {{first}},

To go for more funding we need a short application along with your last 4 months of business bank statements. You can complete and sign everything in one place here, about 10 minutes:

{{applink}}

Have your bank statements, a voided check, and your driver's license handy. Reply or text me if anything comes up.

{{signature}}` },

  // ============ URGENCY / NUDGE: text (pool urgency_sms) ============
  { id: "urg_sms_a", pool: "urgency_sms", name: "Urgency text: window", channel: "sms", subject: "",
    body: `{{first}}, quick nudge from Joe at ASAP. Still want to get your business in a position to get approved? Pull your report here and I take it from there: {{link}}` },
  { id: "urg_sms_b", pool: "urgency_sms", name: "Urgency text: not a pest", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. Not trying to bug you, just do not want you to miss your window. 5 minutes here and I go to work: {{link}}` },
  { id: "urg_sms_c", pool: "urgency_sms", name: "Urgency text: one more", channel: "sms", subject: "",
    body: `{{first}}, it is Joe at ASAP. Circling back one more time. Ready when you are: {{link}} Reply STOP anytime and I will hold off.` },
  { id: "urg_sms_d", pool: "urgency_sms", name: "Urgency text: things change", channel: "sms", subject: "",
    body: `{{first}}, Joe here. A lot can change in a few weeks. If now is a better time, here is your link: {{link}}` },
  { id: "urg_sms_e", pool: "urgency_sms", name: "Urgency text: still on desk", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. Still have your file on my desk. Want me to keep going? {{link}}` },
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
    body: `{{first}}, Joe with ASAP. I have reached out a few times and do not want to be a pest. I will close your file for now. If you ever want to pick it back up, just text me. No hard feelings.` },
  { id: "break_sms_b", pool: "breakup_sms", name: "Breakup text: last call", channel: "sms", subject: "",
    body: `{{first}}, last one from me for now. If getting your business approved is still a goal, here is your link: {{link}} If not, no worries at all and I will step back.` },
  { id: "break_sms_c", pool: "breakup_sms", name: "Breakup text: door open", channel: "sms", subject: "",
    body: `{{first}}, Joe here. Going to give you some space. The door stays open, text me anytime and we pick right back up where we left off.` },

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
  { id: "vm_sms_e", pool: "vm_sms", name: "VM text: quick", channel: "sms", subject: "",
    body: `{{first}}, Joe at ASAP. Tried you by phone about the Facebook ad on getting your business approved. Got 2 minutes today? Text me back.` },
  { id: "vm_sms_f", pool: "vm_sms", name: "VM text: worth it", channel: "sms", subject: "",
    body: `{{first}}, it is Joe with ASAP. You reached out about getting your business approved and I just missed you. This is worth 5 minutes of your day, promise. Call or text back.` },
  { id: "vm_email_d", pool: "vm_email", name: "VM email: still here", channel: "email", subject: "Still here when you are ready, {{first}}",
    body: `Hey {{first}},

You responded to our Facebook ad about getting your business approved and I have been trying to connect. No rush, but I did not want your inquiry to fall through the cracks.

Whenever you have a few minutes, reply here or give me a call and I will show you what you qualify for. It is free to look and it does not touch your score.

{{signature}}` },

  // ============ EXTRA INTERESTED / report-link variety ============
  { id: "int_sms_e", pool: "int_sms", name: "Interested text: curiosity 2", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. I genuinely think you will be surprised by what you qualify for. Only way to know is your report: {{link}} Soft pull, no score hit.` },
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
    body: `{{first}}, Joe at ASAP. Were you able to get your report pulled? If the link gave you trouble, here it is again: {{link}} Happy to walk you through it.` },
  { id: "acct_email_c", pool: "acct_email", name: "Account check email: stuck", channel: "email", subject: "Did the link give you trouble, {{first}}?",
    body: `Hey {{first}},

Checking in. I do not see your report on my end yet, so I wanted to make sure the link worked for you. Sometimes it is a quick fix.

Here it is again: {{link}}

If you hit a snag, just reply and tell me where you got stuck. I will get you through it in a couple minutes.

{{signature}}` },

  // ============ EXTRA SUCCESS STORY variety ============
  { id: "story_sms_d", pool: "story_sms", name: "Success story text: turnaround", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. Had an owner this month who was sure they would get told no everywhere. We found their yes. I would love to do the same for you: {{link}}` },
  { id: "story_email_d", pool: "story_email", name: "Success story email: rough credit", channel: "email", subject: "Rough credit is not the end, {{first}}",
    body: `Hey {{first}},

Story for you. Owner came in convinced their credit made them un-fundable. Low score, a couple of old marks, the works. We looked past the number, matched them to the right lender, and got them approved.

Your file might have a similar story hiding in it. I will not know until I see it. Soft pull, 5 minutes: {{link}}

{{signature}}` },

  // ============ EXTRA CALLBACK variety ============
  { id: "cb_sms_c", pool: "cb_sms", name: "Call back text: reconnect", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. You asked me to circle back, so here I am. Got a few minutes now to pick up where we left off?` },
  { id: "cb_sms_d", pool: "cb_sms", name: "Call back text: good time", channel: "sms", subject: "",
    body: `{{first}}, Joe at ASAP. Trying to catch you at a better time. What works today, morning or afternoon? I will make it quick.` },
  { id: "cb_sms_e", pool: "cb_sms", name: "Call back text: ready", channel: "sms", subject: "",
    body: `{{first}}, Joe here. Ready to pick this back up whenever you are. Text me a good time and I will call you then.` },
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
    body: `{{first}}, Joe with ASAP. I sent over the application to get you moving. Were you able to get it filled out and sent back? Let me know if you hit any snags.` },
  { id: "appchase_sms_b", pool: "appchase_sms", name: "App chase text: almost there", channel: "sms", subject: "",
    body: `{{first}}, Joe here. You are one step away. Once that application is back to me I can get everything moving on my end. Need anything from me to finish it?` },
  { id: "appchase_sms_c", pool: "appchase_sms", name: "App chase text: quick check", channel: "sms", subject: "",
    body: `{{first}}, quick check from Joe at ASAP. Any questions on the application I sent? Happy to walk you through any part of it. Just reply here.` },
  { id: "appchase_sms_d", pool: "appchase_sms", name: "App chase text: help", channel: "sms", subject: "",
    body: `{{first}}, Joe with ASAP. If the application looked like a lot, do not worry, most of it is quick. Text me and I will help you knock it out in a few minutes.` },

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
    { day: 0, pool: "vm_sms" },
    { day: 0, pool: "vm_email" },
    { day: 1, pool: "vm_sms" },
    { day: 2, pool: "vm_email" },
    { day: 3, pool: "vm_sms" },
    { day: 4, pool: "value_email" },
    { day: 5, pool: "urgency_sms" },
    { day: 6, pool: "vm_email" },
    { day: 8, pool: "vm_sms" },
    { day: 10, pool: "proof_email" },
    { day: 12, pool: "urgency_sms" },
    { day: 14, pool: "value_email" },
    { day: 17, pool: "vm_sms" },
    { day: 20, pool: "vm_email" },
    { day: 23, pool: "urgency_sms" },
    { day: 26, pool: "proof_email" },
    { day: 30, pool: "vm_sms" },
    { day: 34, pool: "value_email" },
    { day: 38, pool: "urgency_sms" },
    { day: 42, pool: "vm_email" },
    { day: 46, pool: "vm_sms" },
    { day: 50, pool: "proof_email" },
    { day: 54, pool: "urgency_sms" },
    { day: 57, pool: "breakup_email" },
    { day: 60, pool: "breakup_sms" },
  ],
  interested: [
    { day: 0, pool: "int_sms" },
    { day: 0, pool: "int_email" },
    { day: 1, pool: "acct_sms" },
    { day: 2, pool: "acct_email" },
    { day: 3, pool: "int_sms" },
    { day: 4, pool: "story_email" },
    { day: 5, pool: "acct_sms" },
    { day: 6, pool: "value_email" },
    { day: 8, pool: "urgency_sms" },
    { day: 10, pool: "story_email" },
    { day: 12, pool: "int_sms" },
    { day: 14, pool: "proof_email" },
    { day: 17, pool: "story_sms" },
    { day: 20, pool: "value_email" },
    { day: 23, pool: "urgency_sms" },
    { day: 26, pool: "story_email" },
    { day: 30, pool: "int_sms" },
    { day: 34, pool: "proof_email" },
    { day: 38, pool: "story_sms" },
    { day: 42, pool: "value_email" },
    { day: 46, pool: "urgency_sms" },
    { day: 50, pool: "story_email" },
    { day: 54, pool: "int_sms" },
    { day: 57, pool: "breakup_email" },
    { day: 60, pool: "breakup_sms" },
  ],
  callback: [
    { day: 0, pool: "cb_sms" },
    { day: 0, pool: "cb_email" },
    { day: 1, pool: "cb_sms" },
    { day: 2, pool: "cb_email" },
    { day: 3, pool: "cb_sms" },
    { day: 4, pool: "value_email" },
    { day: 5, pool: "urgency_sms" },
    { day: 6, pool: "cb_email" },
    { day: 8, pool: "cb_sms" },
    { day: 10, pool: "proof_email" },
    { day: 12, pool: "urgency_sms" },
    { day: 14, pool: "value_email" },
    { day: 17, pool: "cb_sms" },
    { day: 20, pool: "cb_email" },
    { day: 23, pool: "urgency_sms" },
    { day: 26, pool: "proof_email" },
    { day: 30, pool: "cb_sms" },
    { day: 34, pool: "value_email" },
    { day: 38, pool: "urgency_sms" },
    { day: 42, pool: "cb_email" },
    { day: 46, pool: "cb_sms" },
    { day: 50, pool: "proof_email" },
    { day: 54, pool: "urgency_sms" },
    { day: 57, pool: "breakup_email" },
    { day: 60, pool: "breakup_sms" },
  ],
  not_interested: [
    { day: 10, pool: "ni_email" },
    { day: 30, pool: "ni_email" },
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
    loanProgram: r.loan_program || "",
    automationPaused: !!r.automation_paused,
    optedOut: !!r.opted_out,
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
  fundedAmount: "funded_amount", commissionAmount: "commission_amount", declineReason: "decline_reason", loanProgram: "loan_program",
  automationPaused: "automation_paused",
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
    else if (k === "snoozeUntil") row.snooze_until = v ? new Date(v).toISOString() : null;
  }
  return row;
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";
const leadTitle = (l) => (l.businessName && l.businessName.trim()) || l.name || "Unnamed";
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
function fillTokens(text, lead, config) {
  return (text || "")
    .replaceAll("{{opener}}", callOpener(lead))
    .replaceAll("{{first}}", firstName(lead.name))
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{link}}", config.reportLink || "[set your MyScoreIQ link in Settings]")
    .replaceAll("{{smartcredit}}", config.smartCreditLink || "https://www.smartcredit.com/?PID=52188")
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
    "Send them to Credit Repair to get approval-ready, or resubmit if something changed.",
  ],
};

function nextStepFor(lead) {
  switch (lead.status) {
    case "new": return { text: "Call them. Log what happens below and the right campaign starts on its own.", tone: "slate" };
    case "voicemail": return { text: "Couldn't reach them. Callback texts and emails are going out. Try them again, or send the next when due.", tone: "amber" };
    case "interested": return { text: "They're in. Send the MyScoreIQ link so they can pull their report and get pre-approved.", tone: "sky" };
    case "callback": return { text: "Reconnect when you agreed. Reminder messages are running until you reach them.", tone: "violet" };
    case "not_interested": return { text: "Parked. Light check-ins go out in case their timing changes.", tone: "orange" };
    case "report_pulled": return { text: "Report is in. Pick the likely loan program, then submit to Torro or send the application.", tone: "teal" };
    case "app_sent": return { text: "Application emailed. Chase the signed app back, then submit to Torro.", tone: "purple" };
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
      dueAt = Math.max(anchor + gap, snooze);
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
  { key: "report", label: "Report", match: ["report_pulled"] },
  { key: "app_sent", label: "App Sent", match: ["app_sent"] },
  { key: "submitted", label: "Submitted", match: ["submitted"] },
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
      // A real human touch (a logged call, or a note) means we are mid-conversation.
      // Push the next automated message out so we do not blast them.
      if (kind === "call" || extra.note) {
        const days = Number(autoSnoozeDaysRef.current) || 0;
        if (days > 0) patch.snoozeUntil = now + days * DAY;
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

  const handleSent = useCallback((sent) => {
    setCompose((c) => {
      if (c) {
        logTouch(c.lead.id, c.channel, c.kind, c.extra || {});
        // keep a full copy of what went out, so the thread reads like a conversation
        if (sent && sent.viaApp) {
          supabase.from("communications").insert({
            lead_id: c.lead.id,
            direction: "out",
            channel: c.channel,
            subject: sent.subject || null,
            body: sent.body || "",
            to_addr: c.to || null,
            by_user: userEmail,
          }).then(({ error }) => { if (!error) refetchComms(); });
        }
        if (c.afterSent) c.afterSent();
      }
      return null;
    });
  }, [logTouch, userEmail, refetchComms]);

  const addActivity = useCallback(async (leadId, act) => {
    const { error } = await supabase.from("activities").insert({
      lead_id: leadId, type: act.type, title: act.title || null, notes: act.notes || null,
      due_at: new Date(act.dueAt).toISOString(), created_by: userEmail, assigned_to: act.assignedTo || userEmail,
    });
    if (error) setErr(error.message); else refetchActivities();
  }, [userEmail, refetchActivities]);

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

  const actAlerts = useMemo(() => activities.filter((a) => !a.done && ["overdue", "today"].includes(actBucket(a))).length, [activities]);

  // A lead is "unread" when the most recent message is inbound (they texted last).
  const unreadLeadIds = useMemo(() => {
    const latest = {};
    for (const c of comms) {
      const t = new Date(c.at).getTime();
      if (!latest[c.lead_id] || t > latest[c.lead_id].t) latest[c.lead_id] = { t, dir: c.direction };
    }
    return new Set(Object.entries(latest).filter(([, v]) => v.dir === "in").map(([id]) => id));
  }, [comms]);

  if (!loaded) return <div className="flex min-h-96 items-center justify-center font-sans text-slate-400">Loading your pipeline...</div>;

  const NAV = [["pipeline", "Pipeline", LayoutGrid], ["inbox", "Inbox", MessageSquare], ["activities", "Activities", CalendarClock], ["followups", "Follow-ups", Clock], ["commissions", "Commissions", DollarSign], ["team", "Team", User], ["messaging", "Templates", FileText], ["scripts", "Scripts", ListChecks], ["settings", "Settings", SettingsIcon]];
  const tabTitle = { pipeline: "Pipeline", inbox: "Inbox", activities: "Activities", followups: "Follow-ups", commissions: "Commissions", team: "Team activity", messaging: "Message templates", scripts: "Call scripts", settings: "Settings" }[tab];

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
          </div>
          <button onClick={() => { setTab("pipeline"); setShowAdd(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} /> <span className="hidden sm:inline">Add client</span></button>
        </header>

        <div className="px-5 pb-10">
          {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"><AlertCircle size={16} /> {err}</div>}

          {tab === "pipeline" && (
            <Pipeline leads={filtered} allLeads={leads} allCount={leads.length} dueList={dueList} stats={stats} config={config}
              query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} showAdd={showAdd} setShowAdd={setShowAdd}
              addLead={addLead} onOpen={setProfileId} logTouch={logTouch} updateLead={updateLead} cadences={cadences} templates={templates} openCompose={setCompose}
              onGoFollowups={() => setTab("followups")} />
          )}
          {tab === "followups" && <Followups dueList={dueList} config={config} onOpen={setProfileId} openCompose={setCompose} updateLead={updateLead} />}
          {tab === "inbox" && <Conversations leads={leads} comms={comms} unreadLeadIds={unreadLeadIds} onSend={sendReply} onOpen={setProfileId} templates={templates} config={config} />}
          {tab === "activities" && <Activities activities={activities} leads={leads} onOpen={setProfileId} completeActivity={completeActivity} deleteActivity={deleteActivity} />}
          {tab === "messaging" && <Messaging templates={templates} persistTemplates={persistTemplates} cadences={cadences} persistCadences={persistCadences} />}
          {tab === "commissions" && <Commissions leads={leads} onOpen={setProfileId} />}
          {tab === "team" && <Team leads={leads} onOpen={setProfileId} />}
          {tab === "scripts" && <Scripts />}
          {tab === "settings" && <Settings config={config} persistConfig={persistConfig} />}
        </div>
      </main>

      {profileLead && (
        <Profile lead={profileLead} config={config} templates={templates} cadences={cadences} userEmail={userEmail}
          comms={comms} activities={activities} addActivity={addActivity} completeActivity={completeActivity} deleteActivity={deleteActivity} sendReply={sendReply}
          onClose={() => setProfileId(null)} updateLead={updateLead} removeLead={removeLead} logTouch={logTouch} openCompose={setCompose} />
      )}

      {compose && <ComposeModal compose={compose} onClose={() => setCompose(null)} onSent={handleSent} templates={templates} config={config} />}
    </div>
  );
}

/* ================================================================== */
/*  Pipeline                                                          */
/* ================================================================== */
const BOARDS = {
  outreach: { label: "Outreach", stages: ["new", "voicemail", "interested", "callback", "not_interested"] },
  funding: { label: "Funding", stages: ["report_pulled", "app_sent", "submitted", "pre_approved", "contracts_out", "funded", "commission_paid"] },
  closed: { label: "Closed", stages: ["declined", "credit_repair", "dead"] },
};

function Pipeline({ leads, allLeads, allCount, dueList, stats, config, query, setQuery, filter, setFilter, showAdd, setShowAdd, addLead, onOpen, logTouch, updateLead, cadences, templates, openCompose, onGoFollowups }) {
  const [view, setView] = useState("board");
  const [boardTab, setBoardTab] = useState("outreach");
  const [dragId, setDragId] = useState(null);

  const q = query.toLowerCase();
  const boardLeads = (allLeads || leads).filter((l) => !q || (l.name + l.phone + l.email + l.businessName + l.opportunityName + l.source + l.tags).toLowerCase().includes(q));
  const colLeads = (key) => boardLeads.filter((l) => l.status === key).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  const onDrop = (key) => { if (dragId) { updateLead(dragId, { status: key }); setDragId(null); } };

  return (
    <div className="mt-4">
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
          <div className="truncate text-sm font-semibold text-slate-800">{leadTitle(lead)}</div>
          {leadSubName(lead) && <div className="truncate text-xs text-slate-400">{leadSubName(lead)}</div>}
        </div>
        {lead.automationPaused
          ? <span className="shrink-0 rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">PAUSED</span>
          : rel && <span className={`shrink-0 text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
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
  const [busy, setBusy] = useState(false);
  const picks = templates.filter((t) => t.channel === channel);
  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (channel === "email") setSubject(fillTokens(t.subject, lead, config));
    setBody(fillTokens(t.body, lead, config));
  };
  const sendViaApp = async () => {
    setBusy(true);
    try { await sendMessage(channel, to, subject, body); onSent({ viaApp: true, subject, body }); }
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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button onClick={sendViaApp} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50 disabled:opacity-40"><Send size={15} /> {busy ? "Sending..." : "Send via app"}</button>
            <button onClick={() => onSent({ viaApp: true, subject, body })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Check size={15} /> Mark as sent</button>
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

function Profile({ lead, config, templates, cadences, onClose, updateLead, removeLead, logTouch, openCompose, userEmail, comms = [], activities = [], addActivity, completeActivity, deleteActivity, sendReply }) {
  const EDITABLE = ["name", "phone", "email", "notes", "loanProgram", "desiredAmount", "fundingPurpose", "fundingTimeline", "monthlyRevenue", "creditScore", "timeInBusiness",
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
  const nextStep = nextDue(lead, cadences, templates);
  const leadComms = comms.filter((c) => c.lead_id === lead.id);
  const leadActivities = activities.filter((a) => a.lead_id === lead.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100">
      <div className="mx-auto min-h-full w-full max-w-6xl bg-white shadow-sm">
        {/* back bar */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-2.5">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronDown size={16} className="rotate-90" /> Back to pipeline</button>
          {savedAt > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600"><Check size={13} /> Saved</span>}
        </div>
        {/* journey stepper */}
        <div className="border-b border-slate-100 px-5 py-3">
          <StageStepper status={lead.status} />
        </div>

        {/* head */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="truncate text-lg font-bold">{leadTitle(lead)}</span><StagePill status={lead.status} /></div>
            {leadSubName(lead) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700"><User size={13} className="shrink-0 text-slate-400" /> {leadSubName(lead)}</span>
                {lead.phone && <a href={telHref(lead.phone)} className="font-mono text-xs text-slate-400 hover:text-blue-600">{lead.phone}</a>}
              </div>
            )}
            <div className="mt-0.5"><QualChips lead={lead} /></div>
          </div>
          <div className="flex items-center gap-2">
            {lead.phone && <a href={telHref(lead.phone)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"><Phone size={14} /> Call</a>}
          </div>
        </div>

        <div className="grid gap-5 px-5 py-4 lg:grid-cols-5">
          {/* LEFT COLUMN: work this client now */}
          <div className="space-y-5 lg:col-span-3">

          {/* command bar: move stage, tag program, see next */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Move to stage</label>
                <select value={lead.status} onChange={(e) => updateLead(lead.id, { status: e.target.value })} className={inputCls}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Likely loan program</label>
                <select value={draft.loanProgram || ""} onChange={set("loanProgram")} className={inputCls}>
                  <option value="">Not decided yet</option>
                  {LOAN_PROGRAMS.map((p) => <option key={p.label} value={p.label}>{p.label} ({p.hint})</option>)}
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

          {/* notes: prominent, quick to add */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700"><FileText size={13} /> Notes</label>
            <textarea value={draft.notes} onChange={set("notes")} rows={4} placeholder="What did you talk about? Where did you leave off? Next steps?" className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400" />
          </div>

          {/* conversation: where you left off */}
          <Conversation lead={lead} comms={comms} onSend={sendReply} templates={templates} config={config} compact />

          {/* what to do next */}
          {STAGE_PLAYBOOK[lead.status] && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700"><ListChecks size={14} /> Playbook for this stage</div>
              <ol className="ml-1 flex flex-col gap-1">
                {STAGE_PLAYBOOK[lead.status].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* scheduled calls and tasks */}
          <ActivityPanel lead={lead} activities={leadActivities} addActivity={addActivity} completeActivity={completeActivity} deleteActivity={deleteActivity} />

          {/* automation control */}
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
          <Section icon={<Building2 size={15} />} title="Qualification & business" collapsible defaultOpen={true}>
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

          {/* report PDF */}
          <Section icon={<FileText size={15} />} title="Credit report" collapsible defaultOpen={["interested", "report_pulled", "submitted", "pre_approved"].includes(lead.status)}>
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
          <Section icon={<FileText size={15} />} title="Application" collapsible defaultOpen={["report_pulled","app_sent","pre_approved"].includes(lead.status)}>
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
  urgency_sms: "Urgency nudge, text", value_email: "Value / education, email",
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
          <Labeled label="SmartCredit link (backup report tool)"><input value={draft.smartCreditLink || ""} onChange={set("smartCreditLink")} className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Auto-snooze days after a logged call or note"><input type="number" min={0} value={draft.autoSnoozeDays ?? 3} onChange={(e) => setDraft({ ...draft, autoSnoozeDays: Number(e.target.value) })} className={inputCls} /></Labeled>
          <Labeled label="Email signature (added to the bottom of emails you send)"><textarea value={draft.emailSignature || ""} onChange={set("emailSignature")} rows={3} className={`${inputCls} resize-none`} /></Labeled>
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

function ActivityPanel({ lead, activities, addActivity, completeActivity, deleteActivity }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("call");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  const openActs = activities.filter((a) => !a.done).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const doneActs = activities.filter((a) => a.done);

  const save = () => {
    if (!when) return;
    addActivity(lead.id, { type, title: title || ACT_TYPES.find((t) => t.key === type).label, dueAt: new Date(when).getTime(), notes });
    setTitle(""); setWhen(""); setNotes(""); setOpen(false);
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


function Conversation({ lead, comms, onSend, templates = [], config = {}, compact = false }) {
  const [channel, setChannel] = useState("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);

  const thread = useMemo(
    () => comms.filter((c) => c.lead_id === lead.id).sort((a, b) => new Date(a.at) - new Date(b.at)),
    [comms, lead.id]
  );
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [thread.length]);

  const picks = templates.filter((t) => t.channel === channel);
  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (channel === "email") setSubject(fillTokens(t.subject, lead, config));
    setBody(fillTokens(t.body, lead, config));
  };

  const canSend = channel === "sms" ? !!lead.phone : !!lead.email;
  const send = async () => {
    if (!body.trim() || !canSend) return;
    setBusy(true); setErr("");
    let outBody = body;
    // append email signature if set and not already present
    if (channel === "email" && config.emailSignature && !outBody.includes(config.emailSignature)) {
      outBody = outBody + "\n\n" + config.emailSignature;
    }
    try { await onSend(lead, channel, subject, outBody); setBody(""); setSubject(""); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <MessageSquare size={14} className="text-blue-600" /> Conversation
        {thread.length > 0 && <span className="text-slate-400">({thread.length})</span>}
      </div>

      <div className={`flex flex-col gap-2 overflow-y-auto px-4 py-3 ${compact ? "max-h-72" : "max-h-[380px]"}`}>
        {thread.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No messages yet. Send a text or email below and it will show here, along with their replies.</p>}
        {thread.map((c) => {
          const inbound = c.direction === "in";
          const chanLabel = c.channel === "sms" ? "SMS" : "Email";
          return (
            <div key={c.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${inbound ? "rounded-bl-sm bg-slate-100 text-slate-800" : "rounded-br-sm bg-blue-600 text-white"}`}>
                <div className={`mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${inbound ? "text-slate-500" : "text-blue-100"}`}>
                  <span className={`rounded px-1 py-px ${c.channel === "sms" ? (inbound ? "bg-blue-100 text-blue-700" : "bg-blue-500/60 text-white") : (inbound ? "bg-violet-100 text-violet-700" : "bg-violet-500/60 text-white")}`}>
                    {c.channel === "sms" ? <MessageSquare size={9} className="mr-0.5 inline" /> : <Mail size={9} className="mr-0.5 inline" />}{chanLabel}
                  </span>
                  {inbound ? "In" : "Out"}
                  <span className="font-normal normal-case opacity-80">{fmtDateTime(new Date(c.at).getTime())}</span>
                </div>
                {c.subject && <div className={`text-xs font-semibold ${inbound ? "text-slate-600" : "text-blue-100"}`}>{c.subject}</div>}
                <div className="whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => setChannel("sms")} className={`flex-1 rounded-md py-1.5 font-medium ${channel === "sms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><MessageSquare size={13} className="mr-1 inline" /> Text</button>
          <button onClick={() => setChannel("email")} className={`flex-1 rounded-md py-1.5 font-medium ${channel === "email" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Mail size={13} className="mr-1 inline" /> Email</button>
        </div>
        {picks.length > 0 && (
          <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-400">
            <option value="">Insert a template...</option>
            {picks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {channel === "email" && (
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        )}
        <div className="flex items-end gap-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={canSend ? `Type a ${channel === "sms" ? "text" : "email"}...` : channel === "sms" ? "No phone on file" : "No email on file"} disabled={!canSend}
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50" />
          <button onClick={send} disabled={busy || !body.trim() || !canSend} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">
            <Send size={15} /> {busy ? "..." : "Send"}
          </button>
        </div>
        {err && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{err}</div>}
      </div>
    </div>
  );
}

// GHL-style inbox: leads with messages on the left, the thread + reply on the right
function Conversations({ leads, comms, unreadLeadIds, onSend, onOpen, templates = [], config = {} }) {
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

  if (withMsgs.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
        <MessageSquare size={28} className="mx-auto text-slate-300" />
        <div className="mt-2 text-sm font-medium text-slate-600">No conversations yet</div>
        <div className="mt-1 text-sm text-slate-400">Texts and emails you send, and replies you receive, show up here.</div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[320px_1fr]">
      <div className="flex max-h-[560px] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {withMsgs.map(({ lead, last }) => {
          const unread = unreadLeadIds.has(lead.id);
          const active = selected?.id === lead.id;
          return (
            <button key={lead.id} onClick={() => setSelId(lead.id)}
              className={`flex flex-col gap-0.5 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
              <div className="flex items-center gap-2">
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
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
            <Conversation lead={selected} comms={comms} onSend={onSend} templates={templates} config={config} />
          </>
        )}
      </div>
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

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">Overdue</div>
          <div className="mt-1 text-2xl font-bold text-rose-800">{counts.overdue}</div>
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

function Team({ leads, onOpen }) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  // flatten all touches with lead context
  const acts = [];
  for (const l of leads) {
    for (const t of (l.touches || [])) {
      acts.push({ ...t, leadId: l.id, leadName: leadTitle(l) });
    }
  }
  const dayStart = new Date(day + "T00:00:00").getTime();
  const dayEnd = dayStart + 86400000;
  const todays = acts.filter((a) => a.at >= dayStart && a.at < dayEnd);
  const reps = [...new Set(acts.map((a) => a.by).filter(Boolean))];
  if (reps.length === 0) reps.push("(unassigned)");

  const statsFor = (rep) => {
    const mine = todays.filter((a) => (a.by || "(unassigned)") === rep);
    const calls = mine.filter((a) => a.kind === "call");
    return {
      calls: calls.length,
      voicemails: calls.filter((a) => /voicemail/i.test(a.disposition || "")).length,
      spoke: calls.filter((a) => /spoke/i.test(a.disposition || "")).length,
      texts: mine.filter((a) => a.channel === "sms").length,
      emails: mine.filter((a) => a.channel === "email").length,
      notes: calls.filter((a) => a.note).length,
    };
  };

  const recent = [...todays].sort((a, b) => b.at - a.at).slice(0, 40);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-500">Day</label>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
      </div>
      {reps.map((rep) => {
        const s = statsFor(rep);
        const cells = [["Calls", s.calls], ["Voicemails", s.voicemails], ["Spoke to", s.spoke], ["Texts", s.texts], ["Emails", s.emails], ["Notes", s.notes]];
        return (
          <div key={rep} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><User size={15} className="text-blue-600" /> {rep}</div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {cells.map(([label, val]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-bold text-slate-800">{val}</div>
                  <div className="text-xs text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rounded-xl border border-slate-200 bg-white p-1">
        <div className="px-3 py-2 text-sm font-bold text-slate-800">Activity for {day} ({recent.length})</div>
        {recent.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-400">No activity logged this day.</p> : (
          <div className="flex flex-col">
            {recent.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-0">
                <span className="text-xs text-slate-400">{fmtDateTime(a.at).split(", ").pop()}</span>
                <button onClick={() => onOpen(a.leadId)} className="font-semibold text-slate-700 hover:text-blue-700">{a.leadName}</button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.kind === "call" ? (a.disposition || "call") : (a.channel === "sms" ? "text" : a.channel === "email" ? "email" : a.kind)}</span>
                {a.note && <span className="text-slate-500">{a.note}</span>}
                <span className="ml-auto text-xs text-slate-400">{a.by || ""}</span>
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
