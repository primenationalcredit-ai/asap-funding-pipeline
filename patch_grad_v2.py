import sys
f = 'netlify/functions/grad-announce.js'
s = open(f, encoding='utf-8').read()

old = """    const seen = new Set(); const cands = [];
    for (const p of pays) { const id = String(p.pipedrive_deal_id); if (!seen.has(id)) { seen.add(id); cands.push(p); } }"""
new = """    const seen = new Set(); const cands = [];
    for (const p of pays) { const id = String(p.pipedrive_deal_id); if (!seen.has(id)) { seen.add(id); cands.push(p); } }

    // Skip anyone with an open overdue balance - wrong moment for this message
    const dueIds = new Set();
    try {
      const due = await pbGet(`consultant_invoices?balance=gt.1&status=eq.overdue&pipedrive_deal_id=not.is.null&select=pipedrive_deal_id&limit=1000`);
      for (const d of due) dueIds.add(String(d.pipedrive_deal_id));
    } catch (e) {}"""
if s.count(old) != 1: print(f"ABORTED: dedupe anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old2 = """      const dealId = String(c.pipedrive_deal_id);
      if (already.has(dealId)) { skipped++; continue; }"""
new2 = """      const dealId = String(c.pipedrive_deal_id);
      if (already.has(dealId)) { skipped++; continue; }
      if (dueIds.has(dealId)) { skipped++; continue; }"""
if s.count(old2) != 1: print(f"ABORTED: loop anchor x{s.count(old2)}"); sys.exit(1)
s = s.replace(old2, new2, 1)

old3 = """      const email = person && Array.isArray(person.email) && person.email.length ? (person.email.find((e) => e.primary) || person.email[0]).value : null;"""
new3 = """      let email = person && Array.isArray(person.email) && person.email.length ? (person.email.find((e) => e.primary) || person.email[0]).value : null;
      if (email && /asapnoemail|@asapcreditrepair/i.test(email)) email = null; // placeholder addresses"""
if s.count(old3) != 1: print(f"ABORTED: email anchor x{s.count(old3)}"); sys.exit(1)
s = s.replace(old3, new3, 1)

old4 = """      if (!email && !phone) { skipped++; continue; }"""
new4 = """      if (!email && !phone) { skipped++; continue; }
      // one message per inbox/phone (shared household contacts)
      const ek = email ? email.toLowerCase() : null; const pk = phone ? last10(phone) : null;
      if ((ek && seenContacts.has(ek)) || (pk && seenContacts.has(pk))) { skipped++; continue; }
      if (ek) seenContacts.add(ek); if (pk) seenContacts.add(pk);"""
if s.count(old4) != 1: print(f"ABORTED: contact anchor x{s.count(old4)}"); sys.exit(1)
s = s.replace(old4, new4, 1)

old5 = "    const out = []; let sent = 0, skipped = 0, errors = 0; let rc = null;"
new5 = "    const out = []; let sent = 0, skipped = 0, errors = 0; let rc = null; const seenContacts = new Set();"
if s.count(old5) != 1: print(f"ABORTED: init anchor x{s.count(old5)}"); sys.exit(1)
s = s.replace(old5, new5, 1)

open(f, 'w', encoding='utf-8', newline='').write(s)
print("V2: placeholder emails skipped, households deduped, overdue balances excluded")
