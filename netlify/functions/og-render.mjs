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
 * Palette mirrors the site/app: cream #F2E8D5, ink-navy #1A1A2E,
 * dim #5A5F72, cobalt #536AFA.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { INTER_BOLD_B64, INTER_SEMIBOLD_B64, TILE_PNG_B64 } from './og-assets.mjs';

const W = 1200;
const H = 630;
const CREAM = '#F2E8D5';
const NAVY = '#1A1A2E';
const DIM = '#5A5F72';
const COBALT = '#536AFA';

const TILE_DATA_URL = `data:image/png;base64,${TILE_PNG_B64}`;

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;

const FONTS = [
  { name: 'Inter', data: fontBuf(INTER_BOLD_B64), weight: 700, style: 'normal' },
  { name: 'Inter', data: fontBuf(INTER_SEMIBOLD_B64), weight: 600, style: 'normal' },
];

// satori element helpers (object trees, no JSX).
const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

/**
 * The card: tile art left, text column right.
 *   title    — big navy line(s): "ElleBell's Table" / "DayRay"
 *   subtitle — cobalt status line: "2/4 seated · Live" / "wants to be friends"
 *   footer   — dim brand line.
 */
function card({ title, subtitle }) {
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
      backgroundColor: CREAM,
      padding: '60px 80px',
      fontFamily: 'Inter',
    },
    [
      {
        type: 'img',
        props: { src: TILE_DATA_URL, width: 312, height: 400, style: { flexShrink: 0 } },
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
            'Mahjong Alley · American Mah Jongg, with friends.',
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
