# ASAP Funding Pipeline

Your own lead hub. Leads flow in from GoHighLevel by webhook, land in Supabase,
and show up live in the app. You call, text or email the MyScoreIQ link in one
tap, and the follow-up cadence tells you who to chase each day.

```
GoHighLevel  --webhook-->  Netlify function  -->  Supabase  -->  this app
```

---

## 1. Create the Supabase project

1. Go to supabase.com, create a new project. Save the database password.
2. Open SQL Editor, New query, paste all of `supabase/schema.sql`, Run.
3. Project Settings -> API. Copy these three values:
   - Project URL (e.g. https://abcd1234.supabase.co)
   - `anon` public key
   - `service_role` key (keep this secret, it bypasses RLS)

## 2. Set environment variables (Netlify -> Site settings -> Environment variables)

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |
| `SUPABASE_URL` | your Project URL (same value, no VITE prefix) |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
| `GHL_WEBHOOK_SECRET` | any long random string you make up |

For local dev, copy `.env.example` to `.env` and fill the same values.

## 3. Deploy (PowerShell, from the project folder)

```powershell
npm install
git init
git add .
git commit -m "ASAP Funding Pipeline initial build"
git branch -M main
git remote add origin https://github.com/primenationalcredit-ai/asap-funding-pipeline.git
git push -u origin main
```

Then in Netlify: Add new site -> Import from GitHub -> pick the repo. Build
settings come from `netlify.toml` automatically. After it deploys, note your
site URL, for example `https://asap-funding-pipeline.netlify.app`.

For later deploys (no force push):

```powershell
git add .
git commit -m "your message"
git push origin main
```

## 4. Wire up the GoHighLevel webhook

In GHL: Automation -> Workflows -> create or open a workflow.

1. **Trigger:** Contact Created, or Contact Tag added (e.g. tag `funding lead`).
   Use a tag if you only want some contacts pushed here.
2. **Action:** add a **Webhook** action.
   - Method: `POST`
   - URL: `https://YOUR-SITE.netlify.app/api/ghl-webhook?key=YOUR_GHL_WEBHOOK_SECRET`
     (replace both placeholders; the `key` must match `GHL_WEBHOOK_SECRET`)
   - Optionally instead of the `?key=` param, add a custom header
     `x-webhook-secret` with the same secret.
   - Body: leave GHL's default contact payload. The function reads name, phone,
     email, source and the GHL contact id automatically.
3. Save and publish. Add a test contact, watch it appear in the app within a
   second or two (the header shows a small live indicator when connected).

The function dedupes on the GHL contact id, so re-sends will not create
duplicate leads.

---

## Notes on security

This is an internal tool with no login. RLS is on but the policies allow the
anon key full access, so anyone with the site URL and the anon key can read and
write leads. Keep the URL private. When you want to lock it down, add Supabase
Auth and replace the `*_anon_all` policies in `schema.sql` with
authenticated-only versions.

The `service_role` key lives only in the Netlify function environment. Never put
it in any `VITE_` variable or in frontend code.

## What sends the messages

Texts and emails open in your own phone and mail app (prefilled from the
templates in Settings), so they come from your real number and address. That is
best for a sales conversation and for deliverability. If you later want the
follow-up cadence to fire on its own with no taps, that is a SendGrid (email)
and RingCentral (SMS) add-on to the same Netlify functions, say the word.

## Editing day to day

Everything that changes copy (the MyScoreIQ link, signature, all email and SMS
templates, first touch and follow-up) lives in the **Settings** tab, saved to
Supabase. No code change needed.
