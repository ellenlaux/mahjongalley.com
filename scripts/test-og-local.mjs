// Local smoke test for the card renderer — writes the sample PNGs.
//   node scripts/test-og-local.mjs
import { writeFileSync } from 'node:fs';
import { renderInviteCardPng, renderTableCardPng } from '../netlify/functions/og-render.mjs';

const table = await renderTableCardPng({ name: '@ElleBell' });
writeFileSync('/tmp/og-join-sample.png', table);
const tableLong = await renderTableCardPng({ name: '@MahjongMavenOfMesaAZ' });
writeFileSync('/tmp/og-join-long-sample.png', tableLong);

const invite = await renderInviteCardPng({ name: 'ElleBell' });
writeFileSync('/tmp/og-invite-sample.png', invite);
const inviteLong = await renderInviteCardPng({ name: 'MahjongMavenOfMesaAZ' });
writeFileSync('/tmp/og-invite-long-sample.png', inviteLong);
console.log('wrote /tmp/og-join-sample.png, /tmp/og-join-long-sample.png, /tmp/og-invite-sample.png and /tmp/og-invite-long-sample.png');
