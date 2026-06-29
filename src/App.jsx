import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Phone, MessageSquare, Mail, Copy, Check, Plus, Search, Settings as SettingsIcon,
  Clock, Trash2, User, FileText, Send, AlertCircle, ChevronDown, Zap, Wifi,
  X, Eye, EyeOff, KeyRound, Upload, ExternalLink, Building2, CalendarClock,
  ListChecks, Pencil, Save, LogOut, Lock,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ================================================================== */
/*  Stages                                                            */
/* ================================================================== */
const STAGES = [
  { key: "new", label: "New", tone: "slate" },
  { key: "called", label: "Called", tone: "sky" },
  { key: "link_sent", label: "Link Sent", tone: "amber" },
  { key: "report_pulled", label: "Report Pulled", tone: "violet" },
  { key: "in_followup", label: "In Follow-up", tone: "orange" },
  { key: "funded", label: "Funded", tone: "emerald" },
  { key: "dead", label: "Dead", tone: "rose" },
];
const TONE = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-100 text-sky-800 ring-sky-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  violet: "bg-violet-100 text-violet-800 ring-violet-200",
  orange: "bg-orange-100 text-orange-800 ring-orange-200",
  emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rose: "bg-rose-100 text-rose-800 ring-rose-200",
};
const DAY = 86400000;

/* ================================================================== */
/*  Defaults: config, template library, stage cadences               */
/* ================================================================== */
const DEFAULT_CONFIG = {
  reportLink: "https://www.myscoreiq.com/industry-score-preferred.aspx?offercode=432143MH",
  signature: "Joe at ASAP Funding USA",
};

const DEFAULT_TEMPLATES = [
  { id: "first_sms", name: "Send link (text)", channel: "sms", subject: "",
    body: `Hi {{first}}, it's {{signature}}. Here is the secure link to pull your report so I can review your funding options: {{link}} Takes about 5 min. Text me once it is done.` },
  { id: "first_email", name: "Send link (email)", channel: "email", subject: "Your funding review, {{first}}",
    body: `Hi {{first}},

Great talking with you. The next step is quick. Pull your report through the secure link below so I can review your full profile and match you with the right funding options.

{{link}}

It takes about 5 minutes. Once it is done, reply here or text me and I will review and get back to you today.

Talk soon,
{{signature}}` },
  { id: "fu_sms", name: "Nudge (text)", channel: "sms", subject: "",
    body: `Hi {{first}}, {{signature}} here. Still want to get your funding options in front of you. Pull your report when you get a sec: {{link}}` },
  { id: "fu_email", name: "Nudge (email)", channel: "email", subject: "Quick nudge on your funding review, {{first}}",
    body: `Hi {{first}},

Circling back. I still have your funding options ready to review, I just need your report pulled first. Here is the secure link again:

{{link}}

Takes about 5 minutes. Reply or text me once it is done and I will take it from there.

{{signature}}` },
  { id: "pulled_sms", name: "Got it, reviewing (text)", channel: "sms", subject: "",
    body: `Got your report, {{first}}, thank you. Reviewing your funding options now and I will be back to you today. {{signature}}` },
];

