# Martin's time travel series: the series bible

Everything the series owner has asked for so far, in one place. Read it before touching an episode.
The owner's `time-travel-short` and `cartoon-audio-short` skills still apply; where this file is more
specific, this file wins, because it records what the owner asked for after watching real renders.

## How an episode is made (always in this order)

1. The owner explains the trip. Restate it as a short list and wait for an OK. Build nothing before that.
2. Write the script: narrator lines plus Martin's few lines, each marked. Give a clean paste block for the
   owner's voice tool. The owner records it and uploads the audio.
3. **Transcribe the recordings before cutting anything** (`asr.py`, see Audio). The order inside the files
   has differed from the pasted script before, and lines were recorded that were never in the script.
4. Build, then send a stills contact sheet for approval before the full render.
5. Render, check, send the MP4. A change the owner asks for applies to that episode only, unless they say
   "always".

## Martin (never redesign him)

- Built in `src/martin.js`. Same body, outfit and face in every episode. `reference/reference_frame.png` is
  the owner's original look; `reference/stills-contact-sheet.jpg` is the approved episode 1 look.
- Tall, very skinny, long thin limbs with visible arm and leg hair.
- Bald on top with a few loose strands, messy brown hair on the sides and back, thick dark eyebrows,
  light stubble.
- Big thick black rectangular glasses, sleepy half closed eyes, red pimples on his left cheek.
- Open red short sleeve shirt over a white T shirt, blue swim shorts with white hibiscus flowers and a
  white drawstring, black slide sandals.
- Hands really grip what they hold (no floating props).
- 3D only. Snappy, jointed slapstick movement for action (dives, trips, scrambling up, flailing runs);
  calm idle breathing for quiet moments.

### Martin talks only when the owner gives him a line

- Episode 1 lines: "Please… let it be good this time." (before the portal), "You saw that?",
  "That's crazy." and "Oh shit." (to the camera, fourth wall), "Oof, glad that's over." (home, last line).
- When he speaks to the viewer he turns his body and head to the camera, scared or amazed.
- His voice: the owner records it in the narrator's voice; `build_voice.py` makes it nerdy with fixed
  settings: pitch x1.26 (+4 semitones), 8 % faster, high pass 180 Hz, +6 dB at 1.4 kHz, +3 dB at
  3.2 kHz. Keep these identical every episode.

## How every episode starts

1. **His room** (`buildRoom` in `src/sets.js`): olive striped wallpaper with dots, bookshelf, the SPACE
   poster, the old computer with the blue screen, the red cup, bed with the blue blanket, red checkered
   rug, hanging lamp with warm light, film grain and vignette. Top line: `TODAY · HIS ROOM`.
2. He is doing something normal (episode 1: sitting on the bed eating chips; the owner picks the snack).
3. The portal on the right: glowing ring, blue swirl, sparkles. Same design every time, also when it
   opens in the past for the escape.
4. Pre portal line, he walks in, white flash and whoosh.
5. Globe: Earth spins, flies to the region, the region lights up, a pin drops, the place name types on a
   white tag (with typing ticks). Top line changes to `<date> · <PLACE>` when the place is named.
6. Dive into the scene, white flash, he arrives standing and looks around, confused.

## Fact boxes (the owner cares a lot about these)

- Facts are **grouped by context**, never one box per fact and never back to back:
  - When the animal appears: who it is. Box title is the name (`TYRANNOSAURUS REX`), then the lines in
    the owner's order: how long it lived, then size and weight.
  - When it eats or hunts: what it eats. `WHAT IT EATS`, then favorite food, bite force, teeth.
- **The picture freezes for the whole time a box is on screen** (slightly desaturated, a quick white
  flash on the freeze). No cutaways, no roaring, nothing moves while the box is up. The narrator reads
  the facts over the frozen picture, then the box closes and the action resumes.
- The title types out, then each line types out when the narrator says it: a ding at the start of each
  line and a soft tick per letter.
- At least 5 seconds of action between two boxes.
- The box lines must be in the same order the narrator says them. If the recording is in another order,
  reorder the recorded sentences (never the words inside them).
