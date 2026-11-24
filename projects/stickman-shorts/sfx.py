"""Ambient sound only (no dialogue, no narration, no music) for shot 1 and shot 2, 4 s each."""
import subprocess, wave
from pathlib import Path
import numpy as np
ROOT = Path(__file__).parent
SR = 48000
rs = np.random.RandomState(3)

def ff(x, filt):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", filt, "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    y = np.frombuffer(p.stdout, np.float32).astype(np.float64); return np.pad(y, (0, max(0, len(x) - len(y))))[:len(x)]
def noise(d): return rs.uniform(-1, 1, int(d * SR))
def add(b, x, t, g=1.0):
    i = int(t * SR); x = x[:max(0, len(b) - i)]; b[i:i + len(x)] += x * g
def env(n, a, r):
    e = np.ones(n); A, R = int(a * SR), int(r * SR); e[:A] = np.linspace(0, 1, A); e[n - R:] = np.linspace(1, 0, R); return e

def fair_bed(d):
    t = np.arange(int(d * SR)) / SR
    crowd = ff(noise(d), "bandpass=f=500:w=1.6") * (0.7 + 0.3 * np.abs(np.sin(2 * np.pi * 0.7 * t)) + 0.2 * np.sin(2 * np.pi * 2.3 * t))
    babble = sum(ff(noise(d), f"bandpass=f={f}:w=0.6") * (0.5 + 0.5 * np.sin(2 * np.pi * r * t + p)) for f, r, p in [(320, 3.1, 0), (720, 4.3, 1), (1100, 2.7, 2), (1600, 5.1, 3)]) * 0.5
    breeze = ff(noise(d), "lowpass=f=300") * (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * t))
    out = crowd * 0.5 + babble * 0.35 + breeze * 0.6
    for k in np.arange(0.2, d, 0.9):  # birds
        bt = np.arange(int(0.18 * SR)) / SR; f0 = 2600 + rs.rand() * 1200
        add(out, np.sin(2 * np.pi * (f0 + 700 * np.sin(2 * np.pi * 14 * bt)) * bt) * np.sin(np.pi * bt / 0.18) * 0.18, k + rs.rand() * 0.4)
    # a far-off laugh-like burst
    lt = np.arange(int(0.6 * SR)) / SR
    add(out, ff(noise(0.6), "bandpass=f=900:w=1") * (np.abs(np.sin(2 * np.pi * 6 * lt)) ** 2) * np.sin(np.pi * lt / 0.6) * 0.25, d * 0.55)
    return out

def burlap(d):
    t = np.arange(int(d * SR)) / SR
    return ff(noise(d), "bandpass=f=2200:w=1.4") * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * t)) ** 3) * env(len(t), 0.05, 0.1)

def salt_pour(d):
    n = int(d * SR); t = np.arange(n) / SR
    hiss = ff(noise(d), "highpass=f=3500,lowpass=f=11000") * 0.5
    grains = np.zeros(n)
    for _ in range(int(d * 900)):  # tiny ticks of salt landing on ice
        i = rs.randint(0, n - 200); grains[i:i + 60] += rs.uniform(-1, 1, 60) * np.exp(-np.arange(60) / 9) * rs.uniform(0.2, 1)
    grains = ff(grains, "highpass=f=2500")
    crackle = np.zeros(n)
    for _ in range(int(d * 14)):
        i = rs.randint(0, n - 2000); crackle[i:i + 1500] += np.sin(2 * np.pi * rs.uniform(2500, 5000) * np.arange(1500) / SR) * np.exp(-np.arange(1500) / 200) * 0.4
    return (hiss + grains * 0.6 + crackle) * env(n, 0.08, 0.15)

def creak(): t = np.arange(int(0.18 * SR)) / SR; f = 420 + 160 * t / 0.18; return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 12) * 0.25
def clack(): t = np.arange(int(0.06 * SR)) / SR; return (np.sin(2 * np.pi * 900 * t) + rs.uniform(-1, 1, len(t)) * 0.6) * np.exp(-t * 80)
def clink(): t = np.arange(int(0.25 * SR)) / SR; f = rs.uniform(2800, 5200); return np.sin(2 * np.pi * f * t) * np.exp(-t * 30) * 0.5 + np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t * 40) * 0.2

def write(path, x, target=-18.0):
    tmp = ROOT / "audio/_t.wav"
    def w(p, y):
        with wave.open(str(p), "wb") as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    x = x / (np.abs(x).max() + 1e-9) * 0.5; w(tmp, x)
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float([l for l in m.splitlines() if l.strip().startswith("I:")][-1].split()[1])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"volume={target - I:.2f}dB,alimiter=limit=0.8:level=false", "-ar", "48000", "-ac", "2", str(path)], check=True)

D = 4.0
# SHOT 1: fair, the sack lifted and tipped (burlap), salt pouring onto ice from 1.5 to 3.75 s
s1 = fair_bed(D) * 0.55
add(s1, burlap(0.8), 0.15, 0.9); add(s1, burlap(0.5), 0.95, 0.7)
add(s1, salt_pour(2.3), 1.5, 1.4)
if 0: write(ROOT / "audio/shot1.wav", s1)

