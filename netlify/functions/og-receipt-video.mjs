/**
 * og-receipt-video — the receipt's preview card as a short VIDEO
 * (/og/receipt-video/<moment>.mp4?…, a _redirects rewrite; the query is
 * the client's own). Ellen 2026-10-23: "the dragon is animated on the
 * receipt" — Messages previews either og:video or og:image, never both,
 * so the video IS the card: the same slip as the PNG, with the moment's
 * clip composed live in its header, the whole take, then Messages loops
 * it.
 *
 * Built per receipt on first request and cached at the edge: the card is
 * rendered with the art's box left empty, the moment's small square clip
 * (embedded, white stage) is keyed and rotated with the slip, and ffmpeg
 * (ffmpeg-static) composes the two. Unknown moment, a moment with no
 * clip, or any failure → 404, and the preview falls back to og:image.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { CARD_CLIP_B64 } from './og-receipt-assets.mjs';
import { ART_PX, CARD_H, CARD_W, cardLayout, renderReceiptCardPng, slipHeight } from './og-receipt.mjs';
import { fetchPeek, withBoardRows, withSeatNames } from './peeks.mjs';
import { HAS_ART, parseReceipt } from './receipt.mjs';

const run = promisify(execFile);
/** The video's side. Smaller than the PNG: it encodes in the function's
 *  time budget and Messages shows it at bubble width anyway. */
export const VIDEO_PX = 800;
const TILT_DEG = -1.5;
const FPS = 20;

/** The art's centre on the card, after the slip's tilt about its own
 *  centre (the art sits straight above that centre, so the tilt walks it
 *  sideways by d·sin θ). In card pixels. */
export function artCentre(r, name, slipH) {
  const { tall, slipW } = cardLayout(r, name);
  const left = (CARD_W - slipW) / 2;
  const top = tall ? 40 : (CARD_H - slipH) / 2;
  // Slip padding-top 30 and the art row's -20 margin put the art box 10px
  // under the slip's top edge.
  const cx0 = left + slipW / 2;
  const cy0 = top + 10 + ART_PX / 2;
  const d = slipH / 2 - (10 + ART_PX / 2);
  const th = (TILT_DEG * Math.PI) / 180;
  return { x: cx0 + d * Math.sin(th), y: cy0 + d * (1 - Math.cos(th)) };
}

export async function renderReceiptCardMp4(r, name) {
  const dir = await mkdtemp(join(tmpdir(), 'receipt-video-'));
  try {
    const card = join(dir, 'card.png');
    const clip = join(dir, 'clip.mp4');
    const out = join(dir, 'out.mp4');
    const [png, slipH] = await Promise.all([renderReceiptCardPng(r, name, { hole: true }), slipHeight(r, name)]);
    await Promise.all([writeFile(card, png), writeFile(clip, Buffer.from(CARD_CLIP_B64[r.moment], 'base64'))]);
    const scale = VIDEO_PX / CARD_W;
    const c = artCentre(r, name, slipH);
    const art = Math.round(ART_PX * scale);
    const cx = (c.x * scale).toFixed(1);
    const cy = (c.y * scale).toFixed(1);
    const filter = [
      `[0:v]scale=${VIDEO_PX}:${VIDEO_PX}[bg]`,
      `[1:v]scale=${art}:${art},colorkey=0xFFFFFF:0.10:0.08,format=rgba,rotate=${TILT_DEG}*PI/180:c=none:ow=rotw(${TILT_DEG}*PI/180):oh=roth(${TILT_DEG}*PI/180)[art]`,
      `[bg][art]overlay=x=${cx}-w/2:y=${cy}-h/2:shortest=1,format=yuv420p`,
    ].join(';');
    await run(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-loop', '1', '-i', card,
      '-i', clip,
      '-filter_complex', filter,
      '-r', String(FPS), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-movflags', '+faststart', '-an',
      out,
    ], { timeout: 20_000 });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export default async (req) => {
  const url = new URL(req.url);
  // The seats of a Social Play hand, named from the finished game (null-safe).
  const r = await withBoardRows(await withSeatNames(parseReceipt(url)));
  if (!r || !HAS_ART.has(r.moment)) return new Response('no clip for this receipt', { status: 404 });
  try {
    const peek = r.code ? await fetchPeek('invite', r.code).catch(() => null) : null;
    const mp4 = await renderReceiptCardMp4(r, peek?.displayName ?? null);
    return new Response(mp4, {
      status: 200,
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(mp4.length),
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=86400',
        'netlify-cdn-cache-control': 'public, max-age=604800, durable',
        'netlify-vary': 'query',
      },
    });
  } catch (e) {
    console.error('og-receipt-video', e?.message ?? e);
    return new Response('could not render', { status: 404 });
  }
};
