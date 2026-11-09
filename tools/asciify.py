"""Convierte todo caracter no ASCII de jsx/*.js y jsx/*.jsx a secuencias \\uXXXX.
ExtendScript puede leer archivos sin BOM con la codificacion del sistema, asi que el codigo debe ser ASCII puro.
Uso: python3 tools/asciify.py   (idempotente)"""
import glob, os, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extension', 'jsx')
changed = 0
for p in sorted(glob.glob(os.path.join(root, '*.js')) + glob.glob(os.path.join(root, '*.jsx'))):
    s = open(p, encoding='utf-8').read()
    out = []
    for ch in s:
        o = ord(ch)
        if o < 128: out.append(ch)
        elif o < 0x10000: out.append('\\u%04x' % o)
        else:
            o -= 0x10000; out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
    t = ''.join(out)
    if t != s:
        open(p, 'w', encoding='utf-8', newline='\n').write(t); changed += 1
        print('asciificado', os.path.basename(p))
bad = [p for p in glob.glob(os.path.join(root, '*')) if any(ord(c) > 127 for c in open(p, encoding='utf-8').read())]
print('archivos con no-ASCII restantes:', len(bad)); sys.exit(1 if bad else 0)
