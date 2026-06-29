import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Phone, MessageSquare, Mail, Copy, Check, Plus, Search, Settings as SettingsIcon,
  Clock, Trash2, User, FileText, Send, AlertCircle, ChevronDown, Zap, Wifi,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */
const DEFAULT_CONFIG = {
  reportLink: "https://www.myscoreiq.com/industry-score-preferred.aspx?offercode=432143MH",
  signature: "Joe at ASAP Funding USA",
  emailSubject: "Your funding review, {{first}}",
  emailBody:
`Hi {{first}},

Great talking with you. The next step is quick. Pull your report through the secure link below so I can review your full profile and match you with the right funding options.

{{link}}

It takes about 5 minutes. Once it is done, reply here or text me and I will review and get back to you today.

Talk soon,
{{signature}}`,
  smsBody:
`Hi {{first}}, it's {{signature}}. Here is the secure link to pull your report so I can review your funding options: {{link}} Takes about 5 min. Text me once it is done.`,
  followupEmailSubject: "Quick nudge on your funding review, {{first}}",
  followupEmailBody:
`Hi {{first}},

Circling back. I still have your funding options ready to review, I just need your report pulled first. Here is the secure link again:

{{link}}

Takes about 5 minutes. Reply or text me once it is done and I will take it from there.

{{signature}}`,
  followupSmsBody:
`Hi {{first}}, {{signature}} here. Still want to get your funding options in front of you. Pull your report when you get a sec: {{link}}`,
};

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

const CADENCE_DAYS = [1, 3, 7, 14, 21];
const DAY = 86400000;

