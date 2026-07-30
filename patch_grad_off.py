import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8').read()
old = '[functions."grad-announce"]\n  schedule = "0 17 * * 1-5"\n'
if s.count(old) != 1:
    old = old.replace('\n', '\r\n')
    if s.count(old) != 1:
        print('ABORTED: schedule block not found'); sys.exit(1)
s = s.replace(old, '', 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print('CAMPAIGN OFF - manual-only from here')
