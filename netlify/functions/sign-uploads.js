import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { files } = JSON.parse(event.body || "{}");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const uploads = [];
    for (const f of (files || [])) {
      const clean = (f.name || "document").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
      const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${clean}`;
      const { data, error } = await supabase.storage.from("reports").createSignedUploadUrl(path);
      if (error) throw error;
      uploads.push({ name: f.name, label: f.label || "Other", path, token: data.token });
    }
    return { statusCode: 200, body: JSON.stringify({ uploads, base: process.env.SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY }) };
  } catch (e) {
    console.log("[sign-uploads] error", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
