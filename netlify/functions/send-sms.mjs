import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

async function requireUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) { console.error("[sms] no auth token on request"); return null; }
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) { console.error("[sms] missing SUPABASE_URL or SUPABASE_ANON_KEY env"); return null; }
  const sb = createClient(process.env.SUPABASE_URL, key);
  const { data, error } = await sb.auth.getUser(token);
  if (error) { console.error("[sms] supabase getUser failed:", error.message); return null; }
  return data.user;
}

async function rcToken() {
  const server = process.env.RC_SERVER || "https://platform.ringcentral.com";
  const basic = Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: process.env.RC_JWT,
  });
  const r = await fetch(`${server}/restapi/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const j = await r.json();
  if (!j.access_token) {
    console.error("[sms] RC auth failed:", JSON.stringify(j));
    throw new Error(j.error_description || j.errors?.[0]?.message || j.message || "RingCentral auth failed");
  }
  console.log("[sms] RC auth ok");
  return { server, token: j.access_token };
}

function e164(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}

// Normalize outbound SMS to GSM-7-safe ASCII. One typographic character (curly
// apostrophe from a business name, smart quotes, ellipsis) silently flips the
// whole message to UCS-2, and a mislabeled hop renders it as CJK mojibake on the
// client's phone (the "Chinese text" incident). Keeping everything GSM-safe also
// keeps segments at 160 chars instead of 70.
function gsmSafe(s) {
  return String(s || "")
    .replace(/[\u2018\u2019\u201A\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n\r]/g, "");
}

const SEG = Number(process.env.SMS_SPLIT_AT || 140);
function splitForSms(text) {
  const t = String(text || "").trim();
  if (t.length <= SEG) return [t];
  const tokens = t.split(/(\s+)/);
  const parts = [];
  let cur = "";
  const flush = () => { const v = cur.trim(); if (v) parts.push(v); cur = ""; };
  for (const tok of tokens) {
    if (!tok) continue;
    const isSpace = /^\s+$/.test(tok);
    if (!isSpace && tok.length > SEG) { flush(); parts.push(tok); continue; }
    if ((cur + tok).trim().length > SEG) { flush(); if (isSpace) continue; }
    cur += tok;
  }
  flush();
  return parts;
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed" });

  console.log("[sms] env present:", {
    RC_CLIENT_ID: !!process.env.RC_CLIENT_ID,
    RC_CLIENT_SECRET: !!process.env.RC_CLIENT_SECRET,
    RC_JWT: !!process.env.RC_JWT,
    RC_FROM: process.env.RC_FROM || "(missing)",
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
  });

  const user = await requireUser(event);
  if (!user) return resp(401, { error: "Not authorized (login/session issue). Check SUPABASE_URL and SUPABASE_ANON_KEY in Netlify." });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return resp(400, { error: "Invalid JSON" }); }
  const to = e164(body.to);
  const text = gsmSafe(body.text);
  if (!to || !text) return resp(422, { error: "Missing recipient or message" });

  if (!process.env.RC_CLIENT_ID || !process.env.RC_JWT || !process.env.RC_FROM) {
    console.error("[sms] missing RingCentral env vars");
    return resp(500, { error: "SMS is not configured yet. Set RC_CLIENT_ID, RC_CLIENT_SECRET, RC_JWT, RC_FROM in Netlify." });
  }

  try {
    const { server, token } = await rcToken();
    const parts = splitForSms(text);
    if (parts.length > 1) console.log(`[sms] ${text.length} chars, sending as ${parts.length} messages`);
    const ids = [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await sleepMs(1500);
      const r = await fetch(`${server}/restapi/v1.0/account/~/extension/~/sms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: { phoneNumber: process.env.RC_FROM },
          to: [{ phoneNumber: to }],
          text: parts[i],
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        console.error(`[sms] RC send failed on part ${i + 1}/${parts.length}:`, r.status, JSON.stringify(j));
        if (ids.length) return resp(200, { ok: true, id: ids[0], parts: ids.length, partial: true });
        return resp(500, { error: j.message || j.errors?.[0]?.message || "SMS send failed" });
      }
      ids.push(j.id);
    }
    console.log("[sms] sent ok, ids:", ids.join(","), "to:", to);
    return resp(200, { ok: true, id: ids[0], parts: ids.length });
  } catch (e) {
    console.error("[sms] exception:", String(e.message || e));
    return resp(500, { error: String(e.message || e) });
  }
};
