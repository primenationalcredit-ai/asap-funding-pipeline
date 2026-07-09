import { createClient } from "@supabase/supabase-js";

/*
 * One-time helper: tells RingCentral to start pushing inbound SMS
 * notifications to /rc-inbound-sms. Call it once after deploying.
 *
 *   POST /api/rc-subscribe        -> create the subscription
 *   GET  /api/rc-subscribe        -> list existing subscriptions
 *
 * Requires an app login (same auth as the send functions).
 */

const resp = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

async function requireUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const sb = createClient(process.env.SUPABASE_URL, key);
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
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
  if (!j.access_token) throw new Error(j.error_description || j.message || "RingCentral auth failed");
  return { server, token: j.access_token };
}

export const handler = async (event) => {
  const user = await requireUser(event);
  if (!user) return resp(401, { error: "Not authorized" });

  const base = process.env.PUBLIC_URL || `https://${event.headers.host}`;
  const secret = process.env.RC_WEBHOOK_SECRET || "";
  const deliveryUrl = `${base}/.netlify/functions/rc-inbound-sms${secret ? `?key=${encodeURIComponent(secret)}` : ""}`;

  try {
    const { server, token } = await rcToken();

    if (event.httpMethod === "GET") {
      const r = await fetch(`${server}/restapi/v1.0/subscription`, { headers: { Authorization: `Bearer ${token}` } });
      return resp(200, { deliveryUrl, subscriptions: await r.json() });
    }

    // Remove any existing subscriptions pointing at our inbound URL, so we
    // do not stack the old bare-ping subscription with the new instant one.
    try {
      const listR = await fetch(`${server}/restapi/v1.0/subscription`, { headers: { Authorization: `Bearer ${token}` } });
      const listJ = await listR.json();
      for (const s of listJ.records || []) {
        if (s.deliveryMode?.address === deliveryUrl) {
          await fetch(`${server}/restapi/v1.0/subscription/${s.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          console.log("[rc-subscribe] removed old subscription", s.id);
        }
      }
    } catch (e) { console.log("[rc-subscribe] cleanup skipped:", e.message); }

    const ext = process.env.RC_SMS_EXTENSION_ID || "~";
    const r = await fetch(`${server}/restapi/v1.0/subscription`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // "instant" delivers the full message record (from, text, direction),
        // unlike the plain message-store event which only signals a change.
        eventFilters: [`/restapi/v1.0/account/~/extension/${ext}/message-store/instant?type=SMS`],
        deliveryMode: { transportType: "WebHook", address: deliveryUrl },
        expiresIn: 630720000,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error("[rc-subscribe] failed:", r.status, JSON.stringify(j));
      return resp(500, { error: j.message || j.errors?.[0]?.message || `Subscribe failed (${r.status})`, deliveryUrl });
    }
    console.log("[rc-subscribe] created", j.id, "->", deliveryUrl);
    return resp(200, { ok: true, id: j.id, status: j.status, deliveryUrl });
  } catch (e) {
    return resp(500, { error: String(e.message || e), deliveryUrl });
  }
};
