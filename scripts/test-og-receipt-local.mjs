// Local smoke test for the receipt card renderer — writes sample PNGs.
//   node scripts/test-og-receipt-local.mjs [out-dir]
import { writeFileSync } from 'node:fs';
import { renderReceiptCardPng } from '../netlify/functions/og-receipt.mjs';
import { parseReceipt } from '../netlify/functions/receipt.mjs';

const out = process.argv[2] ?? '/tmp';
const at = (path) => parseReceipt(new URL(`https://mahjongalley.com${path}`));
// A Social Play hand's seats come from the DB (peek_game_seats) at request
// time; the local render stubs the names the way peeks.withSeatNames fills them.
const seated = (r, names) => ({ ...r, session: { ...r.session, with: names } });
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
  'shuffle-won': [at('/receipt/shuffle-won?sd=2026-10-24&h=3&n=3&hn=2&hp=150&m=1&c=1923&rk=12&of=340&fr=2&fo=9&at=1414&i=ABCD2345&d=2026-10-24'), 'ElleBell'],
  'shuffle-missed': [at('/receipt/shuffle-missed?sd=2026-10-24&h=1&n=3&hn=0&hp=0&m=4&c=1923&a=1&d=2026-10-24'), null],
  'shuffle-late': [at('/receipt/shuffle-won?sd=2026-10-09&h=3&n=3&hn=0&hp=0&m=1&c=2214&a=1&wb=2&wf=4&d=2026-10-13'), 'ElleBell'],
  'read-won': [at('/receipt/read-won?rd=2026-10-25&rf=8&rt=8&rh=150&rn=0&rc=0&rb=41&rl=139&rk=12&of=340&fr=2&fo=9&at=1414&i=ABCD2345&d=2026-10-25'), 'ElleBell'],
  'read-time-up': [at('/receipt/read-time-up?rd=2026-10-25&rf=3&rt=30&rh=60&rn=1&rc=10&rb=0&rl=143&d=2026-10-25'), null],
  'read-late': [at('/receipt/read-done?rd=2026-10-25&rf=2&rt=8&rh=40&rn=0&rc=0&rb=0&rl=97&a=1&wb=1&wf=2&d=2026-10-28'), 'ElleBell'],
  'read-floor': [at('/receipt/read-done?rd=2026-10-25&rf=1&rt=8&rh=25&rn=2&rc=30&rb=0&rl=40&d=2026-10-25'), null],
  'mp-final-win': [seated(at('/receipt/pouch-fill?cat=2026&line=3&pts=25&pat=FFF+2026+222+6666&sh=4&so=4&sx=100&sb=-35&sk=1&sn=4&sf=1&g=7f1e0d2c-3b4a-4c5d-8e9f-0a1b2c3d4e5f&vs=west&i=ABCD2345&d=2026-10-25'), ['Carmen', 'Billie', 'Ruth']), 'ElleBell'],
  'mp-hand-loss': [at('/receipt/smoked?cat=2026&line=3&pts=30&pat=FFF+2026+222+6666&away=5&sh=2&sx=-25&sb=40&sk=3&sn=4&d=2026-10-25'), null],
  'board-table': [{ ...at('/receipt/board?k=table&bd=2026-10-28&rk=12&of=14&at=1414&i=ABCD2345&d=2026-10-28'), board: { kind: 'table', date: '2026-10-28', of: 14, you: { rank: 12, of: 14, friends: null, at: '14:14' }, rows: [
    { rank: 1, name: 'ElleBell', solved: true, score: 110 }, { rank: 2, name: 'DayRay', solved: true, score: 95 }, { rank: 3, name: 'Carmen', solved: false, score: 20 }, { rank: 4, name: 'Billie', solved: false, score: 5 },
    { rank: 5, name: 'Ruth', solved: false, score: -10 }, { rank: 6, name: 'Pat', solved: false, score: -25 }, { rank: 7, name: 'Lou', solved: false, score: -40 }, { rank: 8, name: 'Kim', solved: false, score: -40 },
    { rank: 9, name: 'Sue', solved: false, score: -60 }, { rank: 10, name: 'Marge', solved: false, score: -150 } ] } }, 'ElleBell'],
  'board-shuffle': [{ ...at('/receipt/board?k=deal&bd=2026-10-28&d=2026-10-28'), board: { kind: 'deal', date: '2026-10-28', of: 3, you: null, rows: [
    { rank: 1, name: 'DayRay', solved: true, seconds: 192.3 }, { rank: 2, name: 'ElleBell', solved: true, seconds: 402.3 }, { rank: 3, name: 'Carmen', solved: false, greens: 2, seconds: 500 } ] } }, null],
  'wall': [at('/receipt/dizzy-dragon?cat=2468&line=2&pts=30&pat=22+44+666+8888&away=4&d=2026-10-22'), 'DayRay'],
};
for (const [key, [r, name]] of Object.entries(samples)) {
  writeFileSync(`${out}/og-receipt-${key}.png`, await renderReceiptCardPng(r, name));
}
console.log(`wrote ${out}/og-receipt-{${Object.keys(samples).join(',')}}.png`);
