"""Synthesised music bed + sound effects for the T. rex episode, and the final mix.

Mix rule (series): music bed at 50 % of the voice level (-6 dB, gated RMS), SFX at
about 50 % with peaks capped below the voice, then one linear gain + a peak limiter.
"""
import json, subprocess, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).parent
SR = 48000
TL = json.load(open(ROOT / "work/timeline.json"))
DUR = TL["duration"]
N = int(DUR * SR) + SR
rs = np.random.RandomState(7)

def L2T(l):  # legacy clock -> real time (shots after the restaged middle)
    return l + 2.35

def env(n, a=0.005, d=0.1, s=0.0, r=0.05, sus=0):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(max(sus, 0), s), np.linspace(s, 0, max(r, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))

def tone(f, dur, kind="sine", vib=0):
    t = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * f * t + (vib * np.sin(2 * np.pi * 5 * t) if vib else 0)
    if kind == "sine": return np.sin(ph)
    if kind == "tri": return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "saw": return 2 * ((f * t + (vib * np.sin(2 * np.pi * 5 * t) / (2 * np.pi) if vib else 0)) % 1) - 1
    if kind == "sq": return np.sign(np.sin(ph)) * 0.6

def pluck(f, dur, damp=0.996):
    n = int(dur * SR); p = max(2, int(SR / f)); buf = rs.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def lp_fast(x, fc):  # one-pole via ffmpeg for long buffers
    return ff(x, f"lowpass=f={fc}")

def hp_fast(x, fc):
    return ff(x, f"highpass=f={fc}")

def ff(x, filt):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", filt,
                        "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"], input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    y = np.frombuffer(p.stdout, np.float32).astype(np.float64)
    return y[:len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))

def add(buf, x, t, g=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    x = x[:len(buf) - i]; buf[i:i + len(x)] += x * g

def noise(dur): return rs.uniform(-1, 1, int(dur * SR))
NOTE = lambda n: 440 * 2 ** ((n - 69) / 12)

# ------------------------------------------------------------------ SFX
def s_crunch(): x = noise(0.18) * env(int(0.18 * SR), 0.002, 0.15); return hp_fast(x, 2500) * 0.9
def s_step_wood(): x = tone(110, 0.12) * env(int(0.12 * SR), 0.001, 0.08) + noise(0.12) * env(int(0.12 * SR), 0.001, 0.03) * 0.3; return lp_fast(x, 1800)
def s_step_grass(): return lp_fast(noise(0.1) * env(int(0.1 * SR), 0.002, 0.08), 2500) * 0.6
def s_stomp():
    n = int(0.9 * SR); t = np.arange(n) / SR; f = 55 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5) + lp_fast(noise(0.9), 300) * np.exp(-t * 6) * 0.8
    return x
def s_whoosh(dur=0.7, up=True):
    n = int(dur * SR); x = noise(dur); t = np.linspace(0, 1, n)
    e = np.sin(np.pi * t) ** 2
    y = ff(x, "bandpass=f=900:w=1.5") * e
    return y * 1.4
def s_portal(dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (t / dur) ** 2) / SR) * 0.3
    return (s_whoosh(dur) + sweep * np.sin(np.pi * t / dur)) * 1.2
def s_hum(dur):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * 70 * t) * 0.5 + np.sin(2 * np.pi * 140.5 * t) * 0.3 + np.sin(2 * np.pi * 211 * t) * 0.12) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t))
def s_ding():
    n = int(1.2 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1568 * t) + 0.5 * np.sin(2 * np.pi * 3136 * t) + 0.25 * np.sin(2 * np.pi * 4704 * t)) * np.exp(-t * 4) * 0.6
