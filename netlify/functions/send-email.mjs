import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

// Only logged-in users of the app may send
async function requireUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const sb = createClient(process.env.SUPABASE_URL, key);
  const { data, error } = await sb.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed" });
  const user = await requireUser(event);
  if (!user) return resp(401, { error: "Not authorized" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return resp(400, { error: "Invalid JSON" }); }
  const { to, subject, text } = body;
  if (!to || !text) return resp(422, { error: "Missing recipient or message" });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return resp(500, { error: "Email is not configured yet. Set SENDGRID_API_KEY in Netlify." });

  const fromAddr = process.env.EMAIL_FROM;
  if (!fromAddr) return resp(500, { error: "Set EMAIL_FROM in Netlify to your verified SendGrid sender address." });
  const fromName = process.env.EMAIL_FROM_NAME || "";

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromAddr, name: fromName || undefined },
    subject: subject || "",
    content: [{ type: "text/plain", value: text }],
  };
  if (process.env.EMAIL_REPLY_TO) payload.reply_to = { email: process.env.EMAIL_REPLY_TO };

  try {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.status === 202) return resp(200, { ok: true });
    let detail = "";
    try { const j = await r.json(); detail = (j.errors && j.errors.map((e) => e.message).join("; ")) || JSON.stringify(j); } catch { detail = await r.text(); }
    return resp(500, { error: `SendGrid ${r.status}: ${detail}` });
  } catch (e) {
    return resp(500, { error: String(e.message || e) });
  }
};
