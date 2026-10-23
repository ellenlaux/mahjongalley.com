// Local smoke test for the card renderer — writes two sample PNGs.
//   node scripts/test-og-local.mjs
import { writeFileSync } from 'node:fs';
import { renderCardPng, renderInviteCardPng } from '../netlify/functions/og-render.mjs';

const table = await renderCardPng({
  title: "ElleBell’s Table",
  subtitle: '2/4 seated · Live',
});
writeFileSync('/tmp/og-join-sample.png', table);

const invite = await renderInviteCardPng({ name: 'ElleBell' });
writeFileSync('/tmp/og-invite-sample.png', invite);
const inviteLong = await renderInviteCardPng({ name: 'MahjongMavenOfMesaAZ' });
writeFileSync('/tmp/og-invite-long-sample.png', inviteLong);
console.log('wrote /tmp/og-join-sample.png, /tmp/og-invite-sample.png and /tmp/og-invite-long-sample.png');
