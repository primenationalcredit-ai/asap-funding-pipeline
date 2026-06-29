import { createClient } from "@supabase/supabase-js";

/*
 * GHL -> ASAP Funding Pipeline webhook receiver.
 *
 * Handles GHL's payload shape where standard contact fields sit at the top
 * level and mapped fields sit inside customData. Reads both, prefers the
 * cleanest source per field. Opportunity/qualification fields are captured
 * when GHL sends them.
 */

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

// First non-empty value across a list of objects, trying each key in order
function pickFrom(objs, keys) {
  for (const o of objs) {
    if (!o) continue;
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function normalize(payload) {
  const top = payload || {};
  const cd = payload.customData || {};
  const con = payload.contact || {};

  let name = pickFrom([top, con, cd], ["full_name", "fullName", "name", "contact_name"]);
  if (!name) {
    const first = pickFrom([top, con, cd], ["first_name", "firstName"]);
    const last = pickFrom([top, con, cd], ["last_name", "lastName"]);
    name = [first, last].filter(Boolean).join(" ");
  }

  return {
    ghl_contact_id: pickFrom([top, cd, con], ["contact_id", "contactId", "id"]),
    name,
    // top level phone is E.164 (+1...), prefer it over the formatted customData copy
    phone: pickFrom([top, cd, con], ["phone", "phone_number", "phoneNumber"]),
    email: pickFrom([top, cd, con], ["email", "email_address", "emailAddress"]),
    source: pickFrom([top, cd], ["contact_source", "source", "lead_source", "leadSource", "utm_source"]),
    tags: pickFrom([top, cd], ["tags"]),
    // opportunity / qualification fields (from customData mapping)
    opportunity_name: pickFrom([cd, top], ["opportunity_name", "opportunityName"]),
    pipeline_stage: pickFrom([cd, top], ["pipeline_stage", "pipelineStage", "stage"]),
    desired_amount: pickFrom([cd, top], ["desired_amount", "desiredAmount"]),
    estimated_credit_score: pickFrom([cd, top], ["estimated_credit_score", "estimatedCreditScore", "credit_score"]),
    monthly_revenue: pickFrom([cd, top], ["monthly_revenue", "monthlyRevenue"]),
    time_in_business: pickFrom([cd, top], ["time_in_business", "timeInBusiness"]),
  };
}

const DATA_FIELDS = [
  "name", "phone", "email", "source", "tags", "opportunity_name", "pipeline_stage",
  "desired_amount", "estimated_credit_score", "monthly_revenue", "time_in_business",
];

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const secret = process.env.GHL_WEBHOOK_SECRET;
  const headerSecret = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
  const querySecret = event.queryStringParameters?.key;
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return json(401, { error: "Unauthorized" });
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON body" }); }

  const lead = normalize(payload);
  if (!lead.name && !lead.phone && !lead.email) {
    return json(422, { error: "Payload had no name, phone, or email", received: payload });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (lead.ghl_contact_id) {
      const { data: existing } = await supabase
        .from("leads").select("id").eq("ghl_contact_id", lead.ghl_contact_id).maybeSingle();

      if (existing) {
        // Re-send: enrich only. Only write fields that arrived non-empty, so a
        // later "completed" submission fills in blanks without wiping anything,
        // and an incomplete re-send never erases existing data. Never touches
        // status, touches, or link_sent_at, so the lead stays where you moved it.
        const enrich = { raw: payload };
        for (const f of DATA_FIELDS) if (lead[f]) enrich[f] = lead[f];
        const { error } = await supabase.from("leads").update(enrich).eq("id", existing.id);
        if (error) throw error;
        return json(200, { ok: true, action: "updated", id: existing.id });
      }
    }

    const row = { ...Object.fromEntries(DATA_FIELDS.map((f) => [f, lead[f]])) };
    row.ghl_contact_id = lead.ghl_contact_id || null;
    row.status = "new";
    row.touches = [];
    row.raw = payload;

    const { data, error } = await supabase.from("leads").insert(row).select().single();
    if (error) throw error;
    return json(200, { ok: true, action: "inserted", id: data.id });
  } catch (err) {
    return json(500, { error: "Database write failed", detail: String(err.message || err) });
  }
};
