$f = ".\netlify\functions\ghl-webhook.js"
$c = Get-Content $f -Raw

$helpersOld = 'async function sendSms(rc, to, text) {'

$helpersNew = @'
async function createRcTask(rc, subject, note) {
  const chatId = process.env.RC_TASK_CHAT_ID;
  if (!chatId) return; // not configured, skip quietly
  const body = { subject: subject.slice(0, 250) };
  if (process.env.RC_TASK_ASSIGNEE_ID) body.assignees = [{ id: process.env.RC_TASK_ASSIGNEE_ID }];
  if (note) body.description = note.slice(0, 1000);
  const r = await fetch(`${rc.server}/team-messaging/v1/chats/${chatId}/tasks`, {
    method: "POST", headers: { Authorization: `Bearer ${rc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `RC task failed ${r.status}`); }
}

async function newLeadAlarm(supabase, leadRow, leadId) {
  const assignee = process.env.NEW_LEAD_ALARM_TO || "all";
  const who = leadRow.name || leadRow.business_name || "New lead";
  await supabase.from("activities").insert({
    lead_id: leadId,
    type: "call",
    title: `New lead: ${who} — reach out`,
    notes: "[[alarm]]",
    due_at: new Date().toISOString(),
    created_by: "automation",
    assigned_to: assignee,
  });
}

async function sendSms(rc, to, text) {
'@

$c = $c.Replace($helpersOld, $helpersNew)

$anchor = 'try { await sendInstantWelcome(supabase, row, data.id); } catch (e) { console.log("[welcome] error", e.message); }'

$addition = @'
try { await sendInstantWelcome(supabase, row, data.id); } catch (e) { console.log("[welcome] error", e.message); }
    try { await newLeadAlarm(supabase, row, data.id); } catch (e) { console.log("[new-lead-alarm] error", e.message); }
    try {
      const rc = await rcToken();
      const parts = [row.phone ? `Phone: ${row.phone}` : "", row.email ? `Email: ${row.email}` : "", row.source ? `Source: ${row.source}` : "", row.desired_amount ? `Wants: ${row.desired_amount}` : ""].filter(Boolean);
      await createRcTask(rc, `New lead: ${row.name || row.business_name || "Unknown"}`, parts.join("\n") + "\n\nWork it in the portal: https://tranquil-muffin-691d4e.netlify.app");
    } catch (e) { console.log("[rc-task] error", e.message); }
'@

$c = $c.Replace($anchor, $addition)

Set-Content $f $c -Encoding utf8
Write-Host "Patched. Checks:"
Write-Host "  createRcTask present:" (Select-String -Path $f -Pattern "async function createRcTask" -SimpleMatch -Quiet)
Write-Host "  newLeadAlarm present:" (Select-String -Path $f -Pattern "async function newLeadAlarm" -SimpleMatch -Quiet)
Write-Host "  alarm fired on new lead:" (Select-String -Path $f -Pattern "await newLeadAlarm(supabase, row, data.id)" -SimpleMatch -Quiet)
Write-Host "  RC task fired on new lead:" (Select-String -Path $f -Pattern "await createRcTask(rc," -SimpleMatch -Quiet)
