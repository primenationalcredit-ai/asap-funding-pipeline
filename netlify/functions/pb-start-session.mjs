// netlify/functions/pb-start-session.mjs
// Launches a PhoneBurner power-dial session for a list of CRM leads.
// The app POSTs { leadIds: [...] } with the user's Supabase auth token;
// we load those leads, hand them to PhoneBurner with our lead UUID attached,
// and return the redirect_url that drops the caller straight into the session.
// PhoneBurner token lives in Supabase app_secrets (key: phoneburner_token).
import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

async function requireUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const sb = createClient(process.env.SUPABASE_URL, key);
  const { data, error } = await sb.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resp(405, { error: "POST only" });
    const user = await requireUser(event);
    if (!user) return resp(401, { error: "Not authorized" });

    const { leadIds } = JSON.parse(event.body || "{}");
    if (!Array.isArray(leadIds) || !leadIds.length) return resp(422, { error: "leadIds required" });
    if (leadIds.length > 200) return resp(422, { error: "200 leads max per session" });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: secrets, error: sErr } = await admin.from("app_secrets").select("key, value").eq("key", "phoneburner_token");
    if (sErr || !secrets?.length) return resp(500, { error: "phoneburner_token missing from app_secrets" });
    const pbToken = secrets[0].value;

    const { data: leads, error: lErr } = await admin.from("leads").select("id, name, email, phone, status").in("id", leadIds);
    if (lErr) return resp(500, { error: lErr.message });

    // Each lead lands in the PhoneBurner folder matching its CRM stage, so a rep
    // opening a folder sees only leads at that step. Without this the API drops
    // everything into the default "Contacts" folder (65932).
    const PB_NEW_LEADS = 3325925;
    const STAGE_FOLDER = {
      new: PB_NEW_LEADS,
      appointment_booked: 3325865,
      voicemail: 3325867,
      waiting_reports: 3325861,       // Sent Reports
      app_sent: 3325864,              // Sent Application
      wrong_number: 3325868,
      callback: 3325857,              // Call Back
      check_back: 3325859,            // Check Back Later
      app_reports_received: 3325866,  // App & Reports Received
      not_interested: 3323960,
    };
    // Stages with no folder (Funding, Closed) fall back to New Leads and are
    // logged, so a mapping can be added rather than silently misfiling them.
    const unmapped = [];
    const folderFor = (status) => {
      const key = status || "new";
      const id = STAGE_FOLDER[key];
      if (id) return id;
      unmapped.push(key);
      return PB_NEW_LEADS;
    };

    const contacts = (leads || [])
      .filter((l) => (l.phone || "").replace(/\D/g, "").length >= 10)
      .map((l) => {
        const parts = String(l.name || "").trim().split(/\s+/);
        return {
          first_name: parts[0] || "Lead",
          last_name: parts.slice(1).join(" ") || "-",
          phone: String(l.phone).replace(/\D/g, ""),
          email: l.email || "",
          lead_id: l.id, // our UUID rides along and comes back in the calldone webhook
          category_id: folderFor(l.status), // folder matches this lead's CRM stage
          // These leads usually already exist in PhoneBurner from an earlier push.
          // Without explicit duplicate handling the existing contact is matched but
          // NOT moved, so it stays in whatever folder it was in (the default
          // "Contacts"). Forcing an update makes category_id apply to existing
          // contacts too, which is what makes the folder mapping actually stick.
          on_duplicate: "update",
          duplicate_checks: { email: true, phone: true },
        };
      });
    if (!contacts.length) return resp(422, { error: "none of the selected leads have a dialable phone" });

    const site = process.env.URL || "https://tranquil-muffin-691d4e.netlify.app";
    const cbKey = process.env.PB_CALLBACK_KEY || "pbk";
    const body = {
      contacts,
      callbacks: [
        { callback_type: "api_calldone", callback: `${site}/.netlify/functions/pb-calldone?key=${cbKey}` },
      ],
    };

    const r = await fetch("https://www.phoneburner.com/rest/1/dialsession", {
      method: "POST",
      headers: { Authorization: `Bearer ${pbToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.log("[pb-start] PB error", r.status, JSON.stringify(j).slice(0, 400));
      return resp(502, { error: j.message || `PhoneBurner error ${r.status}` });
    }
    // PhoneBurner nests this under "dialsessions" (PLURAL) per their API docs.
    // We were reading j.dialsession (singular), which is why the dialer never
    // opened and the app said "session created but no link".
    const redirect = j?.dialsessions?.redirect_url || j?.dialsession?.redirect_url || j.redirect_url || j.redirectUrl;
    const spread = contacts.reduce((m, c) => { m[c.category_id] = (m[c.category_id] || 0) + 1; return m; }, {});
    if (!redirect) console.log("[pb-start] NO redirect_url. Raw response:", JSON.stringify(j).slice(0, 800));
    console.log("[pb-start] session created for", contacts.length, "contacts; folders:", JSON.stringify(spread));
    if (unmapped.length) console.log("[pb-start] UNMAPPED stages sent to New Leads:", JSON.stringify([...new Set(unmapped)]));
    return resp(200, { ok: true, redirect_url: redirect, contacts: contacts.length, raw: redirect ? undefined : j });
  } catch (e) {
    console.log("[pb-start] error", e.message);
    return resp(500, { error: e.message });
  }
};
