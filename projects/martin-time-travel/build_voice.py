"""Builds the episode voice track and timeline.

Voice A (_3) then voice B (_5). Martin's lines get the series' nerdy-voice
settings. Extra silence goes only between lines (portal, globe, fact boxes);
no spoken word is re-timed except Martin's processed lines.
"""
import json, re, subprocess, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).parent
SR = 48000

# Martin voice settings (keep identical every episode)
MARTIN_PITCH = 1.26   # +4 semitones
MARTIN_SPEED = 1.08   # 8 % faster
MARTIN_FILTER = "highpass=f=180,equalizer=f=1400:t=q:w=1.2:g=6,equalizer=f=3200:t=q:w=1.5:g=3"

# (file, start, end, speaker, text, extra_silence_after)
# cut points taken from word timestamps (PocketSphinx) of the actual recordings
LINES = [
    ("a", 0.00, 0.70, "N", "This is Martin.", 0),
    ("a", 1.18, 4.40, "N", "A portal in his room sends him to a random moment in history.", 0.6),
    ("a", 4.92, 7.16, "M", "Please… let it be good this time.", 3.0),
    ("a", 7.73, 8.53, "N", "Montana.", 0),
    ("a", 8.78, 10.69, "N", "Sixty-eight million years ago.", 0.4),
    ("a", 11.22, 13.96, "N", "A swampy world… ruled by dinosaurs.", 0.4),
    ("a", 14.46, 16.74, "N", "And on top… Tyrannosaurus rex.", 0.9),
    ("b", 0.00, 1.95, "N", "They only lived about thirty years.", 0.3),
    ("a", 17.08, 19.53, "N", "Twelve meters long. Nine tons.", 7.9),
    ("b", 8.90, 9.82, "M", "You saw that?", 1.9),
    ("b", 3.72, 5.74, "N", "Its favorite food? Triceratops.", 0.3),
    ("a", 21.77, 24.07, "N", "A bite a hundred times stronger than yours.", 0.3),
    ("a", 19.92, 21.45, "N", "Teeth as long as a banana.", 1.7),
    ("c", 0.00, 0.98, "M", "That's crazy.", 3.0),
    ("b", 2.62, 3.26, "M", "Oh shit.", 0.1),
    ("b", 15.06, 16.04, "N", "Martin ran.", 3.4),
    ("c", 1.20, 3.30, "M", "Oof, glad that's over.", 1.6),
]
# natural gap kept between consecutive lines of the same file
LEAD_IN = 0.5


def load(path):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def ffx(x, filt):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", filt, "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).copy()


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 1
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith("le"):
        n -= 1
    return max(1, n)


def word_times(text, t0, t1):
    words = text.split()
    wts = [syllables(w) + (0.6 if re.search(r"[.,?…]$", w) else 0) for w in words]
    tot = sum(wts)
    res, t = [], t0
    for w, k in zip(words, wts):
        d = (t1 - t0) * k / tot
        res.append({"w": w, "t0": round(t, 3), "t1": round(t + d, 3)})
        t += d
    return res


def main():
    src = {"a": load(ROOT / "audio/voice_a.wav"), "b": load(ROOT / "audio/voice_b.wav"), "c": load(ROOT / "audio/voice_c.wav")}
    out = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    timeline = []
    prev = None
    for i, (f, a, b, spk, text, extra) in enumerate(LINES):
        if prev is not None:
            pf, pb = prev
            gap = (a - pb) if (pf == f and 0 < a - pb < 1.2) else 0.35
            gap = max(gap, 0.12)
            out.append(np.zeros(int(gap * SR), np.float32)); t += gap
        seg = src[f][int(a * SR):int(b * SR)]
        if spk == "M":
            seg = ffx(seg, f"asetrate={int(SR*MARTIN_PITCH)},aresample={SR},"
                           f"atempo={MARTIN_SPEED/MARTIN_PITCH:.4f},{MARTIN_FILTER}")
        fade = int(0.01 * SR)
        seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        d = len(seg) / SR
        # speech bounds inside the cut (trim ~50 ms pads)
        timeline.append({"id": i, "speaker": spk, "text": text, "t0": round(t + 0.04, 3),
                         "t1": round(t + d - 0.04, 3),
                         "words": word_times(text, t + 0.04, t + d - 0.04)})
        out.append(seg); t += d
        if extra:
            out.append(np.zeros(int(extra * SR), np.float32)); t += extra
        prev = (f, b)
    y = np.concatenate(out)
    with wave.open(str(ROOT / "audio/voice.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    dur = len(y) / SR
    json.dump({"fps": 30, "duration": round(dur, 3), "frames": int(round(dur * 30)), "lines": timeline},
              open(ROOT / "work/timeline.json", "w"), indent=1)
    for l in timeline:
        print(f"{l['t0']:6.2f}-{l['t1']:6.2f} {l['speaker']} {l['text']}")
    print("duration", round(dur, 2))


if __name__ == "__main__":
    main()
