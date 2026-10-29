/**
 * og-image — the per-table / per-invite preview card PNG
 * (/og/join/CODE.png, /og/invite/CODE.png — _redirects rewrites; kind +
 * code are parsed from the preserved original pathname, see
 * parsePreviewRequest).
 *
 * Data comes ONLY from the anon-callable Supabase peeks (0084) — never
 * from query text, so nobody can mint official-looking cards with
 * arbitrary words. Unknown code / dead table / any render failure → 302
 * to the static brand card, which is what the tags shipped before this
 * function existed.
 */

import { renderCardPng, renderInviteCardPng } from './og-render.mjs';
import { renderDailyInviteCardPng } from './og-daily.mjs';
import { parseDailyInvite } from './daily-invite.mjs';
import { fetchPeek, paceLabel, parsePreviewRequest } from './peeks.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const { kind, code } = parsePreviewRequest(url);

  const fallback = () =>
    Response.redirect(new URL('/assets/og-card.png', url.origin), 302);

  if ((kind !== 'join' && kind !== 'invite') || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
    return fallback();
  }

  try {
    const peek = await fetchPeek(kind, code);
    if (!peek) return fallback();

    // Friend invites get Ellen's tile-pile card (2026-10-23) — or, sent
    // from a daily's leaderboard (`?k=&d=`), The Daily's card for that
    // puzzle and day (og-daily.mjs; the code is still checked above, so
    // no one mints a Daily card off a made-up link). Tables keep the
    // tile + text column card.
    const daily = kind === 'invite' ? parseDailyInvite(url.searchParams) : null;
    const png = daily
      ? await renderDailyInviteCardPng(daily)
      : kind === 'invite'
        ? await renderInviteCardPng({ name: peek.displayName })
        : await renderCardPng({
            title: peek.name ?? `${peek.hostDisplayName}’s Table`,
            subtitle: `${peek.seatCount}/${peek.maxPlayers} seated · ${paceLabel(peek.mode)}`,
          });
    return new Response(png, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        // Short-lived: seat counts move. Crawlers cache on their side
        // anyway; this keeps repeat fetches honest without hammering.
        'cache-control': 'public, max-age=300',
      },
    });
  } catch {
    return fallback();
  }
};
