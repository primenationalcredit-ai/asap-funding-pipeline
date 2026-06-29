import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

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

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return resp(500, { error: "Email is not configured yet. Set SMTP_HOST, SMTP_USER, SMTP_PASS in Netlify." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const fromName = process.env.EMAIL_FROM_NAME || "";
  const fromAddr = process.env.EMAIL_FROM || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: fromName ? `${fromName} <${fromAddr}>` : fromAddr,
      to,
      subject: subject || "",
      text,
    });
    return resp(200, { ok: true, id: info.messageId });
  } catch (e) {
    return resp(500, { error: String(e.message || e) });
  }
};
