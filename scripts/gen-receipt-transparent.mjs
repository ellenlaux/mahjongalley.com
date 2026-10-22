// Regenerates the transparent moment assets the /win page plays —
// assets/receipt/<beat>.webp (animated, alpha) and <beat>-poster.png — from
// the clips in assets/receipt/<beat>.mp4, by keying out the clip's white
// stage. Run from the repo root after replacing a clip:
//   node scripts/gen-receipt-transparent.mjs
// Needs ffmpeg with libwebp on PATH. The art is cropped to the 720px
// square the moment sits in on the clip stage (1080x1920 recordings).
import { execFileSync } from 'node:child_process';

const BEATS = ['pouch-fill', 'big-money', 'burnt-joker', 'heart-eyes'];
const KEY = 'crop=720:720:180:560,scale=480:480,colorkey=0xFFFFFF:0.10:0.08';
// What the page LOOPS. A moment with an entrance and then a steady beat
// loops only the beat (Ellen 2026-10-22: "the heart eyes just keep
// popping", not the dragon arriving over and over). `start`/`dur` are
// seconds into the source, `dur` a whole number of the beat's cycles so
// the seam is quiet. `src` names a longer take when the share clip is
// too short to hold a full cycle (assets/receipt/src/). `once` plays the
// whole clip one time and holds its last frame — for an arrival that
// settles rather than a beat.
const LOOP = {
  // four hearts, 400 ms apart: 1.6 s a lap — one lap
  'heart-eyes': { start: 2.6, dur: 1.6 },
  // six dollars, 250 ms apart on a 1.5 s lap; all six in flight from
  // 3.5 s after mount (clip starts ~0.4 s after mount) — one lap
  'big-money': { start: 3.1, dur: 1.5 },
  // smoke forever from 3.4 s after mount, a 3.2 s cycle — one cycle,
  // from the longer take (the 5 s share clip holds only 2 s of smoke);
  // the window starts a cycle in, once the smoke is already going
  'burnt-joker': { src: 'assets/receipt/src/burnt-joker-take.mp4', start: 4.45, dur: 3.2 },
  // coins rain in and the big pouch takes over at 1.95 s: an arrival, so
  // it plays once and holds the full pouch
  'pouch-fill': { once: true },
};
for (const beat of BEATS) {
  const loop = LOOP[beat] ?? {};
  const src = loop.src ?? `assets/receipt/${beat}.mp4`;
  const window = loop.start !== undefined ? ['-ss', String(loop.start), '-t', String(loop.dur)] : [];
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...window, '-i', src, '-vf', `${KEY},format=yuva420p`,
    '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '80', '-loop', loop.once ? '1' : '0', '-an', `assets/receipt/${beat}.webp`]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2.6', '-i', `assets/receipt/${beat}.mp4`, '-frames:v', '1',
    '-vf', `${KEY},format=rgba`, `assets/receipt/${beat}-poster.png`]);
  console.log('wrote', beat);
}
