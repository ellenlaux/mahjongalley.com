// Regenerates assets/og-card.png — the STATIC generic brand card (the
// site root's og:image and the fallback for unknown/dead invite codes).
// Same shell as the dynamic renderer (og-render.mjs) but brand copy and
// a bigger title. Keep BG in sync with og-render.mjs. Run from repo root:
//   node scripts/gen-og-card.mjs
import { writeFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { INTER_BOLD_B64, INTER_SEMIBOLD_B64, TILE_PNG_B64 } from '../netlify/functions/og-assets.mjs';

const W = 1200;
const H = 630;
const BG = '#FBE5AC'; // Ellen 2026-08-10 — golden; was cream #F2E8D5
const NAVY = '#1A1A2E';
const DIM = '#5A5F72';

const fontBuf = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
const el = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

const card = el(
  'div',
  {
    width: W,
    height: H,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    padding: '60px 80px',
    fontFamily: 'Inter',
  },
  [
    {
      type: 'img',
      props: {
        src: `data:image/png;base64,${TILE_PNG_B64}`,
        width: 312,
        height: 400,
        style: { flexShrink: 0 },
      },
    },
    el('div', { display: 'flex', flexDirection: 'column', marginLeft: 88, width: 640 }, [
      el(
        'div',
        { fontSize: 96, fontWeight: 700, color: NAVY, lineHeight: 1.15, display: 'flex' },
        'Mahjong Alley',
      ),
      el(
        'div',
        { fontSize: 44, fontWeight: 600, color: DIM, marginTop: 36, display: 'flex', lineHeight: 1.3 },
        'Come play American Mahjong, with friends',
      ),
    ]),
  ],
);

const svg = await satori(card, {
  width: W,
  height: H,
  fonts: [
    { name: 'Inter', data: fontBuf(INTER_BOLD_B64), weight: 700, style: 'normal' },
    { name: 'Inter', data: fontBuf(INTER_SEMIBOLD_B64), weight: 600, style: 'normal' },
  ],
});
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
writeFileSync('assets/og-card.png', png);
console.log('wrote assets/og-card.png');
