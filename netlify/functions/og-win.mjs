/**
 * og-win — the shared-win preview card PNG (/og/win/<beat>.png?…, a
 * _redirects rewrite; the query string is the client's own and is
 * preserved). The card is the RECEIPT (Ellen 2026-10-22: "you've got
 * receipts"): the moment beside a printed slip that itemizes the win.
 * Words come from win.mjs's closed vocabulary; the sender's name from the
 * invite peek. Unknown beat / any render failure → 302 to the static
 * brand card.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { COURIER_BOLD_B64, COURIER_REGULAR_B64, WIN_ART_B64 } from './og-win-assets.mjs';
import { fetchPeek } from './peeks.mjs';
import { parseWin, receiptDate } from './win.mjs';

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

/** The lines on the slip — [left, right] pairs, or a single centered line,
 *  or '---' for a rule. Shared with the page's script in spirit; the page
 *  builds its own from the same data. */
export function receiptLines(win, name) {
  const pts = win.points ? `${win.points} PTS` : null;
  const lines = [
    { c: 'MAHJONG ALLEY', bold: true, spaced: true },
    { c: 'AMERICAN MAHJONG', small: true },
    '---',
  ];
  if (win.date) lines.push({ l: 'DATE', r: receiptDate(win.date) });
  if (name) lines.push({ l: 'PLAYER', r: name.toUpperCase() });
  if (win.date || name) lines.push('---');
  lines.push({ c: 'MAHJONG!', bold: true, big: true });
  // Line items, receipt-style: a quantity, the thing, the price.
  if (win.handLine) lines.push({ q: 1, l: win.handLine.toUpperCase(), r: pts ?? '' });
  else if (pts) lines.push({ q: 1, l: 'HAND', r: pts });
  if (win.pattern) lines.push({ l: win.pattern, r: '', indent: true, dim: true });
  for (const chip of win.chips) {
    const streak = /^(\d+)-win streak$/i.exec(chip);
    if (streak) lines.push({ q: Number(streak[1]), l: 'WIN STREAK', r: '' });
    else lines.push({ q: 1, l: chip.toUpperCase().replace('!', ''), r: '' });
  }
  lines.push('---');
  lines.push({ l: 'TOTAL', r: pts ?? '—', bold: true });
  lines.push('---');
  lines.push({ c: 'THANK YOU · PLAY AGAIN SOON' });
  return lines;
}

function slip(lines, art) {
  const rows = lines.map((line) => {
    if (line === '---') {
      return el('div', { display: 'flex', borderBottom: `2px dashed ${INK}`, opacity: 0.35, marginTop: 10, marginBottom: 10 });
    }
    if (line.c !== undefined) {
      return el(
        'div',
        {
          display: 'flex',
          justifyContent: 'center',
          fontSize: line.big ? 38 : line.small ? 16 : 20,
          fontWeight: line.bold ? 700 : 400,
          letterSpacing: line.spaced ? 6 : line.small ? 2 : 0,
          opacity: line.small ? 0.7 : 1,
          marginTop: line.big ? 8 : 2,
          marginBottom: line.big ? 6 : 2,
        },
        line.c,
      );
    }
    const left = [];
    if (line.q !== undefined) left.push(el('div', { display: 'flex', width: 44, flexShrink: 0 }, `${line.q}×`));
    left.push(el('div', { display: 'flex', flexShrink: 1 }, line.l));
    return el(
      'div',
      { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', fontSize: 20, fontWeight: line.bold ? 700 : 400, opacity: line.dim ? 0.8 : 1, paddingLeft: line.indent ? 44 : 0, marginTop: 2, marginBottom: 2 },
      [el('div', { display: 'flex', flexDirection: 'row', flexShrink: 1, paddingRight: 12 }, left), el('div', { display: 'flex', flexShrink: 0 }, line.r)],
    );
  });
  // The barcode: a row of bars of varying width.
  const bars = [];
  const widths = [3, 2, 5, 2, 3, 6, 2, 2, 4, 3, 2, 5, 3, 2, 6, 2, 4, 2, 3, 5, 2, 3, 2, 6, 3, 2, 4, 2, 5, 3];
  for (let i = 0; i < widths.length; i++) {
    bars.push(el('div', { display: 'flex', width: widths[i], height: 38, backgroundColor: i % 2 === 0 ? INK : 'transparent', marginRight: 2 }));
  }
  rows.push(el('div', { display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 14 }, bars));
  rows.push(el('div', { display: 'flex', justifyContent: 'center', fontSize: 18, marginTop: 8, opacity: 0.7 }, 'mahjongalley.com'));
  // The header art: the moment, the way a shop logo tops a receipt.
  rows.unshift(
    el('div', { display: 'flex', justifyContent: 'center', marginTop: -16, marginBottom: -8 }, [
      { type: 'img', props: { src: art, width: 250, height: 250 } },
    ]),
  );
  return el(
    'div',
    { display: 'flex', flexDirection: 'column', width: 520, backgroundColor: PAPER, color: INK, padding: '26px 30px 22px', fontFamily: 'Courier Prime', boxShadow: '0 12px 30px rgba(26,26,46,0.18)', transform: 'rotate(-1.5deg)' },
    rows,
  );
}

function card(win, name) {
  const art = `data:image/png;base64,${WIN_ART_B64[win.beat]}`;
  // The slip stands in the middle of the card and runs off its bottom
  // edge — still printing. What fits: the dragon, the shop, the date and
  // player, MAHJONG!, the first items.
  return el(
    'div',
    { width: W, height: H, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: CREAM, paddingTop: 34, overflow: 'hidden' },
    [slip(receiptLines(win, name), art)],
  );
}

export async function renderWinCardPng(win, name) {
  const svg = await satori(card(win, name), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

export default async (req) => {
  const url = new URL(req.url);
  const fallback = () => Response.redirect(new URL('/assets/og-card.png', url.origin), 302);
  const win = parseWin(url);
  if (!win) return fallback();
  try {
    const peek = win.code ? await fetchPeek('invite', win.code).catch(() => null) : null;
    const png = await renderWinCardPng(win, peek?.displayName ?? null);
    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
    });
  } catch {
    return fallback();
  }
};
