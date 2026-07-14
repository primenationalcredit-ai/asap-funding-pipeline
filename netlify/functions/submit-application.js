import { createClient } from "@supabase/supabase-js";

function guessLabel(name) {
  const s = (name || "").toLowerCase();
  if (/bank|statement/.test(s)) return "Bank statements";
  if (/void|check/.test(s)) return "Voided check";
  if (/licen|dl|id\b|driver/.test(s)) return "Driver's license";
  if (/credit/.test(s)) return "Credit report";
  if (/tax|return/.test(s)) return "Tax return";
  return "Other";
}

async function sendEmailWithAttachments(to, subject, text, attachments) {
  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "ASAP Funding USA" },
    subject,
    content: [{ type: "text/plain", value: text }],
    attachments: attachments.map((a) => ({ content: a.data, filename: a.name, type: a.type || "application/octet-stream", disposition: "attachment" })),
  };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    const safe = (biz || "application").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);

    let filed = false;
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const email = (p.email || f.owner_email || "").toLowerCase();
        let lead = null;
        if (email) { const { data } = await supabase.from("leads").select("id,documents,status").ilike("email", email).maybeSingle(); lead = data; }
        if (lead) {
          const docs = Array.isArray(lead.documents) ? lead.documents : [];
          if (p.applicationPdf) {
            const path = `${lead.id}/application-${Date.now()}.pdf`;
            await supabase.storage.from("reports").upload(path, Buffer.from(p.applicationPdf, "base64"), { contentType: "application/pdf", upsert: true });
            docs.push({ name: `Application-${safe}.pdf`, path, label: "Application", uploadedAt: Date.now(), by: "application form" });
          }
          for (const a of (p.attachments || [])) {
            if (!a || !a.data) continue;
            const clean = (a.name || "document").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
            const path = `${lead.id}/appdoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${clean}`;
            try {
              await supabase.storage.from("reports").upload(path, Buffer.from(a.data, "base64"), { contentType: a.type || "application/octet-stream", upsert: true });
              docs.push({ name: a.name || clean, path, label: a.label || guessLabel(a.name), uploadedAt: Date.now(), by: "application form" });
            } catch (e) { warnings.push("doc store: " + e.message); }
          }
          const patch = { documents: docs, last_touch_at: new Date().toISOString() };
          if (["new", "voicemail", "interested", "callback", "check_back"].includes(lead.status)) patch.status = "app_sent";
          await supabase.from("leads").update(patch).eq("id", lead.id);
          await supabase.from("communications").insert({ lead_id: lead.id, direction: "in", channel: "note", body: "Client submitted the funding application with documents.", by_user: "application form" });
          filed = true;
        } else {
          warnings.push("no matching lead for " + email);
        }
      }
    } catch (e) { warnings.push("file-on-lead: " + e.message); }

    try {
      const attachments = [];
      if (p.applicationPdf) attachments.push({ name: `Application-${safe}.pdf`, type: "application/pdf", data: p.applicationPdf });
      (p.attachments || []).forEach((a) => { if (a && a.data) attachments.push({ name: a.name || "document", type: a.type, data: a.data }); });
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

Signed by ${f.consent_name || owner} on ${f.sign_date || ""}.
Application PDF and all uploaded documents are attached.`;
      await sendEmailWithAttachments(to, `Funding Application — ${biz}${owner ? " (" + owner + ")" : ""}`, summary, attachments);
    } catch (e) { warnings.push("email: " + e.message); console.log("[submit-application] email failed:", e.message); }

    if (warnings.length) console.log("[submit-application] warnings:", warnings.join(" | "));
    return { statusCode: 200, body: JSON.stringify({ ok: true, filed, warnings }) };
  } catch (e) {
    console.log("[submit-application] fatal:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
