/**
 * og-receipt-print — the receipt PRINTING, as a 9:16 video to post
 * (/og/receipt-print/<moment>.mp4?…, a _redirects rewrite; the query is
 * the receipt link's own). Ellen 2026-10-28: "for the video, the
 * animation of the receipt coming out of the printer" — "with the current
 * info from the game they are sharing about". Built per receipt from the
 * same parse and lines as the page and the card.
 *
 * The app's in-sheet printer (ReceiptSheet), scaled up: one plate, a
 * dark slot, a tear bar; the slip (ReceiptSlip — the card's paper with
 * the link line and a torn edge) tilted −1.5° and fed UP out of it in 32
 * printer steps after a half-second on the empty printer, then held to be
 * read. The paper is clipped where the app's feed clips it, 10 pt under
 * the plate's top edge, with the plate drawn over it. A moment with a
 * clip plays it in the slip's art box, riding the paper, from the start
 * of the print to its payoff, held.
 *
 * Satori + resvg draw the slip and the printer; ffmpeg (ffmpeg-static)
 * moves the one over the other. Cached like og-receipt-video: once per
 * receipt URL at the edge. Unknown moment or any failure → 404.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { Resvg } from '@resvg/resvg-js';
import { CARD_CLIP_B64 } from './og-receipt-assets.mjs';
import { ART_PX, SLIP_W, printSlipHeight, renderPrintSlipPng } from './og-receipt.mjs';
import { fetchPeek, withBoardRows, withSeatNames, withTopTen } from './peeks.mjs';
import { HAS_ART, parseReceipt, receiptLink } from './receipt.mjs';

const run = promisify(execFile);

/** The frame: 9:16 for Reels / TikTok / Stories. */
export const FRAME_W = 1080;
export const FRAME_H = 1920;
export const FPS = 30;
/** The app's timing (ReceiptSheet): a beat on the empty printer, the
 *  feed in 32 printer steps, then the receipt held to be read. */
const HOLD_S = 0.5;
const FEED_S = 2.2;
const STEPS = 32;
export const DURATION_S = 7;
const TILT_DEG = -1.5;
const TILT = (TILT_DEG * Math.PI) / 180;

/** The app's numbers are points at its widest slip (320); the video
 *  scales every one of them by the same factor as the paper. */
const APP_SLIP_W = 320;
/** Room above the finished slip, and under the printer (the platforms
 *  lay their caption and buttons over the foot of a 9:16 frame). */
const TOP = 160;
const FLOOR = 300;
/** Transparent room around the tilted slip in its PNG, in card pixels:
 *  the tilt walks a tall slip's corners out, the shadow falls 70 below. */
const PAD = 100;

const CREAM = '#F2E8D5';
const PLATE = '#E9DFC9';
const SLOT = '#26263A';
const SHADOW = '#1A1A2E';

/**
 * Where everything sits, from the slip's laid-out height at the card's
 * scale. The whole finished slip fits above the printer: a long slip
 * shrinks (slip and printer together) rather than run off the frame.
 */
export function printLayout(slipH) {
  const unit = SLIP_W / APP_SLIP_W; // card px per app pt
  // How much the finished slip stands above the plate's foot, at zoom 1:
  // the slip less the 10 pt the plate covers, the plate (38 pt), and the
  // tilt lifting its top corner.
  const rise = (SLIP_W / 2) * Math.sin(-TILT) + (slipH / 2) * (1 - Math.cos(TILT));
  const need = slipH - 10 * unit + 38 * unit + rise;
  const z = Math.min(1, (FRAME_H - FLOOR - TOP) / need);
  const U = unit * z; // video px per app pt
  const slipW = SLIP_W * z;
  const h = slipH * z;
  const plateW = slipW + 44 * U;
  const plateH = 38 * U;
  const plateX = (FRAME_W - plateW) / 2;
  const plateTop = FRAME_H - FLOOR - plateH;
  // The feed's bottom edge: the app lays the plate 10 pt over it.
  const feedBottom = plateTop + 10 * U;
  const slipLeft = (FRAME_W - slipW) / 2;
  const slipTop = feedBottom - h;
  return { z, U, slipW, slipH: h, plateX, plateTop, plateW, plateH, feedBottom, slipLeft, slipTop, drop: h + 24 * U };
}

