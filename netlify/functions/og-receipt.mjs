/**
 * og-receipt — the receipt's preview card PNG (/og/receipt/<moment>.png?…,
 * a _redirects rewrite; the query string is the client's own and is
 * preserved). The card IS the receipt (Ellen 2026-10-22: "you've got
 * receipts"): the moment's art as the slip's header, the wordmark, then
 * the lines receipt.mjs prints. Words come from its closed vocabulary; the
 * sender's name from the invite peek. Unknown moment / any render failure
 * → 302 to the static brand card.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { COURIER_BOLD_B64, COURIER_REGULAR_B64, WIN_ART_B64, WORDMARK_B64 } from './og-receipt-assets.mjs';
import { fetchPeek, withBoardRows, withSeatNames, withTopTen } from './peeks.mjs';
import { HAS_ART, parseReceipt, receiptLines } from './receipt.mjs';

// A SQUARE card: Messages lays it at full bubble width, so the whole slip
// reads — the art, the lines, TOTAL (Ellen 2026-10-23).
const W = 1200;
const H = 1200;
const CREAM = '#F2E8D5';
const PAPER = '#FFFFFF';
const INK = '#1A1A2E';

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
const FONTS = [
  { name: 'Courier Prime', data: fontBuf(COURIER_REGULAR_B64), weight: 400, style: 'normal' },
  { name: 'Courier Prime', data: fontBuf(COURIER_BOLD_B64), weight: 700, style: 'normal' },
];
const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

function line(entry) {
  if (entry === '---') {
    return el('div', { display: 'flex', borderBottom: `3px dashed ${INK}`, opacity: 0.35, marginTop: 12, marginBottom: 12 });
  }
  if (entry.c !== undefined) {
    return el(
      'div',
      {
        display: 'flex',
        justifyContent: 'center',
        fontSize: entry.big ? 52 : entry.small ? 22 : 27,
        fontWeight: entry.bold || entry.big ? 700 : 400,
        letterSpacing: entry.big ? 1 : 0,
        marginTop: entry.big ? 8 : 2,
        marginBottom: entry.big ? 8 : 2,
      },
      entry.c,
    );
  }
  const left = [];
  if (entry.q !== undefined) left.push(el('div', { display: 'flex', width: 60, flexShrink: 0 }, `${entry.q}×`));
  left.push(el('div', { display: 'flex', flexShrink: 1 }, entry.l));
  return el(
    'div',
    { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', fontSize: 27, fontWeight: entry.bold ? 700 : 400, opacity: entry.dim ? 0.8 : 1, paddingLeft: entry.indent ? 60 : 0, marginTop: 2, marginBottom: 2 },
    [el('div', { display: 'flex', flexDirection: 'row', flexShrink: 1, paddingRight: 12 }, left), el('div', { display: 'flex', flexShrink: 0 }, entry.r)],
  );
}

const SLIP_W = 760;
export const ART_PX = 300;

/** `hole`: leave the art's box empty (the card video composes the live
 *  clip there) — same size, so the lines land where the PNG's do. */
function slip(r, name, hole = false) {
  return el(
    'div',
    { display: 'flex', flexDirection: 'column', width: SLIP_W, backgroundColor: PAPER, color: INK, padding: '30px 40px 30px', fontFamily: 'Courier Prime', boxShadow: '0 20px 50px rgba(26,26,46,0.18)', transform: 'rotate(-1.5deg)' },
    slipRows(r, name, hole),
  );
}

/** What the slip prints, top to bottom: the moment's art (or its hole),
 *  the wordmark, the lines, the one link line when `link` is given (the
 *  printing video's slip — the app's slip prints it; the card leaves it
 *  to the page), the barcode, the site. */
function slipRows(r, name, hole, link = null) {
  const rows = [];
  // The header art: the moment (when recorded), then the wordmark — the
  // way a shop's logo tops a receipt.
  if (HAS_ART.has(r.moment)) {
    rows.push(
      el('div', { display: 'flex', justifyContent: 'center', marginTop: -20, marginBottom: -16 }, [
        hole
          ? el('div', { display: 'flex', width: ART_PX, height: ART_PX })
          : { type: 'img', props: { src: `data:image/png;base64,${WIN_ART_B64[r.moment]}`, width: ART_PX, height: ART_PX } },
      ]),
    );
  }
  rows.push(
    el('div', { display: 'flex', justifyContent: 'center', marginTop: HAS_ART.has(r.moment) ? 0 : 12, marginBottom: 8 }, [
      { type: 'img', props: { src: `data:image/png;base64,${WORDMARK_B64}`, width: 400, height: 84 } },
    ]),
  );
  for (const entry of receiptLines(r, name)) rows.push(line(entry));
  // The one link, printed where a receipt prints its web address — the
  // app's ReceiptSlip link box, at the slip's type scale (13 pt → 27 px).
  if (link) {
    rows.push(
      el('div', { display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 25, marginBottom: 8, padding: '21px 17px', minHeight: 91, borderWidth: 4, borderStyle: 'solid', borderColor: INK, borderRadius: 8, fontSize: 31, fontWeight: 700, letterSpacing: 2 }, link),
    );
  }
  // The barcode: a row of bars of varying width.
  const bars = [];
  const widths = [3, 2, 5, 2, 3, 6, 2, 2, 4, 3, 2, 5, 3, 2, 6, 2, 4, 2, 3, 5, 2, 3, 2, 6, 3, 2, 4, 2, 5, 3];
  for (let i = 0; i < widths.length; i++) {
    bars.push(el('div', { display: 'flex', width: widths[i] * 1.6, height: 50, backgroundColor: i % 2 === 0 ? INK : 'transparent', marginRight: 3 }));
  }
  rows.push(el('div', { display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 16 }, bars));
  rows.push(el('div', { display: 'flex', justifyContent: 'center', fontSize: 22, marginTop: 10, opacity: 0.7 }, 'mahjongalley.com'));
  return rows;
}

