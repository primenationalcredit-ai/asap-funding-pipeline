import sys
f = 'netlify/functions/grad-announce.js'
s = open(f, encoding='utf-8').read()

old = """        let fid = null;
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
        }"""
new = """        // Pipedrive caps filters at 16 conditions - chunk the statuses across
        // as many filters as needed and remember every id.
        let fids = [];
        const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "grad_rounds_filter_ids").limit(1);
        if (cfg && cfg[0] && cfg[0].value) fids = String(cfg[0].value).split(",").map((x) => parseInt(x)).filter(Boolean);
        if (!fids.length) {
          for (let i = 0; i < ROUND_STATUSES.length; i += 16) {
            const chunk = ROUND_STATUSES.slice(i, i + 16);
            const made = await pdPost("/filters", {
              name: `Funding campaign: rounds audience ${Math.floor(i / 16) + 1}`,
              type: "people",
              conditions: { glue: "and", conditions: [
                { glue: "and", conditions: [] },
                { glue: "or", conditions: chunk.map((v) => ({ object: "person", field_id: 9181, operator: "=", value: v })) },
              ]},
            });
            if (made && made.id) fids.push(made.id);
          }
          if (fids.length) await supabase.from("app_config").upsert({ key: "grad_rounds_filter_ids", value: fids.join(",") }, { onConflict: "key" });
        }
        for (const fid of fids) {
          let st = 0;
          for (let pg = 0; pg < 4; pg++) {
            const pr = await pdGet(`/persons?filter_id=${fid}&start=${st}&limit=500`);
            const arr = Array.isArray(pr) ? pr : [];
            roundCands.push(...arr);
            if (arr.length < 500) break;
            st += 500;
          }
        }"""
if s.count(old) != 1: print(f"ABORTED: filter block x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("CHUNKED FILTERS IN (16-condition cap respected)")