def s_tick(): return hp_fast(noise(0.025) * env(int(0.025 * SR), 0.0005, 0.02), 3000) * 0.5
def s_shutter(): return hp_fast(noise(0.08) * env(int(0.08 * SR), 0.001, 0.05), 1500)
def s_roar(dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 75 + 30 * np.sin(np.pi * t / dur) + 6 * np.sin(2 * np.pi * 9 * t)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    growl = ff(noise(dur), "bandpass=f=500:w=2") * (1 + 0.8 * np.sin(2 * np.pi * 23 * t))
    e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.3)
    return lp_fast(saw * 0.8 + growl * 1.2, 1800) * e * 1.4
def s_chomp():
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 180 * t) * np.exp(-t * 30) + hp_fast(noise(0.25), 800) * np.exp(-t * 25) * 0.7)
def s_munch(): return lp_fast(noise(0.3) * env(int(0.3 * SR), 0.01, 0.25), 900) * 0.8
def s_thud(): t = np.arange(int(0.4 * SR)) / SR; return np.sin(2 * np.pi * 80 * np.exp(-t * 2) * t) * np.exp(-t * 12) + lp_fast(noise(0.4), 500) * np.exp(-t * 15)
def s_pop(): t = np.arange(int(0.15 * SR)) / SR; return np.sin(2 * np.pi * (600 + 900 * t / 0.15) * t) * np.exp(-t * 25)
def s_boing():
    t = np.arange(int(0.6 * SR)) / SR; f = 220 + 80 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 4)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.8
def s_pant(dur):
    out = np.zeros(int(dur * SR))
    for k in np.arange(0, dur - 0.3, 0.42):
        b = ff(noise(0.25), "bandpass=f=1100:w=1.2") * np.sin(np.linspace(0, np.pi, int(0.25 * SR))) * 0.5
        add(out, b, k)
    return out
def s_brush(dur):
    t = np.arange(int(dur * SR)) / SR
    return ff(noise(dur), "bandpass=f=4000:w=1") * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.5 * t))) * 0.35

sfx = np.zeros(N); amb = np.zeros(N)
F1, F1E, F2, F2E = 21.6, 28.35, 34.4, 43.03   # freeze windows (picture holds)
# room
for k in range(3): add(sfx, s_crunch(), k * 1.6 + 0.6, 0.8); add(sfx, s_munch(), k * 1.6 + 0.75, 0.4)
add(amb, s_hum(9.4) * np.concatenate([np.full(int(7.5 * SR), 0.35), np.linspace(0.35, 1.0, int(1.9 * SR) + 10)])[:int(9.4 * SR)], 0, 0.5)
add(sfx, s_whoosh(0.4), 5.0, 0.4)
for st in [5.7, 6.1, 6.5, 6.9, 7.2, 8.45, 8.85, 9.2]: add(sfx, s_step_wood(), st, 0.7)
add(sfx, s_portal(1.3), 8.6, 1.0)
# globe
add(sfx, s_whoosh(2.4), 9.5, 0.6)
add(sfx, s_pop(), 11.6, 0.6); add(sfx, s_thud(), 12.08, 0.5)
for i in range(12): add(sfx, s_tick(), 11.95 + i * 0.058, 0.8)
add(sfx, s_whoosh(1.2), 14.0, 0.9)
# swamp ambience (quieter while frozen)
sw0, sw1 = 14.9, 53.4
nsw = int((sw1 - sw0) * SR); t = np.arange(nsw) / SR
crick = np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 28 * t) > 0.3) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.4 * t)) * 0.12
a = crick + lp_fast(noise(sw1 - sw0), 400) * 0.5
for k in np.arange(0.5, sw1 - sw0, 2.7):
    bt = np.arange(int(0.25 * SR)) / SR; add(a, np.sin(2 * np.pi * (2200 + 900 * np.sin(2 * np.pi * 9 * bt)) * bt) * np.sin(np.pi * bt / 0.25) * 0.25, k + rs.rand())
