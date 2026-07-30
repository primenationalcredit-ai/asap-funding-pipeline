import sys
f = 'netlify/functions/grad-announce.js'
s = open(f, encoding='utf-8').read()

a1 = 'const FUNNEL = "https://asapfundingusa.com/";'
n1 = a1 + """
// Person CURRENT STATUS values: round 3/4 completed stages + everyone in Additional Rounds
const ROUND_STATUSES = ['716','717','718','719','724','725','726','727','1901','1267','1264','1491','1492','1568','1268','1601','1265','1493','1494','1800','1797','1798','1799','1495','1801'];"""
if s.count(a1) != 1: print(f"ABORTED: funnel x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, n1, 1)

a2 = """async function pdGet(path) {
  const r = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1${path}${path.includes("?") ? "&" : "?"}api_token=${PD_TOKEN}`);
  const j = await r.json().catch(() => null);
  return j && j.data;
}"""
n2 = a2 + """
async function pdPost(path, body) {
  const r = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1${path}?api_token=${PD_TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return j && j.data;
}"""
if s.count(a2) != 1: print(f"ABORTED: pdGet x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, n2, 1)

a3 = 'const emailSubject = "Now that your services are wrapped up...";'
n3 = """const emailSubjectActive = "Something new for you at ASAP";
const emailCopyActive = (f) =>
  `Hi ${f},\\n\\nYou have been putting in the work on your program and your credit has come a long way. Quick heads up: we now offer Personal and Business funding!\\n\\nBig banks decline more than 4 out of 5 small business applications. We work with a network of lenders who actually say yes, with options starting as low as 0% introductory APR for qualified applicants.\\n\\nIf you ever need it, for a business or anything personal, just reply to this email or grab a time here and we will show you what you qualify for: ${FUNNEL}\\n\\nASAP Credit & Financial Services`;
""" + a3
if s.count(a3) != 1: print(f"ABORTED: subject x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, n3, 1)

a4 = """      for (const d of due) dueIds.add(String(d.pipedrive_deal_id));
    } catch (e) {}"""
n4 = a4 + """

    // Source 2: clients in round 3/4 or Additional Rounds (person CURRENT STATUS).
    // Uses a Pipedrive filter created once by the API and remembered in app_config.
    let roundCands = [];
    if (params.source !== "grads") {
      try {
        let fid = null;
        const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "grad_rounds_filter_id").limit(1);
        if (cfg && cfg[0] && cfg[0].value) fid = parseInt(cfg[0].value) || null;
        if (!fid) {
          const made = await pdPost("/filters", {
            name: "Funding campaign: rounds 3/4 + Additional Rounds",
            type: "people",
            conditions: { glue: "and", conditions: [
              { glue: "and", conditions: [] },
              { glue: "or", conditions: ROUND_STATUSES.map((v) => ({ object: "person", field_id: "9181", operator: "=", value: v })) },
            ]},
          });
          if (made && made.id) {
            fid = made.id;
            await supabase.from("app_config").upsert({ key: "grad_rounds_filter_id", value: String(fid) }, { onConflict: "key" });
          }
        }
        if (fid) {
          let st = 0;
          for (let pg = 0; pg < 4; pg++) {
            const pr = await pdGet(`/persons?filter_id=${fid}&start=${st}&limit=500`);
            const arr = Array.isArray(pr) ? pr : [];
            roundCands.push(...arr);
            if (arr.length < 500) break;
            st += 500;
          }
        }
      } catch (e) {}
    }"""
if s.count(a4) != 1: print(f"ABORTED: dueIds x{s.count(a4)}"); sys.exit(1)
s = s.replace(a4, n4, 1)

a5 = "    return { statusCode: 200, headers, body: JSON.stringify({ dry, days, limit, candidates: cands.length,"
n5 = """    // Second pass: the rounds audience, with active-client copy (never "services are over")
    for (const p of roundCands) {
      if (sent >= limit) break;
      const key = `person-${p.id}`;
      if (already.has(key)) { skipped++; continue; }
      let email = Array.isArray(p.email) && p.email.length ? (p.email.find((e) => e.primary) || p.email[0]).value : null;
      if (email && /asapnoemail|@asapcreditrepair/i.test(email)) email = null;
      const phoneRaw = Array.isArray(p.phone) && p.phone.length ? (p.phone.find((x) => x.primary) || p.phone[0]).value : null;
      const phone = phoneRaw && !stopPhones.has(last10(phoneRaw)) ? phoneRaw : null;
      if (!email && !phone) { skipped++; continue; }
      const ek2 = email ? email.toLowerCase() : null; const pk2 = phone ? last10(phone) : null;
      if ((ek2 && seenContacts.has(ek2)) || (pk2 && seenContacts.has(pk2))) { skipped++; continue; }
      if (ek2) seenContacts.add(ek2); if (pk2) seenContacts.add(pk2);
      const f = firstName(p.name);
      if (dry) { out.push({ person: p.id, name: p.name, source: "rounds", email: email || "(none)", sms_to: phone || "(none)" }); sent++; continue; }
      let emailStatus = "skipped", smsStatus = "skipped";
      try { if (email) { await sendEmail(email, emailSubjectActive, emailCopyActive(f)); emailStatus = "sent"; } } catch (e) { emailStatus = `error: ${String(e.message).slice(0, 80)}`; errors++; }
      try { if (phone) { rc = rc || await rcToken(); await sendSms(rc, phone, smsCopy(f)); smsStatus = "sent"; } } catch (e) { smsStatus = `error: ${String(e.message).slice(0, 80)}`; errors++; }
      await supabase.from("grad_announce_log").insert({ pipedrive_deal_id: key, client_name: p.name, email, phone, email_status: emailStatus, sms_status: smsStatus, finished_date: null });
      sent++;
      await new Promise((res) => setTimeout(res, 250));
    }
""" + a5.replace("candidates: cands.length,", "candidates: cands.length, rounds_candidates: roundCands.length,")
if s.count(a5) != 1: print(f"ABORTED: return x{s.count(a5)}"); sys.exit(1)
s = s.replace(a5, n5, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("V3 IN: rounds audience via auto-created PD filter + active-client copy")
