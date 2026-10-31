/**
 * og-render — pure card renderer for the link previews: the friend invite,
 * the table invite (both the tile-pile card) and the promo code.
 *
 * satori (layout → SVG) + resvg (SVG → PNG), fonts and art embedded via
 * og-assets.mjs so the bundle is runtime-independent. Kept separate from the
 * function handler so scripts/test-og-local.mjs can render on a dev machine
 * without Netlify.
 *
 * Palette: golden card bg #FBE5AC (Ellen 2026-08-10 — deliberately
 * warmer than the site's cream #F2E8D5; keep scripts/gen-og-card.mjs in
 * sync), ink-navy #1A1A2E.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
  INTER_BOLD_B64,
  INTER_SEMIBOLD_B64,
  INTER_REGULAR_B64,
  CODE_ART_PNG_B64,
  INVITE_PILE_PNG_B64,
} from './og-assets.mjs';

const W = 1200;
const H = 630;
const GOLD = '#FBE5AC';
const NAVY = '#1A1A2E';

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
              borderRadius: 4,
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

/**
 * The friend-invite card (/og/invite/CODE.png) — Ellen's design
 * (2026-10-23): a pile of tiles at left on the gold, and at right a quiet
 * "Hey!", the @name set bold on an ivory chip, then "wants to be friends
 * on Mahjong Alley →". Only the name changes per player; the pile is one
 * transparent PNG (assets/invite-pile.png, embedded via og-assets).
 *
 * The table-invite card (/og/join/CODE.png) is the same card, its line
 * "saved you a seat on" (Ellen 2026-10-30). The table's name and when it
 * plays are the link's bold line under the card (invite-preview), so the
 * picture never has to fit them.
 */
const IVORY = '#F8F3E9';
const PILE_W = 540; // the pile's drawn width; 850×940 source → 540×597
const PILE_H = 597;

function inviteCard({ name, action }) {
  // Size the name to the chip's inner width (column 500 − chip padding 48):
  // Inter Bold runs ≈0.62em per glyph, so a 20-char handle (the app's
  // maximum) lands near 36px instead of clipping at the card's edge. An @
  // and its capitals run wider: 0.66em, measured on a 21-char "@handle".
  const glyphEm = name.startsWith('@') ? 0.66 : 0.62;
  const nameSize = Math.max(32, Math.min(76, Math.floor(452 / (glyphEm * name.length))));
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
          // Centred on the card's height, not pinned to a top: a long
          // handle shrinks the chip and the block with it, and a pinned
          // block then sat high (Ellen 2026-10-23). The 8px keeps the
          // extra air above "Hey!" she asked for.
          position: 'absolute',
          left: 660,
          top: 0,
          height: H,
          justifyContent: 'center',
          paddingTop: 8,
          width: 500,
        },
        [
          // Same size as the "wants to be friends" line (Ellen 2026-10-23).
          el('div', { fontSize: 44, fontWeight: 400, lineHeight: 1, display: 'flex' }, 'Hey!'),
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
            action,
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

async function inviteCardPng(props) {
  const svg = await satori(inviteCard(props), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

/** Render the friend-invite card to PNG bytes. Throws on failure. */
export function renderInviteCardPng({ name }) {
  return inviteCardPng({ name, action: 'wants to be friends on' });
}

/** Render the table-invite card to PNG bytes. Throws on failure — the
 *  caller falls back to the static brand card. */
export function renderTableCardPng({ name }) {
  return inviteCardPng({ name, action: 'saved you a seat on' });
}
