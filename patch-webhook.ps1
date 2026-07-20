$f = ".\netlify\functions\ghl-webhook.js"
$c = Get-Content $f -Raw

$c = $c.Replace(
'source: pickFrom([top, cd], ["contact_source", "source", "lead_source", "leadSource", "utm_source"]),',
'source: normalizeSource(pickFrom([top, cd], ["contact_source", "source", "lead_source", "leadSource", "opportunity_source", "opportunitySource", "utm_source", "attributionSource"])),')

$fn = @'
function normalizeSource(s) {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "Unknown";
  if (v.includes("google") || v.includes("gclid") || v.includes("adwords")) return "Google";
  if (v.includes("facebook") || v.includes("fb") || v.includes("meta") || v.includes("instagram")) return "Facebook";
  if (v.includes("direct")) return "Direct";
  if (v.includes("referr")) return "Referral";
  if (v.includes("organic") || v.includes("website")) return "Website";
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickFrom(objs, keys) {
'@

$c = $c.Replace("function pickFrom(objs, keys) {", $fn)

Set-Content $f $c -Encoding utf8
Write-Host "Patched. Checks:"
Write-Host "  normalizeSource present:" (Select-String -Path $f -Pattern "function normalizeSource" -SimpleMatch -Quiet)
Write-Host "  source line updated:" (Select-String -Path $f -Pattern "opportunity_source" -SimpleMatch -Quiet)
