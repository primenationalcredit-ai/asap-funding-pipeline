import { createClient } from "@supabase/supabase-js";

function pdConfig() {
  const domain = process.env.PIPEDRIVE_DOMAIN;
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!domain || !token) throw new Error("Pipedrive not configured (set PIPEDRIVE_DOMAIN and PIPEDRIVE_API_TOKEN in Netlify).");
  return { base: `https://${domain}.pipedrive.com/api/v1`, token };
}

async function pd(path, opts = {}) {
  const { base, token } = pdConfig();
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${base}${path}${sep}api_token=${token}`, opts);
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok || j.success === false) throw new Error(`Pipedrive ${path} ${r.status}: ${JSON.stringify(j.error || j.error_info || j)}`);
  return j.data;
}

async function resolvePipelineStage(pipelineName, stageName) {
  const pipelines = await pd("/pipelines");
  const pipeline = (pipelines || []).find((p) => p.name.toLowerCase() === String(pipelineName || "").toLowerCase()) || (pipelines || [])[0];
  if (!pipeline) throw new Error("No Pipedrive pipelines found");
  const stages = await pd(`/stages?pipeline_id=${pipeline.id}`);
  const stage = (stages || []).find((s) => s.name.toLowerCase() === String(stageName || "").toLowerCase()) || (stages || [])[0];
  if (!stage) throw new Error("No stages found in pipeline " + pipeline.name);
  return { pipeline_id: pipeline.id, stage_id: stage.id };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { leadId } = JSON.parse(event.body || "{}");
    if (!leadId) return { statusCode: 400, body: JSON.stringify({ error: "leadId required" }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (!lead) return { statusCode: 404, body: JSON.stringify({ error: "lead not found" }) };
    const displayName = lead.name || lead.business_name || "Unknown";
    const orgId = process.env.PIPEDRIVE_CR_ORG_ID ? Number(process.env.PIPEDRIVE_CR_ORG_ID) : 200221;

    const person = await pd("/persons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: displayName, email: lead.email ? [lead.email] : [], phone: lead.phone ? [lead.phone] : [], org_id: orgId }),
    });

    const { pipeline_id, stage_id } = await resolvePipelineStage(process.env.PIPEDRIVE_CR_PIPELINE, process.env.PIPEDRIVE_CR_STAGE);
    const dealBody = { title: `${lead.business_name || displayName} - Credit Repair`, person_id: person.id, pipeline_id, stage_id };
    if (orgId) dealBody.org_id = orgId;
    const deal = await pd("/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dealBody) });

    const subs = Array.isArray(lead.submissions) ? lead.submissions : [];
    const noteLines = [
      "Referred from ASAP Funding.", "",
      `Business: ${lead.business_name || ""}`,
      `Contact: ${displayName}  |  ${lead.phone || ""}  |  ${lead.email || ""}`,
      `Estimated credit score: ${lead.estimated_credit_score || "n/a"}`,
      `Requested funding: ${lead.desired_amount || "n/a"}`,
      `Monthly revenue: ${lead.monthly_revenue || "n/a"}`,
      `Time in business: ${lead.time_in_business || "n/a"}`,
      `Funding stage when referred: ${lead.status || ""}`,
    ];
    if (subs.length) { noteLines.push("", "Funding history (lenders tried):"); subs.forEach((s) => noteLines.push(`  - ${s.lender}: ${s.status}${s.amount ? " ($" + s.amount + ")" : ""}${s.note ? " - " + s.note : ""}`)); }
    else { noteLines.push("", "No lender submissions on record."); }
    await pd("/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: noteLines.join("\n").replace(/\n/g, "<br>"), deal_id: deal.id, person_id: person.id }) });

    const docs = Array.isArray(lead.documents) ? lead.documents : [];
    const crDoc = docs.find((d) => /credit\s*report/i.test((d.label || "") + (d.name || ""))) || docs.find((d) => /credit/i.test((d.label || "") + (d.name || "")));
    let fileUploaded = false;
    if (crDoc && crDoc.path) {
      try {
        const { data: file } = await supabase.storage.from("reports").download(crDoc.path);
        if (file) {
          const buf = Buffer.from(await file.arrayBuffer());
          const { base, token } = pdConfig();
          const form = new FormData();
          form.append("file", new Blob([buf]), crDoc.name || "credit-report");
          form.append("deal_id", String(deal.id));
          form.append("person_id", String(person.id));
          const fr = await fetch(`${base}/files?api_token=${token}`, { method: "POST", body: form });
          fileUploaded = fr.ok;
          if (!fr.ok) console.log("[send-to-credit-repair] file upload failed", fr.status, await fr.text());
        }
      } catch (e) { console.log("[send-to-credit-repair] file error", e.message); }
    }

    if (fileUploaded) {
      try {
        await pd("/activities", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: "@@@ CREDIT REPORT ATTACHED, TASK TO PROCESSING @@@", type: "task", deal_id: deal.id, person_id: person.id, org_id: orgId || undefined, done: 0, note: "Credit report was sent over already attached from ASAP Funding. Ready for processing." }),
        });
      } catch (e) { console.log("[send-to-credit-repair] activity error", e.message); }
    }

    await supabase.from("leads").update({ status: "referred_cr", last_touch_at: new Date().toISOString() }).eq("id", leadId);
    await supabase.from("communications").insert({ lead_id: leadId, direction: "out", channel: "note", body: `Referred to Credit Repair (Pipedrive deal #${deal.id}).${fileUploaded ? " Credit report attached." : (crDoc ? " Credit report found but upload failed." : " No credit report on file to attach.")}`, by_user: "system" });

    return { statusCode: 200, body: JSON.stringify({ ok: true, dealId: deal.id, personId: person.id, fileUploaded, hadReport: !!crDoc }) };
  } catch (e) {
    console.log("[send-to-credit-repair]", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
