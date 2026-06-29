import { createClient } from "@supabase/supabase-js";

/*
 * GHL -> ASAP Funding Pipeline webhook receiver.
 *
 * GHL Workflow setup:
 *   Trigger: Contact Created (or a tag like "funding lead")
 *   Action:  Webhook
 *     Method: POST
 *     URL:    https://YOUR-SITE.netlify.app/api/ghl-webhook?key=YOUR_SECRET
 *             (or add header  x-webhook-secret: YOUR_SECRET )
 *     Body:   leave as the default contact payload, or map your own fields.
 */

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

// Pick the first non-empty value among several possible key names
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

// GHL payloads vary by event/version; normalize the common shapes.
function normalize(payload) {
  // Some GHL events nest the contact under `contact` or `customData`
  const c = payload.contact || payload.customData || payload;

  let name = pick(c, ["full_name", "fullName", "name", "contact_name", "contactName"]);
  if (!name) {
    const first = pick(c, ["first_name", "firstName"]);
    const last = pick(c, ["last_name", "lastName"]);
    name = [first, last].filter(Boolean).join(" ");
  }

  return {
    ghl_contact_id: pick(c, ["contact_id", "contactId", "id"]),
    name,
    phone: pick(c, ["phone", "phone_number", "phoneNumber"]),
    email: pick(c, ["email", "email_address", "emailAddress"]),
    source: pick(c, ["source", "lead_source", "leadSource", "utm_source"]),
    notes: pick(c, ["notes", "message", "comments", "tags"]),
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // ---- auth: shared secret via header OR ?key= query param ----
  const secret = process.env.GHL_WEBHOOK_SECRET;
  const headerSecret = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
  const querySecret = event.queryStringParameters?.key;
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return json(401, { error: "Unauthorized" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const lead = normalize(payload);
  if (!lead.name && !lead.phone && !lead.email) {
    return json(422, { error: "Payload had no name, phone, or email", received: payload });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const row = {
    ...lead,
    status: "new",
    touches: [],
    raw: payload,
  };

  try {
    if (lead.ghl_contact_id) {
      // Upsert on the GHL id so re-sends update instead of duplicating.
      // ignoreDuplicates keeps an existing lead's status/touches intact.
      const { data, error } = await supabase
        .from("leads")
        .upsert(row, { onConflict: "ghl_contact_id", ignoreDuplicates: true })
        .select();
      if (error) throw error;
      return json(200, { ok: true, action: data?.length ? "inserted" : "skipped_existing", id: data?.[0]?.id });
    } else {
      const { data, error } = await supabase.from("leads").insert(row).select();
      if (error) throw error;
      return json(200, { ok: true, action: "inserted", id: data?.[0]?.id });
    }
  } catch (err) {
    return json(500, { error: "Database write failed", detail: String(err.message || err) });
  }
};
