import { createClient } from "@supabase/supabase-js";

const emailOf = (s) => {
  const m = String(s || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : "";
};

function parseMultipart(buf, boundary) {
  const fields = {};
  const files = [];
  const delim = Buffer.from("--" + boundary);
  const parts = [];
  let idx = buf.indexOf(delim, 0);
  while (idx !== -1) {
    const next = buf.indexOf(delim, idx + delim.length);
    if (next === -1) break;
    const partStart = idx + delim.length + 2;
    const partEnd = next - 2;
    if (partEnd > partStart) parts.push(buf.slice(partStart, partEnd));
    idx = next;
  }
  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString("utf8");
    const content = part.slice(headerEnd + 4);
    const nameM = headers.match(/name="([^"]*)"/i);
    if (!nameM) continue;
    const fileM = headers.match(/filename="([^"]*)"/i);
    const ctypeM = headers.match(/Content-Type:\s*([^\r\n;]+)/i);
    if (fileM && fileM[1]) {
      files.push({ filename: fileM[1], contentType: ctypeM ? ctypeM[1].trim() : "application/octet-stream", data: content });
    } else {
      fields[nameM[1]] = content.toString("utf8");
    }
  }
  return { fields, files };
}

function topReply(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && out.length) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim() || text.trim();
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const ctype = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const buf = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body || "", "utf8");
    let fields = {}, files = [];
    const bMatch = ctype.match(/boundary=([^;]+)/);
    if (bMatch) ({ fields, files } = parseMultipart(buf, bMatch[1].trim().replace(/^"|"$/g, "")));
    else fields = Object.fromEntries(new URLSearchParams(buf.toString("utf8")));

    const fromEmail = emailOf(fields.from);
    const subject = (fields.subject || "").trim();
    const body = topReply(fields.text || fields.html || "");
    if (!fromEmail) return { statusCode: 200, body: "no from" };

    const { data: leads } = await supabase.from("leads").select("id,email").not("email", "is", null).limit(5000);
    const lead = (leads || []).find((l) => (l.email || "").toLowerCase() === fromEmail);
    if (!lead) { console.log("[inbound-email] no lead match for", fromEmail); return { statusCode: 200, body: "no lead" }; }
    console.log("[inbound-email] attachment capture matched", lead.id, "files:", files.length);

    const atts = [];
    for (const f of files) {
      if (!f.data || !f.data.length) continue;
      const safe = (f.filename || "file").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 120);
      const path = `${lead.id}/email-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, f.data, { contentType: f.contentType, upsert: true });
      if (upErr) { console.log("[inbound-email] upload failed", f.filename, upErr.message); continue; }
      atts.push({ name: f.filename, path, type: f.contentType });
    }

    await supabase.from("communications").insert({
      lead_id: lead.id, direction: "in", channel: "email",
      subject: subject || null, body, from_addr: fromEmail, by_user: "client", attachments: atts,
    });
    await supabase.from("leads").update({ last_touch_at: new Date().toISOString() }).eq("id", lead.id);
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.log("[inbound-email] error", e.message);
    return { statusCode: 200, body: "err" };
  }
};
