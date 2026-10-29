// Local smoke test for the receipt PRINTING video — writes sample mp4s and
// times each render.   node scripts/test-og-receipt-print-local.mjs [out-dir] [threads] [only]
// `threads` (e.g. 1) caps ffmpeg's threads, to approximate a function's
// small vCPU; 0 (the default) lets ffmpeg use every core. `only` renders
// one sample's key — a cold render, in a process of its own.
import { writeFileSync } from 'node:fs';
import { renderReceiptPrintMp4 } from '../netlify/functions/og-receipt-print.mjs';
import { parseReceipt } from '../netlify/functions/receipt.mjs';

const out = process.argv[2] ?? '/tmp';
const threads = Number(process.argv[3] ?? 0);
const only = process.argv[4] ?? null;
const at = (path) => parseReceipt(new URL(`https://mahjongalley.com/og/receipt-print${path}`));
// The day's board comes from peek_daily_board at request time; stubbed
// here the way peeks.withTopTen / withBoardRows fill it.
const topped = (r, kind, of, rows) => ({ ...r, top: { kind, of, rows } });
const names = ['DayRay', 'ElleBell', 'Carmen', 'Billie', 'Ruth', 'Pat', 'Lou', 'Kim', 'Sue', 'Marge', 'Dot', 'Bea'];
const shuffleRows = names.map((name, i) => ({ rank: i + 1, name, solved: i < 9, seconds: 192.3 + i * 37.1, greens: 2 }));
const tableRows = [140, 125, 95, 20, 5, -10, -25, -40, -40, -60, -90, -150].map((score, i) => ({ rank: i + 1, name: ['ElleBell', 'Carmen', 'DayRay', ...names.slice(3)][i], solved: score > 50, score }));
const readRows = [191, 160, 45].map((points, i) => ({ rank: i + 1, name: names[i], solved: i < 2, points }));
const samples = {
  'shuffle-top3': [topped(at('/shuffle-won.mp4?sd=2026-10-24&h=3&n=3&hn=2&hp=150&m=1&c=1923&rk=2&of=3&at=1414&i=ABCD2345&d=2026-10-24'), 'deal', 3, shuffleRows.slice(0, 3)), 'ElleBell'],
  'shuffle-board12': [topped(at('/shuffle-missed.mp4?sd=2026-10-24&h=2&n=3&hn=0&hp=0&m=3&c=2410&rk=11&of=40&at=1414&d=2026-10-24'), 'deal', 40, shuffleRows), null],
  'read': [topped(at('/read-won.mp4?rd=2026-10-25&rf=8&rt=8&rh=150&rn=0&rc=0&rb=41&rl=139&rk=1&of=3&at=1414&i=ABCD2345&d=2026-10-25'), 'read', 3, readRows), 'ElleBell'],
  'board': [{ ...at('/board.mp4?k=table&bd=2026-10-28&rk=3&of=14&at=1414&i=ABCD2345&d=2026-10-28'), board: { kind: 'table', date: '2026-10-28', of: 14, you: { rank: 3, of: 14, friends: null, at: '14:14' }, rows: tableRows } }, 'DayRay'],
  'deal-top10': [topped(at('/pouch-fill.mp4?cat=2468&line=1&pts=25&pat=222+444+6666+8888&chips=concealed&dd=2026-10-12&tb=100&cl=0&fd=1&pc=97&rk=3&of=14&at=1414&i=ABCD2345&d=2026-10-12'), 'table', 14, tableRows), 'DayRay'],
  'heart-eyes': [at('/heart-eyes.mp4?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&jl=1&sp=1&chips=self-pick,jokerless,streak-4&i=ABCD2345&d=2026-10-28'), 'DayRay'],
};
for (const [key, [r, name]] of Object.entries(samples)) {
  if (only && key !== only) continue;
  const t0 = Date.now();
  const mp4 = await renderReceiptPrintMp4(r, name, { threads });
  writeFileSync(`${out}/og-receipt-print-${key}.mp4`, mp4);
  console.log(key.padEnd(16), `${(mp4.length / 1e6).toFixed(2)} MB`.padStart(8), `${Date.now() - t0} ms`.padStart(9));
}
