# Every Japanese glyph the game draws must be in the Google Fonts subset (&text=) in game/index.html, or it falls
# back to whatever font the device has. Lists any that are not.  python work/glyph_check.py
import re, urllib.parse, glob, os
html = open('game/index.html', encoding='utf8').read()
subs = set()
for m in re.finditer(r'text=([^&"\']+)', html):
    subs |= set(urllib.parse.unquote(m.group(1)))

def cjk(ch):
    o = ord(ch)
    return 0x3040 <= o <= 0x30ff or 0x4e00 <= o <= 0x9fff or 0xff00 <= o <= 0xffef

used = {}
for f in glob.glob('game/src/*.js') + ['game/index.html']:
    t = open(f, encoding='utf8').read()
    # (only text in string literals: comments may say anything)
    for m in re.finditer(r"'([^'\n]*)'|\"([^\"\n]*)\"|`([^`]*)`", t):
        for ch in (m.group(1) or m.group(2) or m.group(3) or ''):
            if cjk(ch): used.setdefault(ch, set()).add(os.path.basename(f))
for ch in re.sub(r'<[^>]+>', '', html):
    if cjk(ch): used.setdefault(ch, set()).add('index.html text')
missing = {c: sorted(v) for c, v in used.items() if c not in subs}
print('subset', len(subs), 'glyphs; used', len(used))
print('missing:', ''.join(sorted(missing)) or 'none')
for c, v in sorted(missing.items()): print(' ', c, v)