// Per stage: ordered steps. day = days after entering that stage.
const DEFAULT_CADENCES = {
  new: [],
  called: [{ day: 0, templateId: "first_sms" }, { day: 0, templateId: "first_email" }],
  link_sent: [
    { day: 1, templateId: "fu_sms" },
    { day: 3, templateId: "fu_email" },
    { day: 7, templateId: "fu_sms" },
    { day: 14, templateId: "fu_email" },
  ],
  report_pulled: [{ day: 0, templateId: "pulled_sms" }],
  in_followup: [
    { day: 2, templateId: "fu_sms" },
    { day: 6, templateId: "fu_email" },
    { day: 12, templateId: "fu_sms" },
  ],
  funded: [],
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
    reportUploadedAt: r.report_uploaded_at ? new Date(r.report_uploaded_at).getTime() : null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    stageEnteredAt: r.stage_entered_at ? new Date(r.stage_entered_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
    linkSentAt: r.link_sent_at ? new Date(r.link_sent_at).getTime() : null,
    lastTouchAt: r.last_touch_at ? new Date(r.last_touch_at).getTime() : null,
    touches: Array.isArray(r.touches) ? r.touches : [],
  };
}
const FIELD_MAP = {
  name: "name", phone: "phone", email: "email", notes: "notes", source: "source", tags: "tags",
  status: "status", touches: "touches",
  opportunityName: "opportunity_name", pipelineStage: "pipeline_stage",
  desiredAmount: "desired_amount", creditScore: "estimated_credit_score",
  monthlyRevenue: "monthly_revenue", timeInBusiness: "time_in_business",
  businessName: "business_name", businessType: "business_type", einStatus: "ein_status",
  bestTime: "best_time", nextStep: "next_step",
  myscoreiqUsername: "myscoreiq_username", myscoreiqPassword: "myscoreiq_password", ssnLast4: "ssn_last4",
  reportPath: "report_path",
};
function leadPatchToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k in FIELD_MAP) row[FIELD_MAP[k]] = v;
    else if (k === "linkSentAt") row.link_sent_at = v ? new Date(v).toISOString() : null;
    else if (k === "lastTouchAt") row.last_touch_at = v ? new Date(v).toISOString() : null;
    else if (k === "stageEnteredAt") row.stage_entered_at = v ? new Date(v).toISOString() : null;
    else if (k === "reportUploadedAt") row.report_uploaded_at = v ? new Date(v).toISOString() : null;
  }
  return row;
}

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";
function fillTokens(text, lead, config) {
  return (text || "")
    .replaceAll("{{first}}", firstName(lead.name))
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{link}}", config.reportLink || "[set your MyScoreIQ link in Settings]")
    .replaceAll("{{signature}}", config.signature || "");
}
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
    const tpl = templates.find((t) => t.id === s.templateId);
    const dueAt = entered + s.day * DAY;
    const done = (lead.touches || []).some(
      (t) => t.kind === "cadence" && t.stage === lead.status && t.step === i && t.at >= entered
    );
    return { i, day: s.day, template: tpl, channel: tpl?.channel, dueAt, done };
  });
}
function nextDue(lead, cadences, templates) {
  const steps = cadenceSteps(lead, cadences, templates).filter((s) => !s.done && s.template);
  if (steps.length === 0) return null;
  return steps.sort((a, b) => a.dueAt - b.dueAt)[0];
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
        <span key={k} className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100 ${pad}`}>
          <span className="text-emerald-500">{k}</span><span className="font-semibold">{v}</span>
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
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

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
  return <Dashboard />;
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white"><Lock size={18} /></div>
          <div>
            <div className="text-base font-bold tracking-tight text-slate-800">ASAP Funding Pipeline</div>
            <div className="text-xs text-slate-400">Sign in to continue</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Labeled label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="email" autoComplete="username" className={inputCls} /></Labeled>
          <Labeled label="Password"><input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" autoComplete="current-password" className={inputCls} /></Labeled>
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{err}</div>}
          <button onClick={submit} disabled={busy || !email || !pw} className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
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
function Dashboard() {
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
  const [live, setLive] = useState(false);

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
    // changing stage resets the cadence clock for the new stage
    if ("status" in patch) patch = { ...patch, stageEnteredAt: Date.now(), lastTouchAt: Date.now() };
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("leads").update(leadPatchToRow(patch)).eq("id", id);
    if (error) setErr(error.message);
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
    if (computed) await supabase.from("leads").update(leadPatchToRow(computed)).eq("id", id);
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

  const dueList = useMemo(() => (
    leads.map((l) => ({ l, step: nextDue(l, cadences, templates) }))
      .filter((x) => x.step && x.step.dueAt <= Date.now() + DAY)
      .sort((a, b) => a.step.dueAt - b.step.dueAt)
  ), [leads, cadences, templates]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter((l) => {
      if (filter === "active" && (l.status === "funded" || l.status === "dead")) return false;
      if (filter === "needs_link" && l.status !== "new" && l.status !== "called") return false;
      if (filter === "waiting" && l.status !== "link_sent" && l.status !== "in_followup") return false;
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

  return (
    <div className="mx-auto max-w-5xl font-sans text-slate-800">
      <div className="rounded-2xl bg-emerald-900 px-5 py-4 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-emerald-950"><Zap size={20} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-center gap-2 text-base font-bold leading-tight tracking-tight">
                ASAP Funding Pipeline
                {live && <span title="Live: new GHL leads appear automatically"><Wifi size={14} className="text-emerald-300" /></span>}
              </div>
              <div className="text-xs text-emerald-200">Call. Send the link. Follow up.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
          <nav className="flex gap-1 rounded-lg bg-emerald-950/40 p-1 text-sm">
            {[["pipeline", "Pipeline"], ["messaging", "Messaging"], ["scripts", "Scripts"], ["settings", "Settings"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-medium transition ${tab === k ? "bg-white text-emerald-900" : "text-emerald-100 hover:bg-emerald-800"}`}>{label}</button>
            ))}
          </nav>
          <button onClick={() => supabase.auth.signOut()} title="Sign out" className="rounded-md p-1.5 text-emerald-200 hover:bg-emerald-800"><LogOut size={16} /></button>
          </div>
        </div>
      </div>

      {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"><AlertCircle size={16} /> {err}</div>}

      {tab === "pipeline" && (
        <Pipeline leads={filtered} allCount={leads.length} dueList={dueList} stats={stats} config={config}
          query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}
          addLead={addLead} onOpen={setProfileId} logTouch={logTouch} cadences={cadences} templates={templates} />
      )}
      {tab === "messaging" && <Messaging templates={templates} persistTemplates={persistTemplates} cadences={cadences} persistCadences={persistCadences} />}
      {tab === "scripts" && <Scripts />}
      {tab === "settings" && <Settings config={config} persistConfig={persistConfig} />}

      {profileLead && (
        <Profile lead={profileLead} config={config} templates={templates} cadences={cadences}
          onClose={() => setProfileId(null)} updateLead={updateLead} removeLead={removeLead} logTouch={logTouch} />
      )}

      <p className="mt-6 px-1 text-center text-xs text-slate-400">Texts and emails open in your own phone and mail app, so they come from your number and address.</p>
    </div>
  );
}

