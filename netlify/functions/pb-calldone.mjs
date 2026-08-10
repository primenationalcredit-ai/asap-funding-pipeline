// netlify/functions/pb-calldone.mjs
// PhoneBurner calls this after every completed call (disposition selected).
// We log the call + disposition + notes to the lead's timeline and nudge the
// cadence out 3 days, same as a manually logged call. We deliberately do NOT
// auto-move stages yet: PhoneBurner dispositions are account-defined, so we
// log their names first and wire stage moves once we see the real labels.
import { createClient } from "@supabase/supabase-js";

function parseBody(event) {
  const raw = event.body || "";
  const ct = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
  if (ct.includes("json")) { try { return JSON.parse(raw); } catch { return {}; } }
  // PhoneBurner may send form-encoded
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

// pull a value from a possibly-nested payload by trying several key paths
function pick(obj, paths) {
  for (const p of paths) {
    let cur = obj;
    for (const part of p.split(".")) { cur = cur?.[part]; if (cur == null) break; }
    if (cur != null && String(cur).trim() !== "") return String(cur).trim();
  }
  return "";
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
    const key = (event.queryStringParameters || {}).key || "";
    if (key !== (process.env.PB_CALLBACK_KEY || "pbk")) return { statusCode: 401, body: "bad key" };

    const p = parseBody(event);
    // Log the raw payload once so we can see PhoneBurner's exact field names
    console.log("[pb-calldone] payload", JSON.stringify(p).slice(0, 1500));

    const leadId = pick(p, ["lead_id", "contact.lead_id", "contact.leadId", "leadId"]);
    const disposition = pick(p, ["disposition", "category", "category_name", "call.disposition", "result"]);
    const notes = pick(p, ["notes", "call_notes", "call.notes", "comment"]);
    const duration = pick(p, ["duration", "call_duration", "call.duration", "call_length"]);
    const agent = pick(p, ["member_email", "user_email", "agent", "member.email"]) || "phoneburner";

    if (!leadId) { console.log("[pb-calldone] no lead_id in payload, skipping"); return { statusCode: 200, body: "ok (no lead_id)" }; }

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const pieces = [];
    if (disposition) pieces.push(`Disposition: ${disposition}`);
    if (duration) pieces.push(`Duration: ${duration}s`);
    if (notes) pieces.push(notes);
    const body = pieces.join(" | ") || "Power-dial call completed";

    const { error: cErr } = await admin.from("communications").insert({
      lead_id: leadId, direction: "out", channel: "call", body, by_user: agent,
    });
    if (cErr) console.log("[pb-calldone] comms insert failed:", cErr.message);

    // Push the next automated follow-up out 3 days, same as a manual call log,
    // so the cadence doesn't text someone Lydia just spoke with.
    try {
      const { error: uErr } = await admin.from("leads")
        .update({ snooze_until: new Date(Date.now() + 3 * 86400000).toISOString() })
        .eq("id", leadId);
      if (uErr) console.log("[pb-calldone] snooze update failed:", uErr.message);
    } catch (e) { console.log("[pb-calldone] snooze error", e.message); }

    console.log("[pb-calldone] logged", JSON.stringify({ leadId, disposition, agent }));
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.log("[pb-calldone] error", e.message);
    return { statusCode: 200, body: "ok (error logged)" }; // always 200 so PB doesn't retry-spam
  }
};
