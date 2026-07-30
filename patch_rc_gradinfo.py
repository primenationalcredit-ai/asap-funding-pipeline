import sys
f = 'netlify/functions/rc-inbound-sms.js'
s = open(f, encoding='utf-8').read()

old = """    const lead = (leads || []).find((l) => last10(l.phone) === target);
    if (!lead) {
      console.log("[rc-inbound] no lead match for", matchNumber);
      return { statusCode: 200, body: "no lead match" };
    }"""
new = """    let lead = (leads || []).find((l) => last10(l.phone) === target);
    if (!lead && inbound) {
      // Grad campaign: a past credit client replying to the announcement text.
      // Create them as a lead so the reply lands on the board with an alarm.
      try {
        const { data: gl } = await supabase.from("grad_announce_log").select("client_name, email, phone").limit(2000);
        const g = (gl || []).find((r) => last10(r.phone) === target);
        if (g) {
          const stopWord = /\\b(stop|stopall|unsubscribe|cancel|quit|end|optout|opt out)\\b/i.test(text);
          const { data: ins, error: insErr } = await supabase.from("leads").insert({
            name: g.client_name || "Grad campaign reply", phone: g.phone || matchNumber,
            email: g.email || null, status: "new", source: "grad-campaign",
            opted_out: stopWord, last_touch_at: new Date().toISOString(),
          }).select().single();
          if (!insErr && ins) {
            lead = ins;
            await supabase.from("activities").insert({
              lead_id: ins.id, type: "call", title: `GRAD CAMPAIGN REPLY: ${String(text).slice(0, 80)}`,
              alarm: true, due_at: new Date().toISOString(), created_by: "automation", assigned_to: "all",
            });
            if (!stopWord) {
              try {
                const server = process.env.RC_SERVER || "https://platform.ringcentral.com";
                const basic = Buffer.from(`${process.env.RC_CLIENT_ID}:${process.env.RC_CLIENT_SECRET}`).toString("base64");
                const tp = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: process.env.RC_JWT });
                const tr = await fetch(`${server}/restapi/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: tp });
                const tj = await tr.json();
                if (tj.access_token) {
                  await fetch(`${server}/restapi/v1.0/account/~/extension/~/sms`, {
                    method: "POST", headers: { Authorization: `Bearer ${tj.access_token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ from: { phoneNumber: process.env.RC_FROM }, to: [{ phoneNumber: fromNumber }], text: "Got it! One of our team members will reach out shortly to go over your options. Reply STOP to opt out." }),
                  });
                }
              } catch (e) { console.log("[rc-inbound] grad ack fail", e.message); }
            }
            console.log("[rc-inbound] grad campaign lead created", ins.id);
          }
        }
      } catch (e) { console.log("[rc-inbound] grad fallback fail", e.message); }
    }
    if (!lead) {
      console.log("[rc-inbound] no lead match for", matchNumber);
      return { statusCode: 200, body: "no lead match" };
    }"""
if s.count(old) != 1: print(f"ABORTED rc: match anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("INFO HANDLER IN: grad replies become leads + alarm + ack")
