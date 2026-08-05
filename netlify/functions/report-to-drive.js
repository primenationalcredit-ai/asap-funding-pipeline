// netlify/functions/report-to-drive.js  (ES module)
// Copies a credit report from Supabase Storage into a Google Drive folder,
// one subfolder per client. ONLY called for credit reports.
//
// The Google service-account credentials live in a Supabase table (app_secrets),
// NOT in Netlify env vars — this keeps them out of the 4KB Lambda env limit.
// Only two small env vars are needed: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// (both already present for every function), plus REPORT_DRIVE_SECRET.
//
// One-time setup SQL (run in Supabase):
//   create table if not exists app_secrets (key text primary key, value text);
//   insert into app_secrets (key, value) values
//     ('google_sa_email', 'funding@complete-silo-504612-k0.iam.gserviceaccount.com'),
//     ('google_sa_private_key', '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'),
//     ('drive_root_folder_id', 'YOUR_FOLDER_ID');
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function loadSecrets(supabase) {
  const { data, error } = await supabase.from("app_secrets").select("key, value")
    .in("key", ["google_sa_email", "google_sa_private_key", "drive_root_folder_id"]);
  if (error) throw new Error("could not load secrets: " + error.message);
  const map = {};
  for (const row of data || []) map[row.key] = row.value;
  if (!map.google_sa_email || !map.google_sa_private_key || !map.drive_root_folder_id) {
    throw new Error("missing google secrets in app_secrets table");
  }
  return map;
}

async function getAccessToken(email, privateKey) {
  const key = String(privateKey || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(key));
  const jwt = `${header}.${claim}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("google auth failed: " + JSON.stringify(j));
  return j.access_token;
}

async function ensureClientFolder(token, root, name) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if (found.files && found.files.length) return found.files[0].id;
  const made = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [root] }),
  }).then((r) => r.json());
  return made.id;
}

async function uploadToDrive(token, folderId, filename, bytes, contentType) {
  const boundary = "asapboundary" + Date.now();
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${contentType || "application/octet-stream"}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre), Buffer.from(bytes), Buffer.from(post)]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const j = await res.json();
  if (!j.id) throw new Error("drive upload failed: " + JSON.stringify(j));
  return j;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
    const body = JSON.parse(event.body || "{}");
    if (process.env.REPORT_DRIVE_SECRET && body.secret !== process.env.REPORT_DRIVE_SECRET) {
      return { statusCode: 401, body: "unauthorized" };
    }
    const { leadId, storagePath, clientName, fileName } = body;
    if (!storagePath) return { statusCode: 400, body: "storagePath required" };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const secrets = await loadSecrets(supabase);

    const { data: file, error } = await supabase.storage.from("reports").download(storagePath);
    if (error || !file) return { statusCode: 404, body: "file not found in storage" };
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/pdf";

    const token = await getAccessToken(secrets.google_sa_email, secrets.google_sa_private_key);
    const folderName = (clientName || leadId || "Unknown").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").trim() || "Unknown";
    const folderId = await ensureClientFolder(token, secrets.drive_root_folder_id, folderName);
    const name = fileName || storagePath.split("/").pop();
    const up = await uploadToDrive(token, folderId, name, bytes, contentType);

    console.log("[report-to-drive] ok", JSON.stringify({ leadId, folder: folderName, file: up.name, id: up.id }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, driveFileId: up.id, link: up.webViewLink }) };
  } catch (e) {
    console.log("[report-to-drive] error", e.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
