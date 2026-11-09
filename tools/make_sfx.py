"""Sintetiza la biblioteca de efectos de sonido de Escalera Subs (WAV 16-bit mono 44.1 kHz).
Todo es generado por codigo: sin derechos de autor, libre de usar en tus videos.
Uso: python3 tools/make_sfx.py   ->   escribe sounds/*.wav y sounds/library.json
"""
import json, os, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'extension', 'sounds')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(d): return np.linspace(0, d, int(SR * d), endpoint=False)
def env_exp(x, k): return np.exp(-k * x)
def sine(f, x, ph=0): return np.sin(2 * np.pi * f * x + ph)
def fade(sig, a=0.003, b=0.02):
    n = len(sig); na = max(1, int(SR * a)); nb = max(1, int(SR * b))
    sig = sig.copy(); sig[:na] *= np.linspace(0, 1, na); sig[-nb:] *= np.linspace(1, 0, nb); return sig
def lowpass(x, k):  # media movil simple
    k = max(1, int(k)); return np.convolve(x, np.ones(k) / k, mode='same')
def highpass(x, k): return x - lowpass(x, k)
def norm(sig, peak=0.85): m = np.max(np.abs(sig)) or 1; return sig / m * peak
def sweep(f0, f1, x):  # barrido exponencial de frecuencia
    d = x[-1] if x[-1] > 0 else 1
    k = np.log(f1 / f0) / d
    return np.sin(2 * np.pi * f0 * (np.exp(k * x) - 1) / k)


def click():
    x = t(0.09); n = rng.standard_normal(len(x))
    return fade(highpass(n, 6) * env_exp(x, 90) + sine(2400, x) * env_exp(x, 110) * .6)

def tick():
    x = t(0.05)
    return fade(sine(1800, x) * env_exp(x, 140) + highpass(rng.standard_normal(len(x)), 4) * env_exp(x, 200) * .3)

def pop():
    x = t(0.16); f = 520 * np.exp(-x * 14) + 160
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * env_exp(x, 22) + rng.standard_normal(len(x)) * env_exp(x, 90) * .06)

def bubble():
    x = t(0.22); f = 300 + 900 * (1 - np.exp(-x * 24))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * env_exp(x, 16))

def shine():
    x = t(0.9); sig = np.zeros_like(x)
    for i, f in enumerate([2093, 2637, 3136, 3951, 4699]):
        s = int(i * .06 * SR)
        e = np.zeros_like(x); e[s:] = env_exp(x[:len(x) - s], 6 + i)
        sig += sine(f, x) * e * (1 / (1 + i * .35))
    return fade(sig, b=0.15)

def sparkle():
    x = t(0.6); sig = np.zeros_like(x)
    for s in [0, .05, .11, .18, .27, .36]:
        i = int(s * SR); f = rng.choice([3520, 4186, 5274, 6272])
        seg = t(0.18); sig[i:i + len(seg)] += sine(f, seg) * env_exp(seg, 28)[:len(sig) - i]
    return fade(sig, b=0.1)

def ding():
    x = t(0.9)
    return fade((sine(1318, x) + .5 * sine(2637, x) + .25 * sine(3951, x)) * env_exp(x, 5.5), b=.1)

def swoosh():
    x = t(0.45); n = rng.standard_normal(len(x))
    band = lowpass(highpass(n, 40), 4)
    env = np.sin(np.pi * x / x[-1]) ** 2
    return fade(band * env * (0.4 + 0.6 * x / x[-1]), a=.02, b=.08)

def whoosh_up():
    x = t(0.6); n = rng.standard_normal(len(x))
    sw = sweep(300, 2600, x); env = np.sin(np.pi * x / x[-1]) ** 1.5
    return fade((lowpass(n, 6) * .7 + sw * .5) * env, a=.03, b=.1)

def snap():
    x = t(0.12); n = rng.standard_normal(len(x))
    return fade(highpass(n, 3) * env_exp(x, 60) + sine(900, x) * env_exp(x, 70) * .4)

def thud():
    x = t(0.4); f = 110 * np.exp(-x * 9) + 42
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * env_exp(x, 8) + lowpass(rng.standard_normal(len(x)), 30) * env_exp(x, 40) * .3, b=.1)

def glitch():
    x = t(0.3); sig = np.zeros_like(x); pos = 0
    while pos < len(x) - 400:
        L = min(int(rng.integers(300, 1800)), len(x) - pos); f = rng.choice([180, 420, 880, 1600, 3000])
        sig[pos:pos + L] += np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * .5 * np.linspace(1, .2, L)
        pos += L + int(rng.integers(0, 600))
    return fade(sig, b=.04)

def notify():
    x = t(0.5); a = sine(988, x) * env_exp(x, 9); b = np.zeros_like(x)
    s = int(.12 * SR); b[s:] = sine(1319, x[:len(x) - s]) * env_exp(x[:len(x) - s], 8)
    return fade(a + b, b=.1)


LIB = [
    ('click',    'Click',        'Interfaz', click),
    ('tick',     'Tick seco',    'Interfaz', tick),
    ('pop',      'Pop',          'Interfaz', pop),
    ('bubble',   'Burbuja',      'Interfaz', bubble),
    ('snap',     'Chasquido',    'Interfaz', snap),
    ('shine',    'Brillo',       'Brillo',   shine),
    ('sparkle',  'Destellos',    'Brillo',   sparkle),
    ('ding',     'Ding',         'Brillo',   ding),
    ('notify',   'Aviso',        'Brillo',   notify),
    ('swoosh',   'Swoosh',       'Movimiento', swoosh),
    ('whoosh_up', 'Whoosh sube', 'Movimiento', whoosh_up),
    ('thud',     'Impacto',      'Impacto',  thud),
    ('glitch',   'Glitch',       'Impacto',  glitch),
]

meta = []
for sid, name, cat, fn in LIB:
    sig = norm(fn())
    pcm = (np.clip(sig, -1, 1) * 32767).astype('<i2')
    path = os.path.join(OUT, sid + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    meta.append({'id': sid, 'name': name, 'cat': cat, 'file': sid + '.wav', 'dur': round(len(sig) / SR, 3)})
    print('%-10s %-12s %.2fs  %6.1f KB' % (sid, cat, len(sig) / SR, os.path.getsize(path) / 1024))

with open(os.path.join(OUT, 'library.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print('\n%d sonidos' % len(meta))

# Misma lista como script para que el panel la cargue sin leer archivos (js/sfxlib.js)
with open(os.path.join(os.path.dirname(__file__), '..', 'extension', 'js', 'sfxlib.js'), 'w', encoding='utf-8') as f:
    f.write('/* generado por tools/make_sfx.py */\nvar SFX_LIB = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
print('js/sfxlib.js escrito')