// The torn bottom edge — the app's TornEdge (14 × 8 pt teeth) at the
// slip's scale: paper triangles pointing down, the room showing between.
const TEAR_W = 33;
const TEAR_H = 19;
function tornEdge() {
  const pts = ['0,0'];
  for (let i = 0; i < Math.ceil(SLIP_W / TEAR_W); i++) pts.push(`${i * TEAR_W + TEAR_W / 2},${TEAR_H}`, `${(i + 1) * TEAR_W},0`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIP_W}" height="${TEAR_H}" viewBox="0 0 ${SLIP_W} ${TEAR_H}"><polygon points="${pts.join(' ')}" fill="${PAPER}"/></svg>`;
  return { type: 'img', props: { src: `data:image/svg+xml;base64,${btoa(svg)}`, width: SLIP_W, height: TEAR_H } };
}

/** The slip as the printer feeds it (og-receipt-print): the app's
 *  ReceiptSlip — the card's paper with the one link line and a torn
 *  bottom edge — tilted as one piece about its centre. */
function printSlip(r, name, hole, link) {
  return el('div', { display: 'flex', flexDirection: 'column', width: SLIP_W, transform: 'rotate(-1.5deg)' }, [
    el('div', { display: 'flex', flexDirection: 'column', backgroundColor: PAPER, color: INK, padding: '30px 40px 19px', fontFamily: 'Courier Prime', boxShadow: '0 20px 50px rgba(26,26,46,0.18)' }, slipRows(r, name, hole, link)),
    tornEdge(),
  ]);
}

/** The printed slip's laid-out height at the card's scale (SLIP_W wide). */
export async function printSlipHeight(r, name, { hole = false, link = null } = {}) {
  const svg = await satori(printSlip(r, name, hole, link), { width: SLIP_W, fonts: FONTS });
  const m = svg.match(/height="(\d+(?:\.\d+)?)"/);
  return m ? Number(m[1]) : H;
}

/** The printed slip as a transparent PNG, tilted, with `pad` card pixels
 *  of room on every side for the tilt and the shadow, scaled by `zoom`.
 *  The slip's own (untilted) box sits at (pad, pad) · zoom. */
export async function renderPrintSlipPng(r, name, { hole = false, link = null, height, pad, zoom }) {
  const root = el('div', { display: 'flex', width: SLIP_W + 2 * pad, height: height + 2 * pad, padding: pad }, [printSlip(r, name, hole, link)]);
  const svg = await satori(root, { width: SLIP_W + 2 * pad, height: height + 2 * pad, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom } }).render().asPng();
}

export { SLIP_W };

/** Where the slip lands on the card, for the video's overlay: estimated
 *  the way `card` lays it out (satori can't report positions). */
export function cardLayout(r, name) {
  const n = receiptLines(r, name).length;
  const estimate = 60 + (HAS_ART.has(r.moment) ? 264 : 0) + 92 + n * 40 + 140;
  return { tall: estimate > H - 80, slipW: SLIP_W };
}

function card(r, name, hole = false) {
  // A short slip (a loss, a plain win) sits centred on the card; a long
  // one (a win with the math and three chips) starts at the top and may
  // run off the bottom edge — still printing. Satori can't measure, so
  // the height is estimated from the line count.
  const { tall } = cardLayout(r, name);
  return el(
    'div',
    { width: W, height: H, display: 'flex', flexDirection: 'row', alignItems: tall ? 'flex-start' : 'center', justifyContent: 'center', backgroundColor: CREAM, paddingTop: tall ? 40 : 0, overflow: 'hidden' },
    [slip(r, name, hole)],
  );
}

/** The slip's rendered height, by laying it out alone at its width. */
export async function slipHeight(r, name) {
  const svg = await satori(slip(r, name, true), { width: SLIP_W, fonts: FONTS });
  const m = svg.match(/height="(\d+(?:\.\d+)?)"/);
  return m ? Number(m[1]) : H;
}

export { W as CARD_W, H as CARD_H };

export async function renderReceiptCardPng(r, name, { hole = false } = {}) {
  const svg = await satori(card(r, name, hole), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

export default async (req) => {
  const url = new URL(req.url);
  const fallback = () => Response.redirect(new URL('/assets/og-card.png', url.origin), 302);
  // The seats of a Social Play hand, named from the finished game; a
  // board's rows; a daily's top ten from its day's board (all null-safe).
  const r = await withTopTen(await withBoardRows(await withSeatNames(parseReceipt(url))));
  if (!r) return fallback();
  try {
    const peek = r.code ? await fetchPeek('invite', r.code).catch(() => null) : null;
    const png = await renderReceiptCardPng(r, peek?.displayName ?? null);
    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
    });
  } catch {
    return fallback();
  }
};
