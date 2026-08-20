// netlify/functions/pb-sync-folders.mjs
// Re-file EVERY PhoneBurner contact into the folder matching its CURRENT CRM
// stage.
//
// Why this exists: pb-start-session sets the folder at push time only. If a
// lead moves on afterwards — voicemail to dead, or to app_sent — PhoneBurner
// keeps them in the old folder forever. Reps then dial a "Left Voicemail" list
// full of people who have already been handled, which looks like the dialer
// failing to update.
import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { error: "POST only" });
  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "phoneburner_token").single();
    const pbToken = secret && secret.value;
    if (!pbToken) return resp(500, { error: "No PhoneBurner token configured" });

    const headers = { Authorization: `Bearer ${pbToken}`, "Content-Type": "application/json" };

    // Same stage -> folder NAME map as the dial push, resolved live so ids
    // can never drift.
    const STAGE_FOLDER_NAME = {
      new: "New Leads", appointment_booked: "Appt Booked", voicemail: "Left Voicemail",
      waiting_reports: "Sent Reports", app_sent: "Sent Application", wrong_number: "Wrong Number",
      callback: "Call Back", check_back: "Check Back Later",
      app_reports_received: "App & Reports Received", not_interested: "Not Interested",
    };
    const norm = (v) => String(v || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

    const nameToId = new Map();
    try {
      const fr = await fetch("https://www.phoneburner.com/rest/1/folders", { headers });
      const fj = await fr.json().catch(() => ({}));
      const raw = fj?.folders ?? {};
      const list = Array.isArray(raw) ? raw : Object.values(raw);
      for (const f of list) {
        if (!f || typeof f !== "object") continue;
        const id = f.folder_id || f.id;
        const nm = f.folder_name || f.name;
        if (id && nm) nameToId.set(norm(nm), String(id));
      }
    } catch (e) { return resp(500, { error: "Could not read PhoneBurner folders: " + e.message }); }
    if (!nameToId.size) return resp(500, { error: "PhoneBurner returned no folders" });

    // Leads whose stage HAS a folder. Anything else (deep funding, closed) is
    // deliberately left alone — those should not be in a dial folder at all.
    const stages = Object.keys(STAGE_FOLDER_NAME);
    const { data: leads, error } = await admin.from("leads")
      .select("id, name, email, phone, status, opted_out")
      .in("status", stages);
    if (error) throw error;

    const contacts = (leads || [])
      .filter((l) => !l.opted_out && String(l.phone || "").replace(/\D/g, "").length >= 10)
      .map((l) => {
        const parts = String(l.name || "").trim().split(/\s+/);
        const email = String(l.email || "").trim();
        const folder = nameToId.get(norm(STAGE_FOLDER_NAME[l.status]));
        const c = {
          first_name: parts[0] || "Lead",
          last_name: parts.slice(1).join(" ") || "-",
          phone: String(l.phone).replace(/\D/g, ""),
          lead_id: l.id,
          category_id: Number(folder),
          on_duplicate: "update",
          duplicate_checks: { email: !!email, phone: true },
          duplicate_scrubbing_policy: 0,
        };
        if (email) c.email = email;
        return c;
      })
      .filter((c) => c.category_id);

    const result = { total: contacts.length, synced: 0, moved: 0, failed: 0, byFolder: {} };
    for (const c of contacts) result.byFolder[c.category_id] = (result.byFolder[c.category_id] || 0) + 1;

    // Two calls per contact, so work in parallel batches against a deadline.
    // Whatever is left over gets picked up next run.
    const CONCURRENCY = 8;
    const DEADLINE = Date.now() + 20000;
    const one = async (c) => {
      try {
        const up = await fetch("https://www.phoneburner.com/rest/1/contacts", {
          method: "POST", headers, body: JSON.stringify(c),
        });
        const uj = await up.json().catch(() => ({}));
        const rec = uj?.contacts?.contacts;
        const id = Array.isArray(rec) ? rec[0]?.contact_user_id : rec?.contact_user_id;
        if (!id) { result.failed++; return; }
        const mv = await fetch(`https://www.phoneburner.com/rest/1/contacts/${id}`, {
          method: "PUT", headers, body: JSON.stringify({ category_id: c.category_id }),
        });
        if (mv.ok) result.moved++; else result.failed++;
      } catch { result.failed++; }
    };

    for (let i = 0; i < contacts.length; i += CONCURRENCY) {
      if (Date.now() > DEADLINE) { console.log(`[pb-sync-folders] deadline hit, ${contacts.length - result.synced} left for next run`); break; }
      const batch = contacts.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(one));
      result.synced += batch.length;
    }

    console.log("[pb-sync-folders]", JSON.stringify(result));
    return resp(200, { ok: true, ...result });
  } catch (e) {
    console.log("[pb-sync-folders] error", e.message);
    return resp(500, { error: e.message });
  }
};
