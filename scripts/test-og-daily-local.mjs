// Local smoke test for the Daily invite card and page — renders the three
// puzzles' cards and checks the link reading and the injected tags.
//   node scripts/test-og-daily-local.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDailyInvite, badgeDay } from '../netlify/functions/daily-invite.mjs';
import { renderDailyInviteCardPng } from '../netlify/functions/og-daily.mjs';
import invitePreview from '../netlify/functions/invite-preview.mjs';

const q = (s) => new URLSearchParams(s);

// The link's tokens: the three kinds and a real day, nothing else.
assert.deepEqual(parseDailyInvite(q('k=deal&d=2026-10-28')), { kind: 'deal', date: '2026-10-28' });
assert.deepEqual(parseDailyInvite(q('k=table&d=2026-12-31&via=qr')), { kind: 'table', date: '2026-12-31' });
assert.equal(parseDailyInvite(q('')), null);
assert.equal(parseDailyInvite(q('k=deal')), null);
assert.equal(parseDailyInvite(q('k=shuffle&d=2026-10-28')), null);
assert.equal(parseDailyInvite(q('k=toString&d=2026-10-28')), null);
assert.equal(parseDailyInvite(q('k=read&d=2026-02-30')), null);
assert.equal(parseDailyInvite(q('k=read&d=2026-10-28T00')), null);
assert.equal(badgeDay('2026-10-28'), 'OCT 28');
assert.equal(badgeDay('2027-01-05'), 'JAN 5');

for (const [kind, date] of [['deal', '2026-10-28'], ['read', '2026-10-28'], ['table', '2026-12-31']]) {
  const out = `/tmp/og-daily-${kind}-sample.png`;
  writeFileSync(out, await renderDailyInviteCardPng({ kind, date }));
  console.log('wrote', out);
}

// invite-preview: a Daily link gets The Daily's page, the sender in the
// title and the card for its puzzle and day; a plain link is unchanged.
const pages = {
  '/daily-invite/index.html': readFileSync('daily-invite/index.html', 'utf8'),
  '/404.html': readFileSync('404.html', 'utf8'),
};
globalThis.fetch = async (input, init) => {
  const u = new URL(String(input));
  if (u.pathname.endsWith('/rpc/peek_app_invite')) {
    const { p_code } = JSON.parse(init.body);
    return new Response(JSON.stringify(p_code === 'ABCD2345' ? [{ display_name: 'ElleBell', handle: 'ellebell' }] : []));
  }
  return new Response(pages[u.pathname] ?? 'missing');
};
const page = async (path) => (await invitePreview(new Request(`https://mahjongalley.com${path}`))).text();

const daily = await page('/invite/ABCD2345?k=deal&d=2026-10-28');
assert.match(daily, /<title>ElleBell invited you to the Daily Shuffle<\/title>/);
assert.match(daily, /<meta property="og:title" content="ElleBell invited you to the Daily Shuffle"/);
assert.match(daily, /<meta property="og:description" content="Three hands, shuffled. Sort them out."/);
assert.match(
  daily,
  /<meta property="og:image" content="https:\/\/mahjongalley.com\/og\/invite\/ABCD2345.png\?k=deal&amp;d=2026-10-28"/,
);
assert.match(daily, /class="masthead"/);

const plain = await page('/invite/ABCD2345');
assert.match(plain, /<meta property="og:title" content="ElleBell wants to be friends"/);
assert.match(plain, /<meta property="og:image" content="https:\/\/mahjongalley.com\/og\/invite\/ABCD2345.png"/);

// A made-up puzzle is a plain invite; an unknown code keeps the page's own tags.
const odd = await page('/invite/ABCD2345?k=bingo&d=2026-10-28');
assert.match(odd, /<meta property="og:title" content="ElleBell wants to be friends"/);
const unknown = await page('/invite/ZZZZ9999?k=read&d=2026-10-28');
assert.match(unknown, /<meta property="og:title" content="The Daily · Mahjong Alley"/);

console.log('daily invite: links, tags and cards OK');
