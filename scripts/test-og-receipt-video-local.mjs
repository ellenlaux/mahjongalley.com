// Local smoke test for the receipt card VIDEO — writes sample mp4s and
// times the compose.   node scripts/test-og-receipt-video-local.mjs [out-dir]
import { writeFileSync } from 'node:fs';
import { renderReceiptCardMp4 } from '../netlify/functions/og-receipt-video.mjs';
import { parseReceipt } from '../netlify/functions/receipt.mjs';

const out = process.argv[2] ?? '/tmp';
const at = (path) => parseReceipt(new URL(`https://mahjongalley.com${path}`));
const samples = {
  'named': [at('/receipt/heart-eyes?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&jl=1&sp=1&chips=self-pick,jokerless,streak-4&i=ABCD2345&d=2026-10-23'), 'DayRay'],
  'called': [at('/receipt/pouch-fill?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&chips=concealed&d=2026-10-23'), null],
  'smoked': [at('/receipt/smoked?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&away=5&d=2026-10-28'), 'DayRay'],
  'wall': [at('/receipt/dizzy-dragon?cat=2468&line=2&pts=30&pat=22+44+666+8888&away=4&d=2026-10-28'), null],
};
for (const [key, [r, name]] of Object.entries(samples)) {
  const t0 = Date.now();
  const mp4 = await renderReceiptCardMp4(r, name);
  writeFileSync(`${out}/og-receipt-video-${key}.mp4`, mp4);
  console.log(key, `${mp4.length} bytes`, `${Date.now() - t0} ms`);
}
