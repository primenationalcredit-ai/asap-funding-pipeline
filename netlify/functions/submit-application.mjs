import { createClient } from "@supabase/supabase-js";

async function sendEmail(to, subject, text) {
  const body = { personalizations: [{ to: [{ email: to }] }], from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "ASAP Funding USA" }, subject, content: [{ type: "text/plain", value: text }] };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email ${r.status}: ${t}`); }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const warnings = [];
  try {
    const p = JSON.parse(event.body || "{}");
    const to = process.env.APPLICATION_TO || process.env.EMAIL_FROM;
    const biz = p.business || "Unknown business";
    const owner = p.owner || "";
    const f = p.fields || {};
    const docs = Array.isArray(p.docs) ? p.docs : [];

    let filed = false;
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const email = (p.email || f.owner_email || "").toLowerCase().trim();
        const phone10 = (p.phone || f.cell_phone || "").replace(/\D/g, "").slice(-10);
        let lead = null;
        if (email) {
          const { data } = await supabase.from("leads").select("id,documents,status,last_touch_at").ilike("email", email).order("last_touch_at", { ascending: false, nullsFirst: false }).limit(1);
          lead = data && data[0];
        }
        if (!lead && phone10) {
          const { data } = await supabase.from("leads").select("id,documents,status,phone,last_touch_at").not("phone", "is", null).order("last_touch_at", { ascending: false, nullsFirst: false }).limit(1000);
          lead = (data || []).find((l) => (l.phone || "").replace(/\D/g, "").slice(-10) === phone10) || null;
        }
        // Match on the LAST 10 DIGITS of the phone as a final fallback, and try the
        // business name, before giving up. A client typing a different email or a
        // mobile instead of the number we have should not lose their application.
        if (!lead && (f.legal_name || "").trim()) {
          const biz = String(f.legal_name).trim();
          const { data } = await supabase.from("leads").select("id,documents,status,last_touch_at")
            .ilike("business_name", biz).order("last_touch_at", { ascending: false, nullsFirst: false }).limit(1);
          lead = data && data[0];
          if (lead) console.log("[submit-application] matched by business name:", biz);
        }

        if (lead) {
          const newDocs = docs.map((d) => ({ name: d.name, path: d.path, label: d.label || "Other", uploadedAt: Date.now(), by: "application form" }));
          // Append SERVER-SIDE. This used to read the documents array, add to it and
          // write the whole thing back, so anything uploaded in the CRM in the
          // meantime was silently erased.
          const { error: aErr } = await supabase.rpc("append_documents", { p_lead_id: lead.id, p_docs: newDocs });
          if (aErr) console.log("[submit-application] append_documents failed, falling back:", aErr.message);
          const existing = Array.isArray(lead.documents) ? lead.documents : [];
          const patch = aErr
            ? { documents: [...existing, ...newDocs], last_touch_at: new Date().toISOString() }
            : { last_touch_at: new Date().toISOString() };
          // The client sending their application back is "received", not "sent".
          // If their reports are already in, they move straight to App & Reports Received.
          const movable = ["new", "voicemail", "interested", "callback", "check_back", "appointment_booked", "waiting_reports", "app_sent"];
          if (lead.status === "report_pulled") patch.status = "app_reports_received";
          else if (movable.includes(lead.status)) patch.status = "app_received";
          await supabase.from("leads").update(patch).eq("id", lead.id);
          await supabase.from("communications").insert({ lead_id: lead.id, direction: "in", channel: "note", body: `Client submitted the funding application with ${newDocs.length} document(s).`, by_user: "application form" });
          filed = true;
        } else {
          // NOTHING MATCHED. Previously the application and every uploaded document
          // were abandoned in storage with only a warning nobody reads — which is
          // exactly how a client's completed application went missing. Create a
          // lead instead so the work is never lost.
          const nm = (f.owner_name || p.name || "").trim() || (f.legal_name || "").trim() || "Application (no name)";
          const newDocs = docs.map((d) => ({ name: d.name, path: d.path, label: d.label || "Other", uploadedAt: Date.now(), by: "application form" }));
          const { data: made, error: mErr } = await supabase.from("leads").insert({
            name: nm,
            email: email || "",
            phone: (p.phone || f.cell_phone || "").trim(),
            business_name: (f.legal_name || "").trim(),
            status: "app_received",
            source: "Application form (unmatched)",
            documents: newDocs,
            estimated_credit_score: "", monthly_revenue: "", funding_timeline: "",
            touches: [],
          }).select("id").single();
          if (mErr) {
            console.log("[submit-application] *** COULD NOT SAVE UNMATCHED APPLICATION ***", mErr.message, JSON.stringify({ email, phone10, docs: docs.length }));
            warnings.push("no matching lead AND could not create one for " + email + " / " + phone10);
          } else {
            await supabase.from("communications").insert({
              lead_id: made.id, direction: "in", channel: "note",
              body: `Client submitted the funding application with ${newDocs.length} document(s). No existing client matched ${email || "(no email)"} / ${phone10 || "(no phone)"}, so this record was created automatically. Check for a duplicate and merge if needed.`,
              by_user: "application form",
            });
            console.log("[submit-application] created unmatched lead", made.id, "for", email, phone10);
            warnings.push("no match, created new lead " + made.id);
            filed = true;
          }
        }
      }
    } catch (e) { warnings.push("file-on-lead: " + e.message); console.log("[submit-application] file failed:", e.message); }

    try {
      const summary =
`New funding application submitted.

BUSINESS
  Legal name:   ${f.legal_name || ""}
  Requested:    ${f.amount_requested || ""}

OWNER / GUARANTOR
  Name:  ${f.owner_name || ""} (${f.owner_title || ""})
  Email: ${f.owner_email || ""}   Cell: ${f.cell_phone || ""}

Documents uploaded: ${docs.map((d) => d.label).join(", ") || "none"}.
Filed to a client record: ${filed ? "YES" : "NO - no matching lead found, attach manually"}.
Document storage paths:
${docs.map((d) => "  " + d.label + ": " + d.path).join("\n") || "  none"}

Open the client's file in the CRM to review.`;
      await sendEmail(to, `Funding Application — ${biz}${owner ? " (" + owner + ")" : ""}`, summary);
    } catch (e) { warnings.push("email: " + e.message); console.log("[submit-application] email failed:", e.message); }

    if (warnings.length) console.log("[submit-application] warnings:", warnings.join(" | "));
    return { statusCode: 200, body: JSON.stringify({ ok: true, filed, warnings }) };
  } catch (e) {
    console.log("[submit-application] fatal:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
