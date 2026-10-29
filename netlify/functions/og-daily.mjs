/**
 * og-daily — the Daily invite card: a friend invite sent from one of The
 * Daily's leaderboards (the Friends tab's "It's better with friends" →
 * Invite, in the app). Ellen 2026-10-28: "it should include the mast head,
 * the name badge and maybe the short description of the puzzle."
 *
 * The link is the friend invite with the puzzle and the day on it —
 * /invite/CODE?k=deal&d=2026-10-28 — so everything the friend invite does
 * still happens (the code, the friend request, the universal link), and
 * the card says which puzzle. Top to bottom on the card:
 *
 *   - the masthead, THE DAILY with the dragon, as the hub prints it;
 *   - the puzzle's badge, THE DAILY — SHUFFLE | OCT 28, as the puzzle's
 *     own screen wears it (DailySectionBadge): Ellen's wordmark in cream
 *     on the orange tile, a hairline, the day set in TAY Napili;
 *   - the puzzle's one line (the app's registry, lib/theDaily.ts).
 *
 * Who sent it is the link's bold title under the card (invite-preview),
 * from the invite peek, never from the link. Nothing on the card is free
 * text: the link's tokens are read by daily-invite.mjs.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { INTER_SEMIBOLD_B64, INTER_REGULAR_B64 } from './og-assets.mjs';
import { NAPILI_B64, MASTHEAD_PNG_B64, WORDMARK_SVG } from './og-daily-assets.mjs';
import { DAILY_PUZZLES, badgeDay } from './daily-invite.mjs';

const W = 1200;
const H = 630;

// The badge's colours (DailySectionBadge): Ellen's orange, darkened to
// carry cream at 3.27:1, and the cream the lettering prints in.
const ORANGE = '#CC6D00';
const CREAM = '#F6F2EA';
const INK = '#141414';
/** The card's ground: The Daily's apricot, the Home card's field
 *  (DAILY_DEAL_BG in the app) — Ellen 2026-10-28, over newsprint cream. */
const APRICOT = '#F6BC74';

// TAY Napili, measured (DailySectionBadge): capitals are 0.747 of the
// size; centring them, not the line box, drops the line 0.15 of the size.
const NAPILI_CAP = 0.747;
const NAPILI_DROP = 0.15;
const NAPILI_LINE = 1.3;
// The tile's height and air, per point of cap height (DailySectionBadge).
const TILE_PER_CAP = 1.75;
const PAD_PER_CAP = 7 / 16;

const MASTHEAD_ASPECT = 964 / 387;

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
const FONTS = [
  { name: 'Inter', data: fontBuf(INTER_SEMIBOLD_B64), weight: 600, style: 'normal' },
  { name: 'Inter', data: fontBuf(INTER_REGULAR_B64), weight: 400, style: 'normal' },
  { name: 'Napili', data: fontBuf(NAPILI_B64), weight: 400, style: 'normal' },
];

const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });
const img = (src, width, height, style = {}) => ({ type: 'img', props: { src, width, height, style } });

const MASTHEAD_URL = `data:image/png;base64,${MASTHEAD_PNG_B64}`;
/** A wordmark as an image, its `currentColor` printed in cream. */
const wordmarkUrl = (kind) =>
  `data:image/svg+xml;base64,${btoa(WORDMARK_SVG[kind].replace(/currentColor/g, CREAM))}`;

/** The puzzle's badge, as its play screen wears it, at a cap height. */
function badge({ kind, date, cap }) {
  const size = cap / NAPILI_CAP;
  const tileH = Math.round(cap * TILE_PER_CAP);
  const pad = cap * PAD_PER_CAP;
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      height: tileH,
      paddingLeft: pad,
      paddingRight: pad,
      backgroundColor: ORANGE,
      borderRadius: Math.round(cap / 4),
    },
    [
      img(wordmarkUrl(kind), Math.round(cap * DAILY_PUZZLES[kind].aspect), cap),
      el('div', {
        width: Math.max(2, Math.round(cap / 16)),
        height: Math.round(tileH * 0.62),
        marginLeft: pad,
        marginRight: pad,
        backgroundColor: CREAM,
        opacity: 0.6,
      }),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Napili',
          fontSize: size,
          lineHeight: NAPILI_LINE,
          color: CREAM,
          transform: `translateY(${size * NAPILI_DROP}px)`,
        },
        badgeDay(date),
      ),
    ],
  );
}

/** The card: the masthead, the badge, the puzzle's line, centred on the
 *  apricot. Sizes are for 1200 px wide, which Messages draws at about a
 *  quarter: the masthead's capitals then stand near the bubble's own text. */
function dailyInviteCard({ kind, date }) {
  const mastW = 700;
  return el(
    'div',
    {
      width: W,
      height: H,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: APRICOT,
      fontFamily: 'Inter',
      color: INK,
    },
    [
      img(MASTHEAD_URL, mastW, Math.round(mastW / MASTHEAD_ASPECT)),
      el('div', { display: 'flex', marginTop: 30 }, [badge({ kind, date, cap: 48 })]),
      el(
        'div',
        // The Read's line, the longest, runs about 1,050 px at this size.
        { display: 'flex', fontSize: 42, fontWeight: 400, lineHeight: 1.2, marginTop: 32, maxWidth: 1080, textAlign: 'center' },
        DAILY_PUZZLES[kind].blurb,
      ),
    ],
  );
}

/** Render the Daily invite card to PNG bytes. Throws on failure — the
 *  caller falls back to the friend card. */
export async function renderDailyInviteCardPng({ kind, date }) {
  const svg = await satori(dailyInviteCard({ kind, date }), { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
