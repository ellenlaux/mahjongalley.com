/**
 * og-win — the shared-win preview card PNG (/og/win/<beat>.png?…, a
 * _redirects rewrite; the query string is the client's own and is
 * preserved). Words come from win.mjs's closed vocabulary; the sender's
 * name from the invite peek. Unknown beat / any render failure → 302 to
 * the static brand card.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { INTER_BOLD_B64, INTER_SEMIBOLD_B64 } from './og-assets.mjs';
import { WIN_ART_B64 } from './og-win-assets.mjs';
import { fetchPeek } from './peeks.mjs';
import { parseWin, winCopy } from './win.mjs';

const W = 1200;
const H = 630;
// One voice: white card, navy ink, the moment art as the picture (Ellen
// 2026-10-22: fewer fonts and colors). The table / invite cards are gold
// with the tile — a different family on purpose: this is a result, not
// an invitation.
const BG = '#FFFFFF';
const NAVY = '#1A1A2E';
const DIM = '#5A5F72';

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
const FONTS = [
  { name: 'Inter', data: fontBuf(INTER_BOLD_B64), weight: 700, style: 'normal' },
  { name: 'Inter', data: fontBuf(INTER_SEMIBOLD_B64), weight: 600, style: 'normal' },
];
const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

function card(win, copy) {
  const art = `data:image/png;base64,${WIN_ART_B64[win.beat]}`;
  const title = copy.who; // "DayRay won" / "Mahjong!"
  const titleSize = title.length > 18 ? 64 : 84;
  const rows = [
    el('div', { fontSize: titleSize, fontWeight: 700, color: NAVY, lineHeight: 1.1, display: 'flex' }, title),
  ];
  if (copy.stat) {
    rows.push(el('div', { fontSize: 46, fontWeight: 700, color: NAVY, marginTop: 18, display: 'flex' }, copy.stat));
  }
  if (win.pattern) {
    rows.push(
      el('div', { fontSize: 44, fontWeight: 600, color: NAVY, marginTop: 14, letterSpacing: 2, display: 'flex' }, win.pattern),
    );
  }
  if (win.chips.length) {
    rows.push(
      el(
        'div',
        { display: 'flex', flexDirection: 'row', marginTop: 22 },
        win.chips.map((c) =>
          el(
            'div',
            {
              fontSize: 26,
              fontWeight: 600,
              color: NAVY,
              backgroundColor: '#ECECEF',
              borderRadius: 999,
              padding: '8px 18px',
              marginRight: 12,
              display: 'flex',
            },
            c,
          ),
        ),
      ),
    );
  }
  rows.push(el('div', { fontSize: 26, fontWeight: 600, color: DIM, marginTop: 'auto', display: 'flex' }, 'On Mahjong Alley'));

  return el(
    'div',
    { width: W, height: H, display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: BG, padding: '56px 72px', fontFamily: 'Inter' },
    [
      { type: 'img', props: { src: art, width: 480, height: 480, style: { flexShrink: 0 } } },
      el('div', { display: 'flex', flexDirection: 'column', marginLeft: 48, width: 528, height: 480 }, rows),
    ],
  );
}

export async function renderWinCardPng(win, name) {
  const svg = await satori(card(win, winCopy(win, name)), { width: W, height: H, fonts: FONTS });
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