- Check every fact with a web search first and say plainly when a number is a range (episode 1: bite
  force is 35 to 100 times a human's, so the box says "up to 100×").

## Captions

- Full sentences at the bottom, white elegant italic serif (Playfair Display), key words in red with an
  underline. They must match the audio word for word; verify with the transcript, never with the
  pasted script alone.

## Audio

- `asr.py <file.wav>` prints word timestamps (PocketSphinx, ships its own English model, so it works
  without Hugging Face). Use it on every new recording to find the real cut points, and on the finished
  `audio/voice.wav` to confirm the order.
- Never re time words. Add pauses only between lines (portal, globe, freezes, action beats).
- Music bed at 50 % of the voice level (-6 dB gated RMS), SFX about 50 % with peaks capped below the
  voice. One linear gain to about -14 LUFS plus a limiter (`audio.py`).
- The opening music is slow and soft and sits at half the bed level. The owner disliked the quirky
  plucked tune.
- Sounds on everything that moves: stomps with camera shake, roars, chomps and munching, whooshes on
  dives, thuds on landings and falls, sniffs, typing ticks and dings in boxes.

## Camera

- Many angles, never one long static shot: wide establishing shots, over the shoulder from behind Martin,
  low angles on big animals, close ups on Martin's face for every line to camera, extreme close up on an
  eye for a side eye, tracking shots in front of him during chases, side shots for falls and the dive.
- Camera shake on stomps, roars and impacts.

## Story rules learned in episode 1

- When a predator appears, Martin runs and hides (behind a rock). He never just stands in front of it.
- The predator hunts something believable (episode 1: a Triceratops, cartoon, no blood), then eats.
- After the eating facts, Martin reacts to camera; the predator stops eating, side eyes him, roars.
- The chase starts only after Martin's "Oh shit". He trips before the portal, scrambles up, dives in as
  the jaws snap shut.
- The episode ends at home on Martin's relief line. No epilogue (no fossil hunter) unless asked.
- Length 45 to 70 s, 1080x1920, 30 fps MP4. The first frame is the picture, not black (it is the cover
  on Shorts and Reels).

## Production

```bash
cd projects/martin-time-travel
npm install                                   # three.js, map data, fonts
python3 -m venv .asr && .asr/bin/pip install pocketsphinx   # transcription
.asr/bin/python asr.py audio/voice_a.wav      # real word timings of a recording
python3 build_voice.py                        # cut + order lines -> audio/voice.wav, work/timeline.json
./snap.sh check 5 20 40                       # stills at those seconds -> work/check.jpg
python3 audio.py                              # music + SFX + mix -> audio/mix.wav
N=$(python3 -c "import json;print(json.load(open('work/timeline.json'))['frames'])")
for k in 0 1 2; do node render.js work/frames $k $((N-1)) 3 & done; wait
ffmpeg -framerate 30 -i work/frames/%05d.jpg -i audio/mix.wav -c:v libx264 -crf 22 -maxrate 8M \
  -bufsize 16M -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out/episode.mp4
cd ../.. && uv run tools/qc.py --render projects/martin-time-travel/out/episode.mp4
```

Rendering is CPU WebGL in headless Chromium, about 0.5 s a frame, so a minute of video is about 15
minutes with three workers.

### Code map

- `src/martin.js`: Martin's rig, face, expressions, hands. `createCharacter()` also makes other people.
- `src/dinos.js`: T. rex, Triceratops, pterosaurs, the creature skin shader, the walk cycle (`gait`).
- `src/sets.js`: room + portal, globe (real map data, region highlight), swamp, dig site.
- `src/main.js`: the episode: shot list by time, fact boxes, freezes, captions, top line, flashes.
- `build_voice.py`: the line list (source file, cut points, speaker, text, pause after).
- `audio.py`: synthesised SFX and music, timed to the episode, and the mix.

## Episode log

| # | Trip | Status |
|---|------|--------|
| 1 | Montana, 68,000,000 BC, the T. rex hunts a Triceratops | Delivered as v3 (1:02) |
