# Stick figure shorts: 2D paper cut-out characters in a 3D world

A reusable setup, not one fixed story. The owner sends a new story each time, shot by shot. What stays is
the look, the way of working and the code. First film made with it: "Salt vs ice" (8 shots, 34 s, a
salt seller wins an ice cream contest at a country fair).

## What the owner asked for next time (read first)

- **Better graphics.** The owner did not like how the first film looked and wants it much closer to the
  reference pictures they sent: those look like a modern game engine, not simple blocky 3D. Aim for:
  - dense, realistic grass with real blades and colour variation, not flat ground with a few blades;
  - full trees with real leaf clusters and soft light through them, not faceted green blobs;
  - rolling hills that read as land in haze, a real sky with soft clouds;
  - warm sunlight, soft contact shadows under every character and prop, gentle depth of field;
  - wooden stalls, carts and tables with real wood texture and wear.
  Compare `reference/current_look_shot*.jpg` (what was made) with the owner's references before building.
- Characters stay as they are drawn in `src/toon.js` (the owner's cast sheet is `reference/cast_salt_vs_ice.png`),
  but each new story brings its own cast and setting.

## The look

- Characters: flat 2D paper cut-outs standing in the 3D world. Big wide egg-shaped white heads with no neck,
  tiny dot eyes, short thick slanted eyebrows, small mouths, bean bodies in flat colours with simple printed
  patterns, thin black stick arms with round dot hands, thin stick legs, thick black outlines, a faint paper
  texture, no gradients.
- Vertical 9:16, 1080x1920, 30 fps.
- No captions, subtitles, logos or watermarks. The only writing allowed is a number on a prop.

## How the owner works

1. Sends each shot as a prompt (style, cast, setting, camera, action, sound) and its length, 4 or 5 s. The
   length comes after the shot text. If it is missing, ask.
2. Each shot is rendered and sent as its own clip, with ambient sound only (no dialogue, narration or music)
   unless asked.
3. At the end: join the shots into one video, then write a narration script timed to the shots so the owner
   can record it; the recording is added afterwards.
4. Speed matters: build several shots at once when they arrive together, render them in parallel.

## Code

- `src/toon.js`: draws characters onto a canvas each frame (`makeToon(kind, variant)`), shown as a card in
  3D with alpha shadows. Poses: `hands`, `head {dx, dy, rot}`, `tilt` (bend at the hips), `walk` (leg cycle),
  `shrug`, `point`, faces (`look`, `angry`, `raise`, `laughEyes`, mouths `smile`, `grr`, `o`, `laugh`,
  `cheer`). Kinds so far: `seller`, `rival`, `judge`, `fairgoer` (variants). Props drawn in the same style:
  `drawSack` (with a number), `drawSpoon`, `drawCone`, `drawRosette`.
- `src/world.js`: the fair (sky, ground, grass, hills, trees, bunting, stalls), the bucket churn (ice, slush,
  frost shell, liftable lid), the prize table, the ice cart with a number sign.
- `src/main.js`: one function per shot (`shot1` .. `shot8`), chosen with `window.SHOT`. Hands land on 3D props
  with `onCard()` (projects a world point onto a character card along the camera ray).
- `sfx.py`: synthesised ambient sound per shot (fair crowd, birds, salt, churn creaks, footsteps, claps ...).

```bash
cd projects/stickman-shorts && npm install && ln -s ../../node_modules node_modules 2>/dev/null
SHOT=3 node render.js work/s3 list 30,60,90          # stills to check
SHOT=3 node render.js work/f3 0 119 2 & SHOT=3 node render.js work/f3 1 119 2 & wait   # full shot
python3 sfx.py                                        # sound (edit which shots it writes)
```

## Lessons

- Do not use `transmission` on materials: in this CPU renderer it took a frame from ~1 s to 20 s.
- Particles (salt, mist) need `frustumCulled = false`, and must sit in front of props or they vanish.
- White salt over a white shirt is invisible: give small grains grey edges and sparkle, or add a thin stream.
- A tall card behind a counter hides the body: size cards so faces sit clearly above props.
- In a vertical frame a long line of people cannot fit: let it run off the edge of frame.
- Shots are deterministic per frame, so a restart only needs the missing frames re-rendered.
