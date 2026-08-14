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

    const { data: leads, error: lErr } = await admin.from("leads").select("id, name, email, phone").in("id", leadIds);
    if (lErr) return resp(500, { error: lErr.message });

    // PhoneBurner folder ("category") that pushed leads land in. Without this the
    // API drops them in the default "Contacts" folder. Overridable by env so the
    // folder can change without a code deploy.
    const PB_FOLDER_ID = Number(process.env.PB_FOLDER_ID || 3325925); // "New Leads"

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
          category_id: PB_FOLDER_ID, // land in "New Leads", not the default Contacts folder
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
    const redirect = j.redirect_url || j.redirectUrl || j?.dialsession?.redirect_url;
    console.log("[pb-start] session created for", contacts.length, "contacts into folder", PB_FOLDER_ID);
    return resp(200, { ok: true, redirect_url: redirect, contacts: contacts.length, raw: redirect ? undefined : j });
  } catch (e) {
    console.log("[pb-start] error", e.message);
    return resp(500, { error: e.message });
  }
};
