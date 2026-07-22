// Local smoke test for the card renderer — writes two sample PNGs.
//   node scripts/test-og-local.mjs
import { writeFileSync } from 'node:fs';
import { renderCardPng } from '../netlify/functions/og-render.mjs';

const table = await renderCardPng({
  title: "ElleBell’s Table",
  subtitle: '2/4 seated · Live',
});
writeFileSync('/tmp/og-join-sample.png', table);

const invite = await renderCardPng({
  title: 'DayRay',
  subtitle: 'wants to be friends',
});
writeFileSync('/tmp/og-invite-sample.png', invite);
console.log('wrote /tmp/og-join-sample.png and /tmp/og-invite-sample.png');
