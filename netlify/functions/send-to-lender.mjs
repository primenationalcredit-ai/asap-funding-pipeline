import { createClient } from "@supabase/supabase-js";

async function sendEmail(to, cc, subject, text, attachments) {
  const personalization = { to: [{ email: to }] };
  const ccList = (cc || "").split(",").map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
  if (ccList.length) personalization.cc = ccList;
  const body = {
    personalizations: [personalization],
    from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "ASAP Funding USA" },
    subject,
    content: [{ type: "text/plain", value: text }],
    attachments: attachments.map((a) => ({ content: a.data, filename: a.name, type: a.type || "application/octet-stream", disposition: "attachment" })),
  };
  if (process.env.EMAIL_REPLY_TO) body.reply_to = { email: process.env.EMAIL_REPLY_TO };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (r.status !== 202) { const t = await r.text(); throw new Error(`Email failed ${r.status}: ${t}`); }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { leadId, toEmail, cc, lenderName, note, paths } = JSON.parse(event.body || "{}");
    if (!leadId || !toEmail) return { statusCode: 400, body: JSON.stringify({ error: "leadId and toEmail required" }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: lead } = await supabase.from("leads").select("id,name,business_name,documents,submissions,phone,email").eq("id", leadId).maybeSingle();
    if (!lead) return { statusCode: 404, body: JSON.stringify({ error: "lead not found" }) };

    const docs = Array.isArray(lead.documents) ? lead.documents : [];
    const wanted = paths && paths.length ? docs.filter((d) => paths.includes(d.path)) : docs;
    if (!wanted.length) return { statusCode: 400, body: JSON.stringify({ error: "no documents on file to send" }) };

    const attachments = [];
    let bytesTotal = 0;
    for (const d of wanted) {
      const { data: file, error } = await supabase.storage.from("reports").download(d.path);
      if (error || !file) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      bytesTotal += buf.length;
      if (bytesTotal > 24 * 1024 * 1024) break;
      attachments.push({ name: d.name || "document", type: file.type || "application/octet-stream", data: buf.toString("base64") });
    }
    if (!attachments.length) return { statusCode: 400, body: JSON.stringify({ error: "could not read documents" }) };

    const biz = lead.business_name || lead.name || "Applicant";
    const text = `${note ? note + "\n\n" : ""}Please find attached the funding application and supporting documents for ${biz}.\n\nContact: ${lead.name || ""}${lead.phone ? " · " + lead.phone : ""}${lead.email ? " · " + lead.email : ""}\n\nThank you,\nASAP Funding USA`;

    await sendEmail(toEmail, cc, `Funding submission — ${biz}`, text, attachments);

    const submissions = Array.isArray(lead.submissions) ? lead.submissions : [];
    const submission = { id: Date.now().toString(36), lender: lenderName || toEmail, email: toEmail, cc: cc || "", files: attachments.length, sentAt: Date.now(), status: "Submitted", note: "", amount: "" };
    submissions.unshift(submission);
    await supabase.from("leads").update({ submissions, last_touch_at: new Date().toISOString() }).eq("id", lead.id);
    await supabase.from("communications").insert({ lead_id: lead.id, direction: "out", channel: "note", body: `Submitted application package (${attachments.length} files) to ${lenderName || toEmail}${cc ? " (cc: " + cc + ")" : ""}`, by_user: "system" });

    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: attachments.length, to: toEmail, submission }) };
  } catch (e) {
    console.log("[send-to-lender] error", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
