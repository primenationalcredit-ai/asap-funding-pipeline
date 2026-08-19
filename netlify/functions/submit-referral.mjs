// netlify/functions/submit-referral.mjs
// Public referral intake. A partner sends prospects to
//   /refer.html?ref=<their-code>
// and whatever they submit lands as a lead tagged to that partner, so the
// credit is recorded at the moment the lead arrives rather than reconstructed
// from memory later.
import { createClient } from "@supabase/supabase-js";

const resp = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(obj),
});

const fmtPhone = (v) => {
  const d = String(v || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(v || "").trim();
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return resp(405, { error: "POST only" });

  try {
    const b = JSON.parse(event.body || "{}");
    const name = String(b.name || "").trim();
    const phone = fmtPhone(b.phone);
    const email = String(b.email || "").trim().toLowerCase();
    const business = String(b.business || "").trim();
    const notes = String(b.notes || "").trim();
    const ref = String(b.ref || "").trim().toLowerCase();

    if (!name) return resp(422, { error: "Please enter the client's name." });
    if (!phone && !email) return resp(422, { error: "Please enter a phone number or an email address." });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Look the partner up by their code so the lead carries a real name, not a slug.
    let partnerName = "", partnerCode = ref;
    if (ref) {
      const { data: p } = await supabase.from("referral_partners").select("code, name, default_fee").eq("code", ref).maybeSingle();
      if (p) { partnerName = p.name || ""; partnerCode = p.code; }
    }
    if (!partnerName && ref) partnerName = ref.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Don't create a second record for someone already in the pipeline.
    let existing = null;
    if (email) {
      const { data } = await supabase.from("leads").select("id, name").ilike("email", email).limit(1);
      if (data && data.length) existing = data[0];
    }
    if (!existing && phone) {
      const { data } = await supabase.from("leads").select("id, name").eq("phone", phone).limit(1);
      if (data && data.length) existing = data[0];
    }
    if (existing) {
      console.log("[referral] duplicate, not recreating:", JSON.stringify({ existing: existing.id, ref: partnerCode }));
      return resp(200, { ok: true, duplicate: true, message: "Thanks. We already have this client on file and will be in touch." });
    }

    const row = {
      name, phone, email, business_name: business,
      status: "new",
      source: partnerName ? `Referral (${partnerName})` : "Referral",
      referred_by: partnerCode || null,
      referred_by_name: partnerName || null,
      referred_at: new Date().toISOString(),
      notes: notes || null,
      // Every text column with a NOT NULL constraint has to be present.
      estimated_credit_score: "", monthly_revenue: "", funding_timeline: "",
      touches: [],
    };

    const { data: made, error } = await supabase.from("leads").insert(row).select("id").single();
    if (error) {
      console.log("[referral] insert failed:", error.message, JSON.stringify(row).slice(0, 400));
      return resp(500, { error: "Could not save that referral. Please try again." });
    }

    console.log("[referral] created", JSON.stringify({ lead: made.id, partner: partnerCode || "(none)", name }));
    return resp(200, { ok: true, id: made.id, message: "Thanks. We have got their details and will reach out shortly." });
  } catch (e) {
    console.log("[referral] error", e.message);
    return resp(500, { error: e.message });
  }
};