/* ------------------------------------------------------------------ */
/*  Data layer: map DB snake_case <-> app camelCase                    */
/* ------------------------------------------------------------------ */
function rowToLead(r) {
  return {
    id: r.id,
    name: r.name || "",
    phone: r.phone || "",
    email: r.email || "",
    notes: r.notes || "",
    source: r.source || "",
    status: r.status || "new",
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    linkSentAt: r.link_sent_at ? new Date(r.link_sent_at).getTime() : null,
    lastTouchAt: r.last_touch_at ? new Date(r.last_touch_at).getTime() : null,
    touches: Array.isArray(r.touches) ? r.touches : [],
  };
}
function leadPatchToRow(patch) {
  const row = {};
  if ("name" in patch) row.name = patch.name;
  if ("phone" in patch) row.phone = patch.phone;
  if ("email" in patch) row.email = patch.email;
  if ("notes" in patch) row.notes = patch.notes;
  if ("status" in patch) row.status = patch.status;
  if ("touches" in patch) row.touches = patch.touches;
  if ("linkSentAt" in patch) row.link_sent_at = patch.linkSentAt ? new Date(patch.linkSentAt).toISOString() : null;
  if ("lastTouchAt" in patch) row.last_touch_at = patch.lastTouchAt ? new Date(patch.lastTouchAt).toISOString() : null;
  return row;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */
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

function followupDue(lead) {
  if (!lead.linkSentAt) return null;
  if (["report_pulled", "funded", "dead"].includes(lead.status)) return null;
  const done = (lead.touches || []).filter((t) => t.kind === "followup" && t.at >= lead.linkSentAt).length;
  const offset = CADENCE_DAYS[Math.min(done, CADENCE_DAYS.length - 1)];
  return lead.linkSentAt + offset * DAY;
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
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  UI atoms                                                           */
/* ------------------------------------------------------------------ */
function CopyButton({ text, label = "Copy", className = "" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); }
        catch {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        setDone(true); setTimeout(() => setDone(false), 1400);
      }}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${className}`}
    >
      {done ? <Check size={15} /> : <Copy size={15} />}{done ? "Copied" : label}
    </button>
  );
}
function StagePill({ status }) {
  const s = STAGES.find((x) => x.key === status) || STAGES[0];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[s.tone]}`}>
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function App() {
  const [tab, setTab] = useState("pipeline");
  const [leads, setLeads] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [openId, setOpenId] = useState(null);
  const [live, setLive] = useState(false);

  const refetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from("leads").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setLeads(data.map(rowToLead));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfgRes = await supabase.from("app_config").select("value").eq("key", "config").maybeSingle();
        if (cfgRes.data?.value) setConfig({ ...DEFAULT_CONFIG, ...cfgRes.data.value });
        else await supabase.from("app_config").upsert({ key: "config", value: DEFAULT_CONFIG });
        await refetchLeads();
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoaded(true);
      }
    })();

    // Realtime: new leads from the GHL webhook show up without a refresh
    const channel = supabase
      .channel("leads-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => refetchLeads())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [refetchLeads]);

  const persistConfig = useCallback(async (next) => {
    setConfig(next);
    await supabase.from("app_config").upsert({ key: "config", value: next });
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    await supabase.from("leads").update(leadPatchToRow(patch)).eq("id", id);
  }, []);

  const logTouch = useCallback(async (id, channel, kind) => {
    const now = Date.now();
    let computed;
    setLeads((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const touches = [...(l.touches || []), { at: now, channel, kind }];
      const patch = { touches, lastTouchAt: now };
      if (kind === "link" && !l.linkSentAt) {
        patch.linkSentAt = now;
        if (l.status === "new" || l.status === "called") patch.status = "link_sent";
      }
      if (kind === "followup" && l.status === "link_sent") patch.status = "in_followup";
      computed = patch;
      return { ...l, ...patch };
    }));
    if (computed) await supabase.from("leads").update(leadPatchToRow(computed)).eq("id", id);
  }, []);

  const addLead = useCallback(async (data) => {
    const row = {
      name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim(),
      notes: data.notes.trim(), status: "new", touches: [],
    };
    const { data: ins, error } = await supabase.from("leads").insert(row).select().single();
    if (error) { setErr(error.message); return; }
    setLeads((prev) => [rowToLead(ins), ...prev]);
  }, []);

  const removeLead = useCallback(async (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setOpenId((o) => (o === id ? null : o));
    await supabase.from("leads").delete().eq("id", id);
  }, []);

  const dueList = useMemo(() => (
    leads.map((l) => ({ l, due: followupDue(l) }))
      .filter((x) => x.due != null && x.due <= Date.now() + DAY)
      .sort((a, b) => a.due - b.due)
  ), [leads]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter((l) => {
      if (filter === "active" && (l.status === "funded" || l.status === "dead")) return false;
      if (filter === "needs_link" && l.status !== "new" && l.status !== "called") return false;
      if (filter === "waiting" && l.status !== "link_sent" && l.status !== "in_followup") return false;
      if (!q) return true;
      return (l.name + l.phone + l.email + l.notes + l.source).toLowerCase().includes(q);
    }).sort((a, b) => (b.lastTouchAt || b.createdAt) - (a.lastTouchAt || a.createdAt));
  }, [leads, query, filter]);

  const stats = useMemo(() => {
    const by = {}; STAGES.forEach((s) => (by[s.key] = 0));
    leads.forEach((l) => (by[l.status] = (by[l.status] || 0) + 1));
    return by;
  }, [leads]);

  if (!loaded) {
    return <div className="flex min-h-96 items-center justify-center font-sans text-slate-400">Loading your pipeline...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl font-sans text-slate-800">
      <div className="rounded-2xl bg-emerald-900 px-5 py-4 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-emerald-950">
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-base font-bold leading-tight tracking-tight">
                ASAP Funding Pipeline
                {live && <span title="Live: new GHL leads appear automatically"><Wifi size={14} className="text-emerald-300" /></span>}
              </div>
              <div className="text-xs text-emerald-200">Call. Send the link. Follow up.</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-lg bg-emerald-950/40 p-1 text-sm">
            {[["pipeline", "Pipeline"], ["scripts", "Scripts"], ["settings", "Settings"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${tab === k ? "bg-white text-emerald-900" : "text-emerald-100 hover:bg-emerald-800"}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {err && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={16} /> {err}
        </div>
      )}
      {!config.reportLink && tab !== "settings" && (
        <button onClick={() => setTab("settings")}
          className="mt-3 flex w-full items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100">
          <AlertCircle size={16} /> Set your MyScoreIQ link in Settings so every text and email sends the right URL.
        </button>
      )}

      {tab === "pipeline" && (
        <Pipeline leads={filtered} allCount={leads.length} dueList={dueList} stats={stats} config={config}
          query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}
          openId={openId} setOpenId={setOpenId} addLead={addLead} updateLead={updateLead}
          removeLead={removeLead} logTouch={logTouch} />
      )}
      {tab === "scripts" && <Scripts />}
      {tab === "settings" && <Settings config={config} persistConfig={persistConfig} />}

      <p className="mt-6 px-1 text-center text-xs text-slate-400">
        Texts and emails open in your own phone and mail app, so they come from your number and address.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */
function Pipeline(props) {
  const { leads, allCount, dueList, stats, config, query, setQuery, filter, setFilter,
    openId, setOpenId, addLead, updateLead, removeLead, logTouch } = props;
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="mt-4">
      {dueList.length > 0 && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-orange-800">
            <Clock size={15} /> Follow up now ({dueList.length})
          </div>
          <div className="flex flex-col gap-2">
            {dueList.map(({ l, due }) => {
              const rel = relativeDue(due);
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-orange-100">
                  <span className="font-semibold">{l.name || "Unnamed"}</span>
                  <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-600"}`}>{rel.label}</span>
                  <div className="ml-auto flex gap-1.5">
                    <a href={smsHref(l.phone, fillTokens(config.followupSmsBody, l, config))}
                      onClick={() => l.phone && logTouch(l.id, "sms", "followup")}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${l.phone ? "bg-emerald-600 text-white hover:bg-emerald-700" : "pointer-events-none bg-slate-100 text-slate-300"}`}>
                      <MessageSquare size={14} /> Text
                    </a>
                    <a href={mailHref(l.email, fillTokens(config.followupEmailSubject, l, config), fillTokens(config.followupEmailBody, l, config))}
                      onClick={() => l.email && logTouch(l.id, "email", "followup")}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${l.email ? "bg-white text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50" : "pointer-events-none bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}>
                      <Mail size={14} /> Email
                    </a>
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400">
          <option value="active">Active</option>
          <option value="needs_link">Needs link</option>
          <option value="waiting">Waiting on report</option>
          <option value="all">All</option>
        </select>
        <button onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <Plus size={16} /> Add prospect
        </button>
      </div>

      {showAdd && <AddForm onAdd={(d) => { addLead(d); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <span key={s.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE[s.tone]}`}>
            {s.label} <span className="font-bold">{stats[s.key] || 0}</span>
          </span>
        ))}
      </div>

      {allCount === 0 ? (
        <Empty onAdd={() => setShowAdd(true)} />
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No prospects match this view.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((l) => (
            <LeadRow key={l.id} lead={l} config={config} open={openId === l.id}
              onToggle={() => setOpenId(openId === l.id ? null : l.id)}
              updateLead={updateLead} removeLead={removeLead} logTouch={logTouch} />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ onAdd }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
      <User size={28} className="mx-auto text-slate-300" />
      <div className="mt-2 text-sm font-medium text-slate-600">No prospects yet</div>
      <div className="mt-1 text-sm text-slate-400">Add one by hand, or they will arrive automatically from GoHighLevel.</div>
      <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
        <Plus size={16} /> Add prospect
      </button>
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
        <input autoFocus value={f.name} onChange={set("name")} placeholder="Name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
        <input value={f.phone} onChange={set("phone")} placeholder="Phone" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
        <input value={f.email} onChange={set("email")} placeholder="Email" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
        <input value={f.notes} onChange={set("notes")} placeholder="Notes (source, what they need)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <button disabled={!canSave} onClick={() => onAdd(f)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}

function LeadRow({ lead, config, open, onToggle, updateLead, removeLead, logTouch }) {
  const due = followupDue(lead);
  const rel = relativeDue(due);
  const hasPhone = !!lead.phone;
  const hasEmail = !!lead.email;

  return (
    <div className={`rounded-xl border bg-white transition ${open ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{lead.name || "Unnamed"}</span>
            <StagePill status={lead.status} />
            {rel && <span className={`text-xs font-medium ${rel.overdue ? "text-rose-600" : "text-orange-500"}`}>{rel.label}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-slate-500">
            {hasPhone && <span>{lead.phone}</span>}
            {hasEmail && <span className="truncate">{lead.email}</span>}
            {lead.source && <span className="not-italic text-slate-400">via {lead.source}</span>}
          </div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {lead.notes && <p className="mb-3 text-sm text-slate-600">{lead.notes}</p>}

          <div className="mb-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Send the MyScoreIQ link</div>
            <div className="flex flex-wrap gap-2">
              <a href={telHref(lead.phone)} onClick={() => hasPhone && updateLead(lead.id, { status: lead.status === "new" ? "called" : lead.status, lastTouchAt: Date.now() })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${hasPhone ? "bg-slate-800 text-white hover:bg-slate-900" : "pointer-events-none bg-slate-100 text-slate-300"}`}>
                <Phone size={15} /> Call
              </a>
              <a href={smsHref(lead.phone, fillTokens(config.smsBody, lead, config))} onClick={() => hasPhone && logTouch(lead.id, "sms", "link")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${hasPhone ? "bg-emerald-600 text-white hover:bg-emerald-700" : "pointer-events-none bg-slate-100 text-slate-300"}`}>
                <MessageSquare size={15} /> Text link
              </a>
              <a href={mailHref(lead.email, fillTokens(config.emailSubject, lead, config), fillTokens(config.emailBody, lead, config))} onClick={() => hasEmail && logTouch(lead.id, "email", "link")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${hasEmail ? "bg-white text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50" : "pointer-events-none bg-slate-100 text-slate-300 ring-1 ring-slate-200"}`}>
                <Mail size={15} /> Email link
              </a>
              <CopyButton text={config.reportLink || ""} label="Copy link" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
              <CopyButton text={fillTokens(config.smsBody, lead, config)} label="Copy text" className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Move stage</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s.key} onClick={() => updateLead(lead.id, { status: s.key, lastTouchAt: Date.now() })}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${lead.status === s.key ? TONE[s.tone] + " ring-2" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="text-xs text-slate-400">
              {lead.linkSentAt && <div>Link sent {fmtDate(lead.linkSentAt)}</div>}
              <div>{(lead.touches || []).length} touch{(lead.touches || []).length === 1 ? "" : "es"} logged</div>
            </div>
            <button onClick={() => { if (confirm(`Remove ${lead.name || "this prospect"}?`)) removeLead(lead.id); }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scripts                                                            */
/* ------------------------------------------------------------------ */
const SCRIPTS = [
  { title: "Cold call open", body:
`Hi, is this {NAME}? Great. This is {YOUR NAME} with ASAP Funding USA. I will keep this quick.

We help business owners get into a position to be approved for funding, usually within 60 to 90 days, and a lot of the time sooner. Before I can tell you what you would qualify for, I need to see your full profile.

The fastest way to do that is a soft pull through a secure monitoring link. It takes about 5 minutes and does not ding your score. I can text or email it to you right now while we are on the phone. Which is better, text or email?` },
  { title: "Warm / inbound (they asked about funding)", body:
`Hi {NAME}, this is {YOUR NAME} with ASAP Funding USA, returning your inquiry about funding. Thanks for reaching out.

To match you with the right options I need to look at your full credit profile. The cleanest way is a secure link that pulls your report in about 5 minutes. Nothing about it hurts your score.

I am going to send that to you right now. Are you near your phone or your email? I will stay on with you while you open it so it is done in one shot.` },
  { title: "Voicemail", body:
`Hi {NAME}, this is {YOUR NAME} with ASAP Funding USA. I have funding options I want to walk you through, I just need to see your profile first.

I am texting and emailing you a secure link right now that pulls your report in about 5 minutes. Open that when you get a sec and I will follow up. Again this is {YOUR NAME} with ASAP Funding USA. Talk soon.` },
  { title: "Objection: why do you need my credit?", body:
`Totally fair question. Funders price and approve based on your profile, so if I guess I waste your time and theirs. Pulling it lets me match you to the lenders you actually fit, instead of throwing you at a wall and risking hard inquiries that lower your score.

This is a soft pull through a monitoring service. It does not affect your score and you stay in control of the account. Five minutes now saves you weeks of dead ends.` },
  { title: "Objection: is this safe / what is this link?", body:
`Good, I want you to ask that. It is a secure monitoring service, the same kind people use to watch their own credit. You create your own login, you can see everything I see, and you can cancel anytime.

I am not asking for a password or anything sensitive over the phone. You enter your own info on their secure site. I just get read access to review your report so I can build your options.` },
  { title: "Objection: I am busy right now", body:
`No problem, this is exactly why I keep it to one link. I am sending it to your phone and email right now so it is waiting for you. It is about 5 minutes whenever you have a window today.

What works better, should I check back with you this afternoon or first thing tomorrow? I will lock that in so this does not slip.` },
  { title: "After they pull it (next step)", body:
`Perfect, I can see it came through, thank you. Give me a little time to go through everything and match you to the right funding options.

I will call you back today with where you stand and the path to get approval ready. If anything looks like it needs cleanup first, I will lay out the plan and the timeline, usually 60 to 90 days.` },
  { title: "Why pull it (one-liner for prospects)", body:
`A 5 minute soft pull, no score impact, so I can match you to the funders you actually qualify for instead of guessing and risking hard inquiries.` },
];

function Scripts() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Swap <span className="font-mono text-slate-700">{"{NAME}"}</span> and{" "}
        <span className="font-mono text-slate-700">{"{YOUR NAME}"}</span> as you go. Tap copy to grab any script.
      </p>
      {SCRIPTS.map((s) => (
        <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <FileText size={15} className="text-emerald-600" /> {s.title}
            </h3>
            <CopyButton text={s.body} className="bg-slate-100 text-slate-700 hover:bg-slate-200" />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */
function Settings({ config, persistConfig }) {
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const save = async () => { await persistConfig(draft); setSaved(true); setTimeout(() => setSaved(false), 1600); };

  const Field = ({ label, k, textarea, rows = 4, placeholder, mono }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {textarea ? (
        <textarea value={draft[k]} onChange={set(k)} rows={rows} placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
      ) : (
        <input value={draft[k]} onChange={set(k)} placeholder={placeholder}
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${mono ? "font-mono" : ""}`} />
      )}
    </div>
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <SettingsIcon size={15} className="text-emerald-600" /> Core setup
        </h3>
        <div className="flex flex-col gap-3">
          <Field label="MyScoreIQ link" k="reportLink" placeholder="https://www.myscoreiq.com/..." mono />
          <Field label="Signature / who it is from" k="signature" placeholder="Joe at ASAP Funding USA" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-bold text-slate-800">First touch templates</h3>
        <p className="mb-3 text-xs text-slate-400">
          Tokens: <span className="font-mono">{"{{first}}"}</span>, <span className="font-mono">{"{{name}}"}</span>, <span className="font-mono">{"{{link}}"}</span>, <span className="font-mono">{"{{signature}}"}</span>
        </p>
        <div className="flex flex-col gap-3">
          <Field label="Email subject" k="emailSubject" />
          <Field label="Email body" k="emailBody" textarea rows={8} />
          <Field label="Text message" k="smsBody" textarea rows={3} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-800">Follow-up templates</h3>
        <div className="flex flex-col gap-3">
          <Field label="Follow-up email subject" k="followupEmailSubject" />
          <Field label="Follow-up email body" k="followupEmailBody" textarea rows={7} />
          <Field label="Follow-up text" k="followupSmsBody" textarea rows={3} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <Send size={15} /> Save settings
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
      </div>
    </div>
  );
}
