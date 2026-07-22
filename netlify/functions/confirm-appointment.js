import { createClient } from "@supabase/supabase-js";

/*
 * Client clicks the "confirm" link in the hour-before email.
 * Marks the appointment confirmed and shows a simple thank-you page.
 * Also supports ?d=1 to decline / ask for a different time.
 */

function page(title, message, ok = true) {
  const accent = ok ? "#059669" : "#b45309";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;">
<div style="max-width:520px;margin:12vh auto;padding:32px;background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center;">
<div style="font-size:44px;line-height:1;color:${accent};">${ok ? "&#10003;" : "!"}</div>
<h1 style="margin:16px 0 8px;font-size:22px;color:#0f172a;">${title}</h1>
<p style="margin:0;color:#475569;font-size:15px;line-height:1.5;">${message}</p>
<p style="margin-top:24px;color:#94a3b8;font-size:13px;">ASAP Funding USA</p>
</div></body></html>`;
}

function html(body, code = 200) {
  return { statusCode: code, headers: { "Content-Type": "text/html; charset=utf-8" }, body };
}

export const handler = async (event) => {
  const token = event.queryStringParameters?.t || "";
  const decline = event.queryStringParameters?.d === "1";
  if (!token) return html(page("Link not valid", "This confirmation link is missing information. Please reply to the email instead.", false), 400);

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: appt } = await supabase
      .from("activities").select("*").eq("confirm_token", token).maybeSingle();

    if (!appt) return html(page("Link not found", "We could not find that appointment. Please reply to the email and we will sort it out.", false), 404);

    if (appt.confirm_state === "confirmed" && !decline) {
      return html(page("Already confirmed", "You are all set. We will talk soon."));
    }

    await supabase.from("activities").update({
      confirm_state: decline ? "declined" : "confirmed",
      confirmed_at: new Date().toISOString(),
    }).eq("id", appt.id);

    // Let the team know right away
    try {
      await supabase.from("activities").insert({
        lead_id: appt.lead_id || null,
        type: "call",
        title: decline ? `Client needs to reschedule: ${appt.title || "appointment"}` : `Confirmed: ${appt.title || "appointment"}`,
        alarm: false,
        due_at: new Date().toISOString(),
        created_by: "automation",
        assigned_to: appt.assigned_to || "all",
      });
    } catch (e) { console.log("[confirm] notice fail", e.message); }

    return html(decline
      ? page("Thanks for letting us know", "We will reach out shortly to find a better time.", false)
      : page("You are confirmed", "Thanks. We have you down and will call at the scheduled time."));
  } catch (e) {
    console.error("[confirm-appointment]", e.message || e);
    return html(page("Something went wrong", "Please reply to the email and we will confirm you manually.", false), 500);
  }
};