/** The printer and the floor under the feed, as one transparent PNG
 *  band from just above the plate to the frame's foot: everything below
 *  the feed's edge is the cream room (the paper still inside the printer
 *  never shows), then the plate's shadow, the plate, the slot, the tear
 *  bar's teeth — ReceiptSheet's Printer, at video scale. */
export function machinePng(L) {
  const { U, plateX, plateTop, plateW, plateH, feedBottom } = L;
  const top = Math.floor(plateTop - 20 * U);
  const y = (v) => (v - top).toFixed(2);
  const teethY = plateTop + (9 + 11 + 2) * U;
  const teeth = [];
  for (let i = 0; i < Math.ceil((APP_SLIP_W + 16) / 8); i++) {
    const x = plateX + 14 * U + i * 8 * U;
    if (x + 8 * U > plateX + plateW - 14 * U + 0.01) break;
    teeth.push(`${x.toFixed(2)},${y(teethY + 6 * U)} ${(x + 4 * U).toFixed(2)},${y(teethY)} ${(x + 8 * U).toFixed(2)},${y(teethY + 6 * U)}`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H - top}" viewBox="0 0 ${FRAME_W} ${FRAME_H - top}">
  <defs><filter id="s" x="-10%" y="-100%" width="120%" height="400%"><feGaussianBlur stdDeviation="${(6 * U).toFixed(2)}"/></filter></defs>
  <rect x="0" y="${y(feedBottom)}" width="${FRAME_W}" height="${(FRAME_H - feedBottom).toFixed(2)}" fill="${CREAM}"/>
  <rect x="${plateX.toFixed(2)}" y="${y(plateTop + 8 * U)}" width="${plateW.toFixed(2)}" height="${plateH.toFixed(2)}" rx="${(10 * U).toFixed(2)}" fill="${SHADOW}" fill-opacity="0.12" filter="url(#s)"/>
  <rect x="${plateX.toFixed(2)}" y="${y(plateTop)}" width="${plateW.toFixed(2)}" height="${plateH.toFixed(2)}" rx="${(10 * U).toFixed(2)}" fill="${PLATE}"/>
  <rect x="${(plateX + 14 * U).toFixed(2)}" y="${y(plateTop + 9 * U)}" width="${(plateW - 28 * U).toFixed(2)}" height="${(11 * U).toFixed(2)}" rx="${(3 * U).toFixed(2)}" fill="${SLOT}"/>
  <g fill="${SLOT}" fill-opacity="0.35">${teeth.map((p) => `<polygon points="${p}"/>`).join('')}</g>
</svg>`;
  return { png: new Resvg(svg).render().asPng(), top };
}

/** The feed as an ffmpeg expression in t: the slip's drop below its
 *  resting place — all of it until the print starts, then 1/32 less at
 *  each step (Easing.steps(32) rounding up, as the app's withTiming). */
function dropExpr(drop) {
  return `${drop.toFixed(2)}*(1-clip(ceil((t-${HOLD_S})/${FEED_S}*${STEPS}),0,${STEPS})/${STEPS})`;
}

export async function renderReceiptPrintMp4(r, name, { threads = 0 } = {}) {
  const hole = HAS_ART.has(r.moment) && !!CARD_CLIP_B64[r.moment];
  const link = receiptLink(r, name).label;
  const slipH = await printSlipHeight(r, name, { hole, link });
  const L = printLayout(slipH);
  const dir = await mkdtemp(join(tmpdir(), 'receipt-print-'));
  try {
    const slipFile = join(dir, 'slip.png');
    const machineFile = join(dir, 'machine.png');
    const clipFile = join(dir, 'clip.mp4');
    const out = join(dir, 'out.mp4');
    const machine = machinePng(L);
    await Promise.all([
      renderPrintSlipPng(r, name, { hole, link, height: slipH, pad: PAD, zoom: L.z }).then((png) => writeFile(slipFile, png)),
      writeFile(machineFile, machine.png),
      hole ? writeFile(clipFile, Buffer.from(CARD_CLIP_B64[r.moment], 'base64')) : null,
    ]);
    const drop = dropExpr(L.drop);
    const sx = (L.slipLeft - PAD * L.z).toFixed(2);
    const sy = (L.slipTop - PAD * L.z).toFixed(2);
    const inputs = [
      '-f', 'lavfi', '-i', `color=c=0x${CREAM.slice(1)}:s=${FRAME_W}x${FRAME_H}:r=${FPS}:d=${DURATION_S}`,
      '-loop', '1', '-framerate', String(FPS), '-i', slipFile,
      '-loop', '1', '-framerate', String(FPS), '-i', machineFile,
      // Silent stereo: a video-only file is refused by some upload paths.
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    ];
    const graph = [
      '[0:v]format=rgb24[bg]',
      `[1:v]format=rgba[slip]`,
      `[bg][slip]overlay=x=${sx}:y='${sy}+${drop}':eval=frame:format=rgb[paper]`,
    ];
    let paper = 'paper';
    if (hole) {
      inputs.push('-i', clipFile);
      // The art box's centre on the tilted slip at rest: straight above the
      // slip's centre, walked sideways by the tilt (as og-receipt-video).
      const art = Math.round(ART_PX * L.z);
      const d = L.slipH / 2 - (10 + ART_PX / 2) * L.z;
      const ax = (FRAME_W / 2 + d * Math.sin(TILT)).toFixed(2);
      const ay = (L.slipTop + L.slipH / 2 - d * Math.cos(TILT)).toFixed(2);
      graph.push(
        // The moment starts as the print does and lands on its payoff,
        // which holds (overlay repeats a finished input's last frame).
        `[4:v]fps=${FPS},scale=${art}:${art},colorkey=0xFFFFFF:0.10:0.08,format=rgba,rotate=${TILT_DEG}*PI/180:c=none:ow=rotw(${TILT_DEG}*PI/180):oh=roth(${TILT_DEG}*PI/180),tpad=start_duration=${HOLD_S}:start_mode=clone[art]`,
        `[paper][art]overlay=x=${ax}-w/2:y='${ay}-h/2+${drop}':eval=frame:format=rgb[paperart]`,
      );
      paper = 'paperart';
    }
    graph.push(`[${paper}][2:v]overlay=x=0:y=${machine.top}:format=rgb,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]`);
    await run(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...(threads ? ['-filter_threads', String(threads)] : []),
      ...inputs,
      '-filter_complex', graph.join(';'),
      '-map', '[v]', '-map', '3:a',
      '-t', String(DURATION_S), '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      ...(threads ? ['-threads', String(threads)] : []),
      '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      out,
    ], { timeout: 50_000 });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export default async (req) => {
  const url = new URL(req.url);
  // The seats of a Social Play hand, named from the finished game; a
  // board's rows; a daily's top ten from its day's board (all null-safe).
  const r = await withTopTen(await withBoardRows(await withSeatNames(parseReceipt(url))));
  if (!r) return new Response('no such receipt', { status: 404 });
  try {
    const peek = r.code ? await fetchPeek('invite', r.code).catch(() => null) : null;
    const mp4 = await renderReceiptPrintMp4(r, peek?.displayName ?? null);
    return new Response(mp4, {
      status: 200,
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(mp4.length),
        // No accept-ranges: the file is a download (the app fetches it
        // whole to hand to Instagram), and this function answers no Range.
        'cache-control': 'public, max-age=86400',
        'netlify-cdn-cache-control': 'public, max-age=604800, durable',
        'netlify-vary': 'query',
      },
    });
  } catch (e) {
    console.error('og-receipt-print', e?.message ?? e);
    return new Response('could not render', { status: 404 });
  }
};