/* ================================================================== */
/*  Pipeline                                                          */
/* ================================================================== */
function Pipeline({ leads, allCount, dueList, stats, config, query, setQuery, filter, setFilter, addLead, onOpen, logTouch, cadences, templates }) {
  const [showAdd, setShowAdd] = useState(false);
  const sendStep = (lead, step) => {
    const tpl = step.template;
    if (!tpl) return;
    const href = tpl.channel === "sms"
      ? smsHref(lead.phone, fillTokens(tpl.body, lead, config))
      : mailHref(lead.email, fillTokens(tpl.subject, lead, config), fillTokens(tpl.body, lead, config));
    window.open(href, "_blank");
    logTouch(lead.id, tpl.channel, "cadence", { stage: lead.status, step: step.i });
  };

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
                  <button onClick={() => onOpen(l.id)} className="font-semibold hover:text-emerald-700">{l.name || "Unnamed"}</button>
                  <StagePill status={l.status} />
                  <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-600"}`}>{rel.label}</span>
                  <span className="text-xs text-slate-400">{step.template?.name}</span>
                  <div className="ml-auto">
                    <button onClick={() => sendStep(l, step)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${step.channel === "sms" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"}`}>
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
        <div className="relative min-w-44 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, business" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400">
          <option value="active">Active</option><option value="needs_link">Needs link</option><option value="waiting">Waiting on report</option><option value="all">All</option>
        </select>
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={16} /> Add prospect</button>
      </div>

      {showAdd && <AddForm onAdd={(d) => { addLead(d); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STAGES.map((s) => <span key={s.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE[s.tone]}`}>{s.label} <span className="font-bold">{stats[s.key] || 0}</span></span>)}
      </div>

      {allCount === 0 ? <Empty onAdd={() => setShowAdd(true)} />
        : leads.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No prospects match this view.</div>
        : <div className="flex flex-col gap-2">{leads.map((l) => <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l.id)} cadences={cadences} templates={templates} />)}</div>}
    </div>
  );
}

function Empty({ onAdd }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
      <User size={28} className="mx-auto text-slate-300" />
      <div className="mt-2 text-sm font-medium text-slate-600">No prospects yet</div>
      <div className="mt-1 text-sm text-slate-400">Add one by hand, or they will arrive automatically from GoHighLevel.</div>
      <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={16} /> Add prospect</button>
    </div>
  );
}
function AddForm({ onAdd, onCancel }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const canSave = f.name.trim() && (f.phone.trim() || f.email.trim());
  return (
    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input autoFocus value={f.name} onChange={set("name")} placeholder="Name" className={inputCls} />
        <input value={f.phone} onChange={set("phone")} placeholder="Phone" className={inputCls} />
        <input value={f.email} onChange={set("email")} placeholder="Email" className={inputCls} />
        <input value={f.notes} onChange={set("notes")} placeholder="Notes" className={inputCls} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <button disabled={!canSave} onClick={() => onAdd(f)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}

function LeadRow({ lead, onOpen, cadences, templates }) {
  const step = nextDue(lead, cadences, templates);
  const rel = step ? relativeDue(step.dueAt) : null;
  return (
    <button onClick={onOpen} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:shadow-sm">
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
        <ChevronDown size={18} className="shrink-0 -rotate-90 text-slate-300" />
      </div>
    </button>
  );
}

/* ================================================================== */
/*  Profile (client detail)                                           */
/* ================================================================== */
function Profile({ lead, config, templates, cadences, onClose, updateLead, removeLead, logTouch }) {
  const [draft, setDraft] = useState(lead);
  const [savedAt, setSavedAt] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [reportUrl, setReportUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setDraft(lead); }, [lead.id]); // reload when switching leads
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const saveProfile = async () => {
    const patch = {};
    ["name", "phone", "email", "notes", "desiredAmount", "monthlyRevenue", "creditScore", "timeInBusiness",
      "businessName", "businessType", "einStatus", "bestTime", "nextStep",
      "myscoreiqUsername", "myscoreiqPassword", "ssnLast4"].forEach((k) => { if (draft[k] !== lead[k]) patch[k] = draft[k]; });
    if (Object.keys(patch).length) await updateLead(lead.id, patch);
    setSavedAt(Date.now()); setTimeout(() => setSavedAt(0), 1600);
  };

  const uploadReport = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `${lead.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });
      if (error) throw error;
      await updateLead(lead.id, { reportPath: path, reportUploadedAt: Date.now() });
    } catch (e) { alert("Upload failed: " + (e.message || e)); }
    finally { setUploading(false); }
  };
  const viewReport = async () => {
    if (!lead.reportPath) return;
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(lead.reportPath, 3600);
    if (error) { alert("Could not open report: " + error.message); return; }
    setReportUrl(data.signedUrl); window.open(data.signedUrl, "_blank");
  };

  const sendTemplate = (tpl) => {
    const href = tpl.channel === "sms"
      ? smsHref(lead.phone, fillTokens(tpl.body, lead, config))
      : mailHref(lead.email, fillTokens(tpl.subject, lead, config), fillTokens(tpl.body, lead, config));
    window.open(href, "_blank");
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* contact actions */}
          <div className="flex flex-wrap gap-2">
            <a href={telHref(lead.phone)} onClick={() => lead.phone && updateLead(lead.id, lead.status === "new" ? { status: "called" } : {})} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-slate-800 text-white hover:bg-slate-900" : "pointer-events-none bg-slate-100 text-slate-300"}`}><Phone size={15} /> Call</a>
            <a href={smsHref(lead.phone, fillTokens(templates.find(t=>t.id==="first_sms")?.body || "{{link}}", lead, config))} onClick={() => lead.phone && logTouch(lead.id, "sms", "link")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.phone ? "bg-emerald-600 text-white hover:bg-emerald-700" : "pointer-events-none bg-slate-100 text-slate-300"}`}><MessageSquare size={15} /> Text link</a>
            <a href={mailHref(lead.email, fillTokens(templates.find(t=>t.id==="first_email")?.subject||"", lead, config), fillTokens(templates.find(t=>t.id==="first_email")?.body||"{{link}}", lead, config))} onClick={() => lead.email && logTouch(lead.id, "email", "link")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${lead.email ? "bg-white text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50" : "pointer-events-none bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}><Mail size={15} /> Email link</a>
            <CopyButton text={config.reportLink || ""} label="Copy link" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
          </div>

          {/* call guide */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
            <button onClick={() => setGuideOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-900"><FileText size={15} /> Call guide</span>
              <ChevronDown size={16} className={`text-emerald-700 transition ${guideOpen ? "rotate-180" : ""}`} />
            </button>
            {guideOpen && (
              <div className="space-y-4 border-t border-emerald-100 px-4 py-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Opener</div>
                  <p className="mt-1 text-sm text-slate-700">Hi {firstName(lead.name)}, this is {config.signature}. I help business owners get into a position to be approved for funding, usually within 60 to 90 days. Before I tell you what you qualify for, let me ask a few quick questions.</p>
                </div>
                <div className="space-y-3">
                  {[
                    ["What are you looking to use the funding for, and how much?", "desiredAmount", "Amount / use"],
                    ["Roughly what does the business bring in per month?", "monthlyRevenue", "Monthly revenue"],
                    ["How long have you been in business?", "timeInBusiness", "Time in business"],
                    ["Do you have an entity set up, an LLC or corp with an EIN?", "einStatus", "Entity / EIN"],
                    ["What is the business, and what industry?", "businessType", "Business type"],
                    ["Ballpark, where is your personal credit right now?", "creditScore", "Credit score"],
                    ["Best number and time to reach you?", "bestTime", "Best time to call"],
                  ].map(([q, k, ph]) => (
                    <div key={k}>
                      <div className="text-sm font-medium text-slate-700">{q}</div>
                      <input value={draft[k]} onChange={set(k)} placeholder={ph} className={`${inputCls} mt-1`} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Why us over a bank</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>Banks decline most small businesses, especially under two years in or with thinner credit. We work with a network of funders, so one profile gets matched to the ones you actually fit.</li>
                    <li>One review with us, not ten separate bank applications that each add a hard inquiry to your report.</li>
                    <li>We look at the whole picture, your revenue and where the business is headed, not just a single credit score cutoff.</li>
                    <li>Speed. Bank underwriting can run weeks to months. Our funders often move in days.</li>
                    <li>If you are not approval ready yet, we map the exact steps and a timeline to get you there, usually 60 to 90 days, instead of a flat no.</li>
                  </ul>
                </div>
                <p className="text-xs text-slate-400">Answers save with the Save profile button at the bottom.</p>
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
                      {st.channel === "sms" ? <MessageSquare size={14} className="text-emerald-600" /> : <Mail size={14} className="text-emerald-600" />}
                      <span className="min-w-0 flex-1 truncate">{st.template?.name || "deleted template"}</span>
                      {st.done ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check size={13} /> Sent</span>
                        : <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-slate-400"}`}>{rel.label}</span>}
                      {!st.done && st.template && (
                        <button onClick={() => { sendTemplate(st.template); logTouch(lead.id, st.channel, "cadence", { stage: lead.status, step: st.i }); }} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Send</button>
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
              <Labeled label="Username"><input value={draft.myscoreiqUsername} onChange={set("myscoreiqUsername")} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Password">
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={draft.myscoreiqPassword} onChange={set("myscoreiqPassword")} className={`${inputCls} pr-9 font-mono`} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </Labeled>
              <Labeled label="Last 4 of SSN"><input value={draft.ssnLast4} onChange={set("ssnLast4")} maxLength={4} inputMode="numeric" className={`${inputCls} font-mono`} /></Labeled>
            </div>
          </Section>

          {/* report PDF */}
          <Section icon={<FileText size={15} />} title="Credit report">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
                <Upload size={15} /> {uploading ? "Uploading..." : lead.reportPath ? "Replace PDF" : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadReport(e.target.files?.[0])} />
              </label>
              {lead.reportPath && <button onClick={viewReport} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"><ExternalLink size={15} /> View report</button>}
              {lead.reportUploadedAt && <span className="text-xs text-slate-400">Uploaded {fmtDate(lead.reportUploadedAt)}</span>}
            </div>
          </Section>

          {/* footer actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button onClick={() => { if (confirm(`Remove ${lead.name || "this client"}?`)) { removeLead(lead.id); onClose(); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"><Trash2 size={13} /> Remove</button>
            <div className="flex items-center gap-3">
              {savedAt > 0 && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
              <button onClick={saveProfile} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Save size={15} /> Save profile</button>
            </div>
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
  return (
    <div className="mt-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {[["templates", "Templates"], ["cadences", "Stage follow-ups"]].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`rounded-md px-3 py-1.5 font-medium ${sub === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{l}</button>
        ))}
      </div>
      {sub === "templates" ? <TemplatesEditor templates={templates} persistTemplates={persistTemplates} />
        : <CadenceEditor templates={templates} cadences={cadences} persistCadences={persistCadences} />}
    </div>
  );
}

function TemplatesEditor({ templates, persistTemplates }) {
  const [editing, setEditing] = useState(null); // template object or null
  const blank = () => ({ id: "t_" + Math.random().toString(36).slice(2, 9), name: "", channel: "sms", subject: "", body: "" });
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
        <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={15} /> New template</button>
      </div>
      {templates.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {t.channel === "sms" ? <MessageSquare size={15} className="text-emerald-600" /> : <Mail size={15} className="text-emerald-600" />}
              <span className="font-semibold">{t.name || "(unnamed)"}</span>
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
    <div className="rounded-xl border border-emerald-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Template name"><input value={d.name} onChange={set("name")} className={inputCls} /></Labeled>
        <Labeled label="Channel">
          <select value={d.channel} onChange={set("channel")} className={inputCls}><option value="sms">Text (SMS)</option><option value="email">Email</option></select>
        </Labeled>
      </div>
      {d.channel === "email" && <div className="mt-3"><Labeled label="Subject"><input value={d.subject} onChange={set("subject")} className={inputCls} /></Labeled></div>}
      <div className="mt-3"><Labeled label="Message"><textarea value={d.body} onChange={set("body")} rows={d.channel === "email" ? 8 : 3} className={inputCls} /></Labeled></div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <button disabled={!d.name.trim()} onClick={() => onSave(d)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Save template</button>
      </div>
    </div>
  );
}

function CadenceEditor({ templates, cadences, persistCadences }) {
  const [stage, setStage] = useState("link_sent");
  const steps = cadences[stage] || [];
  const update = (next) => persistCadences({ ...cadences, [stage]: next });
  const addStep = () => update([...steps, { day: 1, templateId: templates[0]?.id || "" }]);
  const setStep = (i, patch) => update(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const delStep = (i) => update(steps.filter((_, idx) => idx !== i));

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">For each stage, set which message goes out and how many days after the client enters that stage. When they move stages, this stage's steps stop and the new stage's steps begin.</p>
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
              <input type="number" min={0} value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) })} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-400" />
              <select value={s.templateId} onChange={(e) => setStep(i, { templateId: e.target.value })} className="min-w-44 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-400">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}
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

We help business owners get into a position to be approved for funding, usually within 60 to 90 days, and a lot of the time sooner. Before I can tell you what you would qualify for, I need to see your full profile.

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

I will call you back today with where you stand and the path to get approval ready. If anything looks like it needs cleanup first, I will lay out the plan and the timeline, usually 60 to 90 days.` },
];
function Scripts() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">Swap <span className="font-mono text-slate-700">{"{NAME}"}</span> and <span className="font-mono text-slate-700">{"{YOUR NAME}"}</span> as you go.</p>
      {SCRIPTS.map((s) => (
        <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><FileText size={15} className="text-emerald-600" /> {s.title}</h3>
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
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800"><SettingsIcon size={15} className="text-emerald-600" /> Core setup</h3>
        <div className="flex flex-col gap-3">
          <Labeled label="MyScoreIQ link"><input value={draft.reportLink} onChange={set("reportLink")} className={`${inputCls} font-mono`} /></Labeled>
          <Labeled label="Signature / who it is from"><input value={draft.signature} onChange={set("signature")} className={inputCls} /></Labeled>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Send size={15} /> Save</button>
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Build your messages and per-stage follow-up sequences under the <span className="font-semibold text-slate-700">Messaging</span> tab.
      </div>
    </div>
  );
}
