// Local smoke test for the receipt card renderer — writes sample PNGs.
//   node scripts/test-og-receipt-local.mjs [out-dir]
import { writeFileSync } from 'node:fs';
import { renderReceiptCardPng } from '../netlify/functions/og-receipt.mjs';
import { parseReceipt } from '../netlify/functions/receipt.mjs';

const out = process.argv[2] ?? '/tmp';
const at = (path) => parseReceipt(new URL(`https://mahjongalley.com${path}`));
const samples = {
  'named': [at('/receipt/heart-eyes?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&jl=1&sp=1&chips=self-pick,jokerless,streak-4&i=ABCD2345&d=2026-10-22'), 'DayRay'],
  'called': [at('/receipt/pouch-fill?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&chips=concealed&d=2026-10-22'), null],
  'guest': [at('/receipt/big-money?cat=consecutive-run&line=5&pts=75&pat=11+222+3333+44444&jl=1&chips=50-points&d=2026-10-22'), null],
  'smoked': [at('/receipt/smoked?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&away=5&d=2026-10-22'), 'DayRay'],
  'so-close': [at('/receipt/purse-payout?cat=quints&line=2&pts=40&pat=11111+2222+33333&away=1&d=2026-10-22'), null],
  'match-lit': [at('/receipt/match-lit?cat=369&line=1&pts=25&pat=333+666+999+DDD&away=2&w=south&d=2026-10-22'), 'DayRay'],
  'dead-hand': [at('/receipt/dead-hand?d=2026-10-22'), null],
  'deal-win': [at('/receipt/pouch-fill?cat=2468&line=1&pts=25&pat=222+444+6666+8888&chips=concealed&dd=2026-10-12&tb=100&cl=0&fd=1&pc=97&rk=12&of=340&fr=2&fo=9&at=1414&i=ABCD2345&d=2026-10-12'), 'DayRay'],
  'deal-loss': [at('/receipt/purse-payout?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&away=2&dd=2026-10-12&tb=-60&cl=15&fd=0&pc=88&d=2026-10-12'), null],
  'wall': [at('/receipt/dizzy-dragon?cat=2468&line=2&pts=30&pat=22+44+666+8888&away=4&d=2026-10-22'), 'DayRay'],
};
for (const [key, [r, name]] of Object.entries(samples)) {
  writeFileSync(`${out}/og-receipt-${key}.png`, await renderReceiptCardPng(r, name));
}
console.log(`wrote ${out}/og-receipt-{${Object.keys(samples).join(',')}}.png`);
