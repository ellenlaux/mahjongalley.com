/**
 * og-render — pure card renderer for the per-table / per-invite link
 * previews (Ellen 2026-07-22: "ElleBell's Table · 2/4 seated" with
 * per-table art instead of the generic brand card).
 *
 * satori (layout → SVG) + resvg (SVG → PNG), fonts and tile art embedded
 * via og-assets.mjs so the bundle is runtime-independent. Kept separate
 * from the function handler so scripts/test-og-local.mjs can render on a
 * dev machine without Netlify.
 *
 * Palette: golden card bg #FBE5AC (Ellen 2026-08-10 — deliberately
 * warmer than the site's cream #F2E8D5; keep scripts/gen-og-card.mjs in
 * sync), ink-navy #1A1A2E, dim #5A5F72, cobalt #536AFA.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
  INTER_BOLD_B64,
  INTER_SEMIBOLD_B64,
  INTER_REGULAR_B64,
  TILE_PNG_B64,
  CODE_ART_PNG_B64,
  INVITE_PILE_PNG_B64,
} from './og-assets.mjs';

const W = 1200;
const H = 630;
const GOLD = '#FBE5AC';
const NAVY = '#1A1A2E';
const DIM = '#5A5F72';
const COBALT = '#536AFA';

const TILE_DATA_URL = `data:image/png;base64,${TILE_PNG_B64}`;
const INVITE_PILE_DATA_URL = `data:image/png;base64,${INVITE_PILE_PNG_B64}`;
const CODE_ART_DATA_URL = `data:image/png;base64,${CODE_ART_PNG_B64}`;
// The promo card's own colours (Ellen's mockup, 2026-10-23): the same
// gold, a pink highlight behind the code, near-black ink.
const CODE_PINK = '#FCAAD5';
const CODE_INK = '#141414';

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;

const FONTS = [
  { name: 'Inter', data: fontBuf(INTER_BOLD_B64), weight: 700, style: 'normal' },
  { name: 'Inter', data: fontBuf(INTER_SEMIBOLD_B64), weight: 600, style: 'normal' },
  { name: 'Inter', data: fontBuf(INTER_REGULAR_B64), weight: 400, style: 'normal' },
];

// satori element helpers (object trees, no JSX).
const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

/**
 * The card: tile art left, text column right.
 *   title    — big navy line(s): "ElleBell's Table" / "DayRay"
 *   subtitle — cobalt status line: "2/4 seated · Live" / "wants to be friends"
 *   footer   — dim brand line.
 */
function card({ title, subtitle, art = TILE_DATA_URL, footer = 'On Mahjong Alley' }) {
  // Length-aware title size so long table names wrap inside the column
  // instead of clipping at the card edge.
  const titleSize = title.length > 40 ? 50 : title.length > 22 ? 60 : 76;
  return el(
    'div',
    {
      width: W,
      height: H,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: GOLD,
      padding: '60px 80px',
      fontFamily: 'Inter',
    },
    [
      {
        type: 'img',
        props: { src: art, width: 312, height: 400, style: { flexShrink: 0 } },
      },
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          marginLeft: 72,
          // Explicit column width — satori's flex sizing lets unbroken
          // long words overflow a flexGrow column; a hard width wraps
          // them reliably. 1200 - 2*80 padding - 312 tile - 72 gap.
          width: 656,
        },
        [
          el(
            'div',
            {
              fontSize: titleSize,
              fontWeight: 700,
              color: NAVY,
              lineHeight: 1.12,
              // satori wraps long names; clamp the block so a huge table
              // name can't push the footer off-card.
              maxHeight: 260,
              overflow: 'hidden',
              display: 'flex',
              paddingRight: 12,
            },
            title,
          ),
          el(
            'div',
            { fontSize: 44, fontWeight: 600, color: COBALT, marginTop: 26, display: 'flex' },
            subtitle,
          ),
          el(
            'div',
            { fontSize: 26, fontWeight: 600, color: DIM, marginTop: 44, display: 'flex', paddingRight: 12 },
            footer,
          ),
        ],
      ),
    ],
  );
}

/** Render the card to PNG bytes. Throws on failure — callers fall back
 *  to the static brand card. */
export async function renderCardPng({ title, subtitle }) {
  const svg = await satori(card({ title, subtitle }), {
    width: W,
    height: H,
    fonts: FONTS,
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return png;
}

/**
 * The promo-code card (/og/code/CODE.png) — Ellen's layout (2026-10-23):
 * her art layer full-bleed (the Joker Exchange tile in pink swirls, left),
 * and on the right plain lines with the code in a pink box:
 *   Lucky, lucky.
 *   This joker is yours to unlock in Mahjong Alley.
 *   [ JOKERX ]
 *   Tap through to claim it, or enter the code in the Shop ⟶
 * Not the table/friend frame on purpose — the gift gets its own card.
 */
export async function renderCodeCardPng({ code }) {
  const para = (text, extra = {}) =>
    el('div', { fontSize: 34, fontWeight: 400, color: CODE_INK, lineHeight: 1.3, display: 'flex', ...extra }, text);
  // A 13-char code (JOKEREXCHANGE) ran off the card at 56px; size by length.
  const codeSize = code.length > 11 ? 38 : code.length > 8 ? 46 : 56;
  const tree = el(
    'div',
    { width: W, height: H, display: 'flex', backgroundColor: GOLD, fontFamily: 'Inter', position: 'relative' },
    [
      { type: 'img', props: { src: CODE_ART_DATA_URL, width: W, height: H, style: { position: 'absolute', top: 0, left: 0 } } },
      el(
        'div',
        { position: 'absolute', left: 640, top: 124, width: 548, display: 'flex', flexDirection: 'column' },
        [
          para('Lucky, lucky.'),
          // Broken by hand so "Alley." never sits alone on a line.
          para('This joker is yours to unlock'),
          para('in Mahjong Alley.'),
          el(
            'div',
            {
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: CODE_PINK,
              color: CODE_INK,
              fontSize: codeSize,
              fontWeight: 700,
              letterSpacing: 1,
              lineHeight: 1,
              padding: '12px 18px',
              marginTop: 26,
            },
            code,
          ),
          // Broken at the comma: a natural wrap left "or enter the" hanging.
          para('Tap through to claim it,', { marginTop: 26 }),
          para('or enter the code in the Shop\u00A0\u27F6'),
        ],
      ),
    ],
  );
  const svg = await satori(tree, { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
