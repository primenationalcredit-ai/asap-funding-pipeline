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
        const email = (p.email || f.owner_email || "").toLowerCase();
        let lead = null;
        if (email) { const { data } = await supabase.from("leads").select("id,documents,status").ilike("email", email).maybeSingle(); lead = data; }
        if (lead) {
          const existing = Array.isArray(lead.documents) ? lead.documents : [];
          const newDocs = docs.map((d) => ({ name: d.name, path: d.path, label: d.label || "Other", uploadedAt: Date.now(), by: "application form" }));
          const patch = { documents: [...existing, ...newDocs], last_touch_at: new Date().toISOString() };
          if (["new", "voicemail", "interested", "callback", "check_back"].includes(lead.status)) patch.status = "app_sent";
          await supabase.from("leads").update(patch).eq("id", lead.id);
          await supabase.from("communications").insert({ lead_id: lead.id, direction: "in", channel: "note", body: `Client submitted the funding application with ${newDocs.length} document(s).`, by_user: "application form" });
          filed = true;
        } else { warnings.push("no matching lead for " + email); }
      }
    } catch (e) { warnings.push("file-on-lead: " + e.message); console.log("[submit-application] file failed:", e.message); }

    try {
      const summary =
`New funding application submitted.

BUSINESS
  Legal name:   ${f.legal_name || ""}
  Type:         ${f.business_type || ""}
  Entity:       ${f.entity_type || ""}
  Address:      ${[f.biz_address, f.biz_city, f.biz_state, f.biz_zip].filter(Boolean).join(", ")}
  Phone:        ${f.biz_phone || ""}
  EIN:          ${f.ein || ""}
  Annual sales: ${f.annual_sales || ""}
  Requested:    ${f.amount_requested || ""}

OWNER / GUARANTOR
  Name:  ${f.owner_name || ""} (${f.owner_title || ""})
  DOB:   ${f.owner_dob || ""}   SSN: ${f.owner_ssn || ""}
  DL:    ${f.dl_number || ""} (${f.dl_state || ""})
  Email: ${f.owner_email || ""}   Cell: ${f.cell_phone || ""}

Documents uploaded: ${docs.map((d) => d.label).join(", ") || "none"}.
Signed by ${f.consent_name || owner} on ${f.sign_date || ""}.

Open the client's file in the CRM to review the application and documents, and to send the package to lenders.`;
      await sendEmail(to, `Funding Application — ${biz}${owner ? " (" + owner + ")" : ""}`, summary);
    } catch (e) { warnings.push("email: " + e.message); console.log("[submit-application] email failed:", e.message); }

    if (warnings.length) console.log("[submit-application] warnings:", warnings.join(" | "));
    return { statusCode: 200, body: JSON.stringify({ ok: true, filed, warnings }) };
  } catch (e) {
    console.log("[submit-application] fatal:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
