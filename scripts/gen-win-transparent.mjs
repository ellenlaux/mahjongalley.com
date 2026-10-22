// Regenerates the transparent moment assets the /win page plays —
// assets/win/<beat>.webp (animated, alpha) and <beat>-poster.png — from
// the clips in assets/win/<beat>.mp4, by keying out the clip's white
// stage. Run from the repo root after replacing a clip:
//   node scripts/gen-win-transparent.mjs
// Needs ffmpeg with libwebp on PATH. The art is cropped to the 720px
// square the moment sits in on the clip stage (1080x1920 recordings).
import { execFileSync } from 'node:child_process';

const BEATS = ['pouch-fill', 'big-money', 'burnt-joker', 'heart-eyes'];
const KEY = 'crop=720:720:180:560,scale=480:480,colorkey=0xFFFFFF:0.10:0.08';
for (const beat of BEATS) {
  const src = `assets/win/${beat}.mp4`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', `${KEY},format=yuva420p`,
    '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '80', '-loop', '0', '-an', `assets/win/${beat}.webp`]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2.6', '-i', src, '-frames:v', '1',
    '-vf', `${KEY},format=rgba`, `assets/win/${beat}-poster.png`]);
  console.log('wrote', beat);
}
