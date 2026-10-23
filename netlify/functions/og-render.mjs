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
  JOKER_PNG_B64,
  INVITE_PILE_PNG_B64,
} from './og-assets.mjs';

const W = 1200;
const H = 630;
const GOLD = '#FBE5AC';
const NAVY = '#1A1A2E';
const DIM = '#5A5F72';
const COBALT = '#536AFA';

const TILE_DATA_URL = `data:image/png;base64,${TILE_PNG_B64}`;
const JOKER_DATA_URL = `data:image/png;base64,${JOKER_PNG_B64}`;
const INVITE_PILE_DATA_URL = `data:image/png;base64,${INVITE_PILE_PNG_B64}`;

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
 * The promo-code card (/og/code/CODE.png): the Joker Exchange tile art
 * with the code as the cobalt line. Same frame as the table/friend cards
 * so a teacher's text looks like it came from the same place.
 */
export async function renderCodeCardPng({ code }) {
  const svg = await satori(
    card({
      title: 'A rare joker is waiting',
      subtitle: `Code: ${code}`,
      art: JOKER_DATA_URL,
      footer: 'Shop → Have a code? · Mahjong Alley',
    }),
    { width: W, height: H, fonts: FONTS },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

/**
 * The friend-invite card (/og/invite/CODE.png) — Ellen's design
 * (2026-10-23): a pile of tiles at left on the gold, and at right a quiet
 * "Hey!", the @name set bold on an ivory chip, then "wants to be friends
 * on Mahjong Alley →". Only the name changes per player; the pile is one
 * transparent PNG (assets/invite-pile.png, embedded via og-assets).
 */
const IVORY = '#F8F3E9';
const PILE_W = 540; // the pile's drawn width; 850×940 source → 540×597
const PILE_H = 597;

function inviteCard({ name }) {
  // Size the name to the chip's inner width (column 500 − chip padding 48):
  // Inter Bold runs ≈0.62em per glyph, so a 20-char handle (the app's
  // maximum) lands near 36px instead of clipping at the card's edge.
  const nameSize = Math.max(32, Math.min(76, Math.floor(452 / (0.62 * name.length))));
  const arrow = {
    type: 'svg',
    props: {
      width: 64,
      height: 44,
      viewBox: '0 0 64 44',
      style: { marginLeft: 14 },
      children: [
        { type: 'path', props: { d: 'M2 22 H58', stroke: NAVY, strokeWidth: 3, strokeLinecap: 'round' } },
        { type: 'path', props: { d: 'M42 8 L60 22 L42 36', stroke: NAVY, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } },
      ],
    },
  };
  return el(
    'div',
    {
      width: W,
      height: H,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: GOLD,
      fontFamily: 'Inter',
      color: NAVY,
    },
    [
      {
        type: 'img',
        props: {
          src: INVITE_PILE_DATA_URL,
          width: PILE_W,
          height: PILE_H,
          style: { position: 'absolute', left: 36, top: (H - PILE_H) / 2 },
        },
      },
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          position: 'absolute',
          left: 660,
          top: 150,
          width: 500,
        },
        [
          el('div', { fontSize: 38, fontWeight: 400, lineHeight: 1, display: 'flex' }, 'Hey!'),
          el(
            'div',
            {
              fontSize: nameSize,
              fontWeight: 700,
              lineHeight: 1,
              backgroundColor: IVORY,
              padding: '18px 24px',
              borderRadius: 6,
              marginTop: 26,
              display: 'flex',
              maxWidth: 500,
              overflow: 'hidden',
            },
            name,
          ),
          el(
            'div',
            { fontSize: 44, fontWeight: 400, lineHeight: 1.22, marginTop: 28, display: 'flex' },
            'wants to be friends on',
          ),
          el(
            'div',
            { fontSize: 44, fontWeight: 400, lineHeight: 1.22, display: 'flex', alignItems: 'center' },
            [el('div', { display: 'flex' }, 'Mahjong Alley'), arrow],
          ),
        ],
      ),
    ],
  );
}

/** Render the friend-invite card to PNG bytes. Throws on failure. */
export async function renderInviteCardPng({ name }) {
  const svg = await satori(inviteCard({ name }), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
