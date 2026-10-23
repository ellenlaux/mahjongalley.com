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
import { fetchPeek } from './peeks.mjs';
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

function slip(r, name) {
  const rows = [];
  // The header art: the moment (when recorded), then the wordmark — the
  // way a shop's logo tops a receipt.
  if (HAS_ART.has(r.moment)) {
    rows.push(
      el('div', { display: 'flex', justifyContent: 'center', marginTop: -20, marginBottom: -16 }, [
        { type: 'img', props: { src: `data:image/png;base64,${WIN_ART_B64[r.moment]}`, width: 300, height: 300 } },
      ]),
    );
  }
  rows.push(
    el('div', { display: 'flex', justifyContent: 'center', marginTop: HAS_ART.has(r.moment) ? 0 : 12, marginBottom: 8 }, [
      { type: 'img', props: { src: `data:image/png;base64,${WORDMARK_B64}`, width: 400, height: 84 } },
    ]),
  );
  for (const entry of receiptLines(r, name)) rows.push(line(entry));
  // The barcode: a row of bars of varying width.
  const bars = [];
  const widths = [3, 2, 5, 2, 3, 6, 2, 2, 4, 3, 2, 5, 3, 2, 6, 2, 4, 2, 3, 5, 2, 3, 2, 6, 3, 2, 4, 2, 5, 3];
  for (let i = 0; i < widths.length; i++) {
    bars.push(el('div', { display: 'flex', width: widths[i] * 1.6, height: 50, backgroundColor: i % 2 === 0 ? INK : 'transparent', marginRight: 3 }));
  }
  rows.push(el('div', { display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 16 }, bars));
  rows.push(el('div', { display: 'flex', justifyContent: 'center', fontSize: 22, marginTop: 10, opacity: 0.7 }, 'mahjongalley.com'));
  return el(
    'div',
    { display: 'flex', flexDirection: 'column', width: 760, backgroundColor: PAPER, color: INK, padding: '30px 40px 30px', fontFamily: 'Courier Prime', boxShadow: '0 20px 50px rgba(26,26,46,0.18)', transform: 'rotate(-1.5deg)' },
    rows,
  );
}

function card(r, name) {
  // A short slip (a loss, a plain win) sits centred on the card; a long
  // one (a win with the math and three chips) starts at the top and may
  // run off the bottom edge — still printing. Satori can't measure, so
  // the height is estimated from the line count.
  const n = receiptLines(r, name).length;
  const estimate = 60 + (HAS_ART.has(r.moment) ? 264 : 0) + 92 + n * 40 + 140;
  const tall = estimate > H - 80;
  return el(
    'div',
    { width: W, height: H, display: 'flex', flexDirection: 'row', alignItems: tall ? 'flex-start' : 'center', justifyContent: 'center', backgroundColor: CREAM, paddingTop: tall ? 40 : 0, overflow: 'hidden' },
    [slip(r, name)],
  );
}

export async function renderReceiptCardPng(r, name) {
  const svg = await satori(card(r, name), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

export default async (req) => {
  const url = new URL(req.url);
  const fallback = () => Response.redirect(new URL('/assets/og-card.png', url.origin), 302);
  const r = parseReceipt(url);
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