tt_abs = sw0 + t
duck = np.ones(nsw); duck[((tt_abs > F1) & (tt_abs < F1E)) | ((tt_abs > F2) & (tt_abs < F2E))] = 0.45
duck = np.convolve(duck, np.ones(4800) / 4800, mode='same')
a *= duck; a[:SR // 2] *= np.linspace(0, 1, SR // 2); a[-SR // 2:] *= np.linspace(1, 0, SR // 2)
add(amb, a, sw0, 0.8)
# T. rex stomps in
for i in range(4):
    st = 19.2 + i * 0.744
    if st < F1: add(sfx, s_stomp(), st, 1.0)
# freeze 1: click + ding, typing with a ding per line
def box(f0, lines):
    add(sfx, s_shutter(), f0, 0.7); add(sfx, s_ding(), f0 + 0.02, 0.9)
    head_n = 17
    for i in range(head_n): add(sfx, s_tick(), f0 + 0.12 + i * 0.48 / head_n, 0.45)
    for at, txt in lines:
        add(sfx, s_ding(), at - 0.05, 0.6); d = min(0.9, len(txt) * 0.04)
        for i in range(len(txt)): add(sfx, s_tick(), at - 0.05 + i * d / len(txt), 0.5)
box(F1, [(22.76, 'Lived up to 30 years'), (25.36, '12 m long · 9 tons')])
# resumes: stomps, Martin dives behind the rock
for st in [28.4, 29.15]: add(sfx, s_stomp(), st, 0.9)
add(sfx, s_whoosh(0.4), 28.5, 0.6); add(sfx, s_thud(), 29.0, 0.6)
# the hunt
add(sfx, s_roar(0.8), 29.75, 1.1)
for st in [30.9, 31.25, 31.55]: add(sfx, s_stomp(), st, 1.0)
add(sfx, s_thud(), 31.75, 1.2); add(sfx, s_stomp(), 31.77, 0.8); add(sfx, s_roar(0.35) * 0.6, 31.8, 0.6)
add(sfx, s_stomp(), 32.3, 1.0)
for k in np.arange(32.95, F2, 0.98): add(sfx, s_munch(), k, 0.7)
box(F2, [(35.06, 'Favorite food: Triceratops'), (37.73, 'Bite: up to 100× yours'), (40.68, 'Teeth ≈ 30 cm, a banana')])
for k in np.arange(F2E, 45.6, 0.98): add(sfx, s_munch(), k, 0.7)
# notices him
for k in [45.75, 46.15]: add(sfx, ff(noise(0.5), "bandpass=f=600:w=1") * np.sin(np.linspace(0, np.pi, SR // 2)), k, 0.8)
add(sfx, s_whoosh(0.25), 46.6, 0.35)
add(sfx, s_roar(1.0), 47.4, 1.2)
# chase, trip, portal
for k in list(np.arange(49.3, 51.4, 0.105)) + list(np.arange(52.5, 52.7, 0.105)): add(sfx, s_step_grass(), k, 0.5)
for st in np.arange(49.9, 53.0, 0.5): add(sfx, s_stomp(), st, 1.0)
add(sfx, s_whoosh(0.35), 51.4, 0.6); add(sfx, s_thud(), 51.75, 0.9); add(sfx, s_thud(), 52.3, 0.2)
add(amb, s_hum(1.4), 52.0, 0.5)
add(sfx, s_portal(1.0), 52.7, 1.0)
add(sfx, s_chomp(), 53.2, 1.0)
# home
add(sfx, s_portal(0.8), 53.4, 0.8)
add(sfx, s_thud(), 53.9, 1.0)
add(sfx, s_pant(2.0), 54.0, 0.45)
add(amb, s_hum(4.3) * 0.4, 53.4, 0.4)

# ------------------------------------------------------------------ MUSIC
mus = np.zeros(N)
def bar_pluck(t0, notes, step, g=0.25, damp=0.995):
    for i, n in enumerate(notes):
        if n is None: continue
        add(mus, pluck(NOTE(n), step * 1.8, damp), t0 + i * step, g)
def pad(t0, dur, notes, g=0.12, kind="tri"):
    n = int(dur * SR); e = np.minimum(1, np.minimum(np.arange(n) / (0.6 * SR), (n - np.arange(n)) / (0.8 * SR)))
    x = sum(tone(NOTE(m), dur, kind, vib=0.3) for m in notes) / len(notes)
    add(mus, lp_fast(x, 1400) * e, t0, g)
def kick(t0, g=0.6): tt = np.arange(int(0.3 * SR)) / SR; add(mus, np.sin(2 * np.pi * 50 * np.exp(-tt * 8) * tt * 6) * np.exp(-tt * 9), t0, g)
def snare(t0, g=0.3): add(mus, hp_fast(noise(0.2), 1500) * env(int(0.2 * SR), 0.001, 0.15), t0, g)
def hat(t0, g=0.12): add(mus, hp_fast(noise(0.05), 6000) * env(int(0.05 * SR), 0.0005, 0.04), t0, g)
def bell(t0, n, g=0.07, dur=2.4):
    tt = np.arange(int(dur * SR)) / SR; add(mus, (np.sin(2 * np.pi * NOTE(n) * tt) + 0.3 * np.sin(4 * np.pi * NOTE(n) * tt)) * np.exp(-tt * 1.6), t0, g)
# 1. room: slow and soft (Cmaj7 - Am7 - Fmaj7 - G), sparse bell notes, kept low
room = np.zeros(N)
for i, ch in enumerate([[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]]):
    pad(i * 2.35, 2.9, ch, 0.12)
for i, n in enumerate([76, 72, 71, 67, 69, 64, 67, 71]): bell(0.3 + i * 1.17, n, 0.06)
# 2. space wonder 9.4-15
pad(9.4, 5.8, [60, 67, 71, 76], 0.14)
for i, n in enumerate([72, 76, 79, 83, 84, 83, 79, 76] * 3):
    add(mus, tone(NOTE(n), 0.5, "sine") * env(int(0.5 * SR), 0.005, 0.45), 9.6 + i * 0.22, 0.08)
# 3. swamp mystery 15-21.35
pad(15.0, 6.6, [45, 52], 0.13, "saw")
mar = [69, None, 72, None, 76, 74, None, 72, 69, None, 67, None, 64, None, 67, None]
for b in range(2): bar_pluck(15.2 + b * 16 * 0.2, mar, 0.2, 0.12, 0.99)
# freezes: a held, quiet suspended chord under the facts
pad(F1, F1E - F1 + 0.3, [57, 62, 64, 69], 0.09)
pad(F2, F2E - F2 + 0.3, [55, 60, 62, 67], 0.09)
# 4. the hunt 28.2-33.7: pulse + kicks
for k, tt in enumerate(np.arange(F1E, F2, 0.25)):
    add(mus, lp_fast(tone(NOTE(33 if (k // 8) % 2 == 0 else 34), 0.22, "saw") * env(int(0.22 * SR), 0.005, 0.2), 700), tt, 0.18)
for tt in np.arange(29.55, 31.85, 0.5): kick(tt, 0.45)
# 5. after the meal: low unease, then the sting on the side-eye
for k, tt in enumerate(np.arange(F2E, 47.4, 0.5)):
    add(mus, lp_fast(tone(NOTE(33), 0.45, "saw") * env(int(0.45 * SR), 0.01, 0.4), 600), tt, 0.1)
add(mus, lp_fast(tone(NOTE(81), 0.8, "saw", vib=2), 3000) * env(int(0.8 * SR), 0.01, 0.75), 46.6, 0.1)
# 6. chase 49.7-55.0
st = 0.2
for i, tt in enumerate(np.arange(48.45, 53.35, st)):
    if i % 2 == 0: kick(tt, 0.6)
    if i % 4 == 2: snare(tt, 0.35)
    hat(tt, 0.1)
    add(mus, lp_fast(tone(NOTE([33, 33, 36, 33, 38, 36, 33, 31][i % 8]), st * 0.9, "saw") * env(int(st * 0.9 * SR), 0.003, 0.17), 900), tt, 0.2)
for i, n in enumerate([69, 72, 76, 72, 71, 74, 77, 74] * 4): add(mus, lp_fast(tone(NOTE(n), 0.19, "sq") * env(int(0.19 * SR), 0.003, 0.17), 2500), 48.45 + i * 0.2, 0.06)
# 7. home: relief, soft resolve to the end
pad(53.5, DUR - 53.5, [48, 55, 60, 64], 0.12)
bell(54.4, 72, 0.06); bell(55.6, 76, 0.06); bell(56.8, 79, 0.05)
fade = int(1.0 * SR); e = int(DUR * SR); mus[e - fade:e] *= np.linspace(1, 0, fade); mus[e:] = 0

# inserted beat after the kill ("You saw that?"): open the bed at 34.4 s for 4.08 s
INS0, INS = 34.4, 4.08
def insert(buf, filler):
    i = int(INS0 * SR); n = int(INS * SR)
    return np.concatenate([buf[:i], filler[:n], buf[i:]])[:N]
fill_fx = np.zeros(int(INS * SR) + SR)
for k in np.arange(0.2, INS, 0.98): add(fill_fx, s_munch(), k, 0.7)
add(fill_fx, s_whoosh(0.2), 35.85 - INS0, 0.3)
sfx = insert(sfx, fill_fx)
amb = insert(amb, amb[int((INS0 - INS) * SR):int(INS0 * SR)].copy())
seg = mus[int(32.0 * SR):int(34.4 * SR)].copy(); mus = insert(mus, np.concatenate([seg, seg]))

# the opening sits lower than the rest of the bed (asked for this episode)
low = np.ones(N); i0, i1 = int(9.0 * SR), int(9.8 * SR); low[:i0] = 0.5; low[i0:i1] = np.linspace(0.5, 1, i1 - i0); mus *= low

# ------------------------------------------------------------------ MIX
def read(path):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).astype(np.float64)
voice = read(ROOT / "audio/voice.wav"); voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
def gated_rms(x, thr_db=-40):
    hop = int(0.05 * SR); fr = x[:len(x) // hop * hop].reshape(-1, hop); r = np.sqrt((fr ** 2).mean(1)); ref = r.max()
    keep = r[20 * np.log10(r / ref + 1e-12) > thr_db]
    return np.sqrt((keep ** 2).mean())
v = gated_rms(voice)
music = mus * (0.5 * v / gated_rms(mus))
amb_ = amb * (0.30 * v / gated_rms(amb))
fx = sfx * (0.45 * v / gated_rms(sfx))
cap = 0.5 * np.abs(voice).max()
fx = np.clip(fx, -cap, cap); amb_ = np.clip(amb_, -cap, cap)
print(f"voice gated rms {20*np.log10(v):.1f} dBFS, music {20*np.log10(gated_rms(music)):.1f}, sfx {20*np.log10(gated_rms(fx)):.1f}, amb {20*np.log10(gated_rms(amb_)):.1f}")
mix = voice + music + fx + amb_
mix = mix[:int(DUR * SR)]
def wr(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
peak = np.abs(mix).max(); mix = mix / peak * 0.5   # headroom before loudness gain
wr(ROOT / "audio/mix_raw.wav", mix)
wr(ROOT / "audio/music.wav", music[:int(DUR * SR)] / peak * 0.5)
# one linear gain to -14 LUFS, then a true-peak limiter
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(ROOT / "audio/mix_raw.wav"), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float([l for l in meas.splitlines() if l.strip().startswith("I:")][-1].split()[1])
gain = -14.0 - I
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / "audio/mix_raw.wav"), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false",
                "-ar", "48000", "-ac", "2", str(ROOT / "audio/mix.wav")], check=True)
print(f"mix integrated {I:.1f} LUFS -> gain {gain:+.1f} dB, written audio/mix.wav")
