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

    // Map PhoneBurner disposition buttons -> CRM stage. Names come from the
    // account's Starter Dialing Set + Starter Live Answer Set. Matching is
    // lowercase/loose so minor renames still land.
    const d = disposition.toLowerCase();
    let newStatus = null;      // stage to move to, null = leave stage alone
    let optOut = false;        // Do Not Call flips the lead to opted out
    // Explicit entries for the ASAP Live Answer Set call statuses. These are
    // matched FIRST because some overlap the looser patterns below (for example
    // "Sent Application" must not be caught by the appointment rule).
    // DO NOT CALL IS CHECKED FIRST, DELIBERATELY. It is the only outcome with a
    // legal consequence, and it used to be checked LAST — so a button named
    // anything like "Not Interested - DNC" matched "not interested" first and
    // the opt-out flag was never set. When a client asks not to be contacted
    // that must win over every other pattern, whatever the button is called.
    const DNC = /do ?not ?(call|contact|text)|\bdnc\b|opt(ed)? ?out|opting out|remove me|take me off|stop calling|stop contact|unsubscribe|asked to stop/;
    // Calls with no conversation. These LOG ONLY and never move the stage, so a
    // dropped or unanswered call cannot push a client into a wrong stage.
    const NO_CONTACT = /no answer|hung ?up|no conversation|did ?n[o']?t (answer|connect)|busy|unavailable|disconnected|abandoned|dropped/;

    if (DNC.test(d)) { newStatus = "dead"; optOut = true; }
    else if (NO_CONTACT.test(d) && !/voicemail|lvm|left message/.test(d)) { newStatus = null; }
    else if (/docs? received/.test(d)) newStatus = "app_reports_received";        // no ampersand survives PB, mapped by hand
    else if (/sent reports?|reports? sent/.test(d)) newStatus = "waiting_reports";
    else if (/sent application|app(lication)? sent/.test(d)) newStatus = "app_sent";
    else if (/check back/.test(d)) newStatus = "check_back";
    else if (/appt booked|set appointment|appointment|booked/.test(d)) newStatus = "appointment_booked";
    else if (/voicemail|left message|lvm/.test(d)) newStatus = "voicemail";
    else if (/not interested/.test(d)) newStatus = "not_interested";
    else if (/call ?back|follow ?up/.test(d)) newStatus = "callback";
    else if (/wrong number|bad (number|phone)/.test(d)) newStatus = "wrong_number";
    // "No Answer", "Busy Signal", "Unavailable" deliberately do NOT move the
    // stage — they just log the attempt, same as the CRM's own call buttons.

    const pieces = [];
    if (disposition) pieces.push(`Disposition: ${disposition}`);
    if (duration) pieces.push(`Duration: ${duration}s`);
    if (notes) pieces.push(notes);
    const body = pieces.join(" | ") || "Power-dial call completed";

    // Also record a CALL touch on the lead. Without this a dialer call is
    // invisible to anything reading lead.touches — including the Power Dial
    // "skip anyone called recently" filter, which would keep handing the rep
    // people she just called.
    try {
      const { error: tErr } = await admin.rpc("append_touch", {
        p_lead_id: leadId,
        p_touch: { at: Date.now(), channel: "call", kind: "call", disposition: disposition || "", note: notes || "", by: agent, source: "phoneburner" },
      });
      if (tErr) console.log("[pb-calldone] append_touch failed:", tErr.message);
    } catch (e) { console.log("[pb-calldone] touch error", e.message); }

    const { error: cErr } = await admin.from("communications").insert({
      lead_id: leadId, direction: "out", channel: "call", body, by_user: agent,
    });
    if (cErr) console.log("[pb-calldone] comms insert failed:", cErr.message);

    // Push the next automated follow-up out 3 days, same as a manual call log,
    // so the cadence doesn't text someone Lydia just spoke with.
    try {
      const patch = { snooze_until: new Date(Date.now() + 3 * 86400000).toISOString() };
      // Only ever move leads that are still in the outreach part of the funnel —
      // never yank someone who is already submitted/funded back to an early stage.
      // Stages a dialer disposition is allowed to move a lead OUT of. Deliberately
      // excludes the deep funding stages (submitted, approved, funded...) so a
      // stray click can never yank a live deal back to the top of the pipeline.
      const OUTREACH = ["new", "appointment_booked", "voicemail", "waiting_reports", "app_sent", "wrong_number",
        "callback", "check_back", "not_interested", "pending_scheduling", "scheduled",
        "report_pulled", "sent_to_giggle", "app_received", "app_reports_received", ""];
      if (newStatus) {
        const { data: cur } = await admin.from("leads").select("status").eq("id", leadId).maybeSingle();
        const st = (cur && cur.status) || "";
        if (OUTREACH.includes(st)) { patch.status = newStatus; patch.stage_entered_at = new Date().toISOString(); }
        else console.log("[pb-calldone] lead in", st, "- logging call, not moving stage");
      }
      if (optOut) patch.opted_out = true;
      const { error: uErr } = await admin.from("leads").update(patch).eq("id", leadId);
      if (uErr) console.log("[pb-calldone] lead update failed:", uErr.message);
    } catch (e) { console.log("[pb-calldone] lead update error", e.message); }

    console.log("[pb-calldone] logged", JSON.stringify({ leadId, disposition, newStatus, optOut, agent }));
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.log("[pb-calldone] error", e.message);
    return { statusCode: 200, body: "ok (error logged)" }; // always 200 so PB doesn't retry-spam
  }
};