# SHOT 2: fair, a beat of glaring, then both churns crank fast (creak and clack each turn, ice clinking)
s2 = fair_bed(D) * 0.55
for start, rps, pan in [(1.85, 2.3, 0), (1.9, 2.5, 0)]:
    for k in np.arange(start, D, 1 / rps):
        add(s2, creak(), k, 0.7); add(s2, clack(), k + 0.5 / rps, 0.6)
    for k in np.arange(start, D, 0.11):
        if rs.rand() < 0.6: add(s2, clink(), k + rs.rand() * 0.08, 0.35)
    add(s2, ff(noise(D - start), "bandpass=f=700:w=1.2") * 0.25, start, 1.0)  # ice and brine slosh
add(s2, clack() * 0.8, 1.72, 0.8); add(s2, clack() * 0.8, 1.78, 0.8)  # hands grab the handles
if 0: write(ROOT / "audio/shot2.wav", s2)
print("ok")

def slap(): t = np.arange(int(0.12 * SR)) / SR; return ff(noise(0.12), "bandpass=f=1800:w=1.2") * np.exp(-t * 45) + np.sin(2 * np.pi * 160 * t) * np.exp(-t * 40) * 0.5
def rustle(d): return ff(noise(d), "bandpass=f=3000:w=1.5") * np.sin(np.linspace(0, np.pi, int(d * SR))) * 0.4
def step(): t = np.arange(int(0.09 * SR)) / SR; return ff(noise(0.09), "lowpass=f=1600") * np.exp(-t * 40)
def clap(): t = np.arange(int(0.07 * SR)) / SR; return ff(noise(0.07), f"bandpass=f={rs.uniform(1400, 2600):.0f}:w=1.4") * np.exp(-t * 70)

# SHOT 3: salt keeps pouring the whole time; the rival leans in, laughs silently, slaps his knee; the seller shrugs
s3 = fair_bed(D) * 0.55
add(s3, salt_pour(D), 0.0, 1.2)
add(s3, rustle(0.4), 0.05, 0.8); add(s3, step(), 0.15, 0.6); add(s3, step(), 0.45, 0.6)
for k in (1.75, 2.17, 2.59, 3.01): add(s3, slap(), k, 1.0)
add(s3, rustle(0.35), 2.1, 0.6)
if 0: write(ROOT / "audio/shot3.wav", s3)

# SHOT 4 (5 s): cart rolls in (rumble, creaks, ice rattling), stops with a clunk; footsteps; clapping and cheering
D4 = 5.0
s4 = fair_bed(D4) * 0.5
n = int(1.75 * SR); t = np.arange(n) / SR; speed = np.clip(1 - t / 1.7, 0, 1)
rumble = ff(noise(1.75), "lowpass=f=220") * (0.4 + 0.6 * speed) + ff(noise(1.75), "bandpass=f=900:w=1") * 0.25 * speed
add(s4, rumble, 0.0, 1.0)
for k in np.arange(0.05, 1.6, 0.13): add(s4, clink(), k + rs.rand() * 0.05, 0.3 * (1 - k / 1.7))
for k in (0.2, 0.75, 1.3): add(s4, creak(), k, 0.6)
add(s4, clack(), 1.7, 1.0); add(s4, ff(noise(0.3), "lowpass=f=300") * np.exp(-np.arange(int(0.3 * SR)) / SR * 12), 1.7, 1.0)
for k in (1.72, 1.78, 1.85): add(s4, clink(), k, 0.6)
add(s4, rustle(0.4), 1.75, 0.7)  # arms swing
for i in range(5):
    t0 = 0.9 + i * 0.3; arrive = t0 + 3.0 / 1.35
    for k in np.arange(t0, min(arrive, D4), 0.35): add(s4, step(), k + rs.rand() * 0.03, 0.5)
claps = np.zeros(int(D4 * SR) + SR)
for k in np.arange(3.0, D4, 0.045):
    if rs.rand() < 0.75: add(claps, clap(), k + rs.rand() * 0.03, 0.9)
add(s4, claps[:len(s4)], 0, 0.9)
tc = np.arange(int(2.0 * SR)) / SR
cheer = sum(ff(noise(2.0), f"bandpass=f={f}:w=0.5") * (0.6 + 0.4 * np.sin(2 * np.pi * r * tc)) for f, r in [(650, 1.3), (1100, 1.7), (2400, 2.1)]) * np.minimum(1, tc / 0.25)
add(s4, cheer, 3.0, 0.7)
if 0: write(ROOT / "audio/shot4.wav", s4)
print("ok 3 4")

