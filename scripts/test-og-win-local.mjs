// Local smoke test for the win card renderer — writes sample PNGs.
//   node scripts/test-og-win-local.mjs [out-dir]
import { writeFileSync } from 'node:fs';
import { renderWinCardPng } from '../netlify/functions/og-win.mjs';
import { parseWin } from '../netlify/functions/win.mjs';

const out = process.argv[2] ?? '/tmp';
const named = parseWin(new URL('https://mahjongalley.com/win/heart-eyes?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&chips=self-pick,jokerless,streak-4&i=ABCD2345'));
writeFileSync(`${out}/og-win-named.png`, await renderWinCardPng(named, 'DayRay'));
const guest = parseWin(new URL('https://mahjongalley.com/win/big-money?cat=consecutive-run&line=5&pts=75&pat=11+222+3333+44444&chips=50-points'));
writeFileSync(`${out}/og-win-guest.png`, await renderWinCardPng(guest, null));
const bare = parseWin(new URL('https://mahjongalley.com/win/pouch-fill'));
writeFileSync(`${out}/og-win-bare.png`, await renderWinCardPng(bare, null));
console.log(`wrote ${out}/og-win-{named,guest,bare}.png`);
