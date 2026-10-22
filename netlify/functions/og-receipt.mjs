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

const W = 1200;
const H = 630;
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
    return el('div', { display: 'flex', borderBottom: `2px dashed ${INK}`, opacity: 0.35, marginTop: 10, marginBottom: 10 });
  }
  if (entry.c !== undefined) {
    return el(
      'div',
      {
        display: 'flex',
        justifyContent: 'center',
        fontSize: entry.big ? 38 : entry.small ? 16 : 20,
        fontWeight: entry.bold || entry.big ? 700 : 400,
        letterSpacing: entry.big ? 1 : 0,
        marginTop: entry.big ? 8 : 2,
        marginBottom: entry.big ? 6 : 2,
      },
      entry.c,
    );
  }
  const left = [];
  if (entry.q !== undefined) left.push(el('div', { display: 'flex', width: 44, flexShrink: 0 }, `${entry.q}×`));
  left.push(el('div', { display: 'flex', flexShrink: 1 }, entry.l));
  return el(
    'div',
    { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', fontSize: 20, fontWeight: entry.bold ? 700 : 400, opacity: entry.dim ? 0.8 : 1, paddingLeft: entry.indent ? 44 : 0, marginTop: 2, marginBottom: 2 },
    [el('div', { display: 'flex', flexDirection: 'row', flexShrink: 1, paddingRight: 12 }, left), el('div', { display: 'flex', flexShrink: 0 }, entry.r)],
  );
}

function slip(r, name) {
  const rows = [];
  // The header art: the moment (when recorded), then the wordmark — the
  // way a shop's logo tops a receipt.
  if (HAS_ART.has(r.moment)) {
    rows.push(
      el('div', { display: 'flex', justifyContent: 'center', marginTop: -16, marginBottom: -10 }, [
        { type: 'img', props: { src: `data:image/png;base64,${WIN_ART_B64[r.moment]}`, width: 250, height: 250 } },
      ]),
    );
  }
  rows.push(
    el('div', { display: 'flex', justifyContent: 'center', marginTop: HAS_ART.has(r.moment) ? 0 : 10, marginBottom: 6 }, [
      { type: 'img', props: { src: `data:image/png;base64,${WORDMARK_B64}`, width: 334, height: 70 } },
    ]),
  );
  for (const entry of receiptLines(r, name)) rows.push(line(entry));
  // The barcode: a row of bars of varying width.
  const bars = [];
  const widths = [3, 2, 5, 2, 3, 6, 2, 2, 4, 3, 2, 5, 3, 2, 6, 2, 4, 2, 3, 5, 2, 3, 2, 6, 3, 2, 4, 2, 5, 3];
  for (let i = 0; i < widths.length; i++) {
    bars.push(el('div', { display: 'flex', width: widths[i], height: 38, backgroundColor: i % 2 === 0 ? INK : 'transparent', marginRight: 2 }));
  }
  rows.push(el('div', { display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 14 }, bars));
  rows.push(el('div', { display: 'flex', justifyContent: 'center', fontSize: 18, marginTop: 8, opacity: 0.7 }, 'mahjongalley.com'));
  return el(
    'div',
    { display: 'flex', flexDirection: 'column', width: 520, backgroundColor: PAPER, color: INK, padding: '26px 30px 22px', fontFamily: 'Courier Prime', boxShadow: '0 12px 30px rgba(26,26,46,0.18)', transform: 'rotate(-1.5deg)' },
    rows,
  );
}

function card(r, name) {
  // The slip stands in the middle of the card and runs off its bottom
  // edge — still printing. What fits: the art, the wordmark, the date and
  // player, the headline, the first items.
  return el(
    'div',
    { width: W, height: H, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: CREAM, paddingTop: 34, overflow: 'hidden' },
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