# SHOT 5: slow calm cranking, slush sloshing, frost crackling louder as it climbs, fairgoers shuffle in
s5 = fair_bed(D) * 0.5
for k in np.arange(0.0, D, 1.0): add(s5, creak(), k, 0.5); add(s5, clack(), k + 0.5, 0.35)
tt = np.arange(int(D * SR)) / SR
add(s5, ff(noise(D), "bandpass=f=420:w=1.0") * (0.5 + 0.5 * np.sin(2 * np.pi * 1.0 * tt)) * 0.35, 0, 1.0)  # slush slosh with each turn
frost = np.zeros(int(D * SR))
for _ in range(500):
    u = rs.rand() ** 0.6; i = int((0.2 + u * 3.7) * SR)
    if i < len(frost) - 3000: n2 = 1200; frost[i:i + n2] += np.sin(2 * np.pi * rs.uniform(3000, 7000) * np.arange(n2) / SR) * np.exp(-np.arange(n2) / 150) * rs.uniform(0.2, 0.7)
add(s5, ff(frost, "highpass=f=2500") * np.linspace(0.3, 1.0, len(frost)), 0, 1.1)
add(s5, rustle(0.5), 0.05, 0.7); add(s5, step(), 0.2, 0.5); add(s5, step(), 0.45, 0.5); add(s5, rustle(0.4), 1.35, 0.6)
if 0: write(ROOT / "audio/shot5.wav", s5)
print("ok 5")

def lid_lift(): t = np.arange(int(0.5 * SR)) / SR; return ff(noise(0.5), "bandpass=f=2500:w=0.8") * np.exp(-t * 6) * 0.5 + np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 14) * 0.3
def ting(): t = np.arange(int(1.0 * SR)) / SR; return (np.sin(2 * np.pi * 2350 * t) + 0.5 * np.sin(2 * np.pi * 5900 * t)) * np.exp(-t * 5) * 0.5
def gloop(): t = np.arange(int(0.25 * SR)) / SR; f = 180 + 260 * t / 0.25; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * 0.6

# SHOT 6 (4 s): judge's footsteps, a hush, both lids lifted together with a cold hiss
s6 = fair_bed(D) * 0.45
for k in np.arange(0.05, 1.5, 0.3): add(s6, step(), k, 0.7)
add(s6, rustle(0.4), 1.6, 0.6)
add(s6, lid_lift(), 2.12, 1.0); add(s6, lid_lift(), 2.14, 1.0)
add(s6, ff(noise(1.4), "highpass=f=4000") * np.linspace(1, 0, int(1.4 * SR)) * 0.4, 2.2, 1.0)
add(s6, rustle(0.4), 2.35, 0.5)
write(ROOT / "audio/shot6.wav", s6)

# SHOT 7 (4 s): close and quiet: slush fizz, misty air, frost crackle around the rim, the cream thickening
s7 = fair_bed(D) * 0.2
add(s7, ff(noise(D), "bandpass=f=1800:w=1.5") * 0.25, 0, 1.0)                       # fizzing slush
add(s7, ff(noise(D), "lowpass=f=500") * (0.5 + 0.5 * np.sin(2 * np.pi * 0.4 * np.arange(int(D * SR)) / SR)) * 0.5, 0, 1.0)   # rising cold air
fr = np.zeros(int(D * SR))
for _ in range(380):
    i = int((0.2 + rs.rand() ** 0.7 * 3.4) * SR)
    if i < len(fr) - 1500: fr[i:i + 1200] += np.sin(2 * np.pi * rs.uniform(3500, 7500) * np.arange(1200) / SR) * np.exp(-np.arange(1200) / 140) * rs.uniform(0.2, 0.6)
add(s7, ff(fr, "highpass=f=3000"), 0, 1.0)
for k in np.arange(0.4, 3.4, 0.45): add(s7, gloop(), k + rs.rand() * 0.1, 0.5 * (1 - k / 4))
write(ROOT / "audio/shot7.wav", s7)

# SHOT 8 (5 s): runny cream sloshing and splashing, judge's steps, the spoon handed over (ting), then a hush
D8 = 5.0
s8 = fair_bed(D8) * 0.45
add(s8, ff(noise(0.6), "bandpass=f=600:w=1.2") * np.sin(np.linspace(0, np.pi, int(0.6 * SR))) * 0.6, 0.3, 1.0)   # slosh in the can
pourS = ff(noise(2.0), "bandpass=f=1200:w=1.4") * 0.5
add(s8, pourS * np.concatenate([np.linspace(0, 1, int(0.2 * SR)), np.ones(int(1.4 * SR)), np.linspace(1, 0, int(0.4 * SR))])[:len(pourS)], 0.8, 1.0)
for k in np.arange(0.9, 2.8, 0.09): add(s8, gloop() * 0.4, k + rs.rand() * 0.05, 0.6)  # splats on the counter
for k in np.arange(1.4, 2.3, 0.3): add(s8, step(), k, 0.7)
add(s8, rustle(0.3), 2.3, 0.6); add(s8, ting(), 2.78, 0.9)
add(s8, ff(noise(1.2), "lowpass=f=300") * 0.2, 3.0, 1.0)
write(ROOT / "audio/shot8.wav", s8)
print("ok 6 7 8")
