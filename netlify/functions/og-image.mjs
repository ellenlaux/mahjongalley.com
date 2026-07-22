/**
 * og-image — the per-table / per-invite preview card PNG
 * (/og/join/CODE.png, /og/invite/CODE.png via _redirects → ?kind=&code=).
 *
 * Data comes ONLY from the anon-callable Supabase peeks (0084) — never
 * from query text, so nobody can mint official-looking cards with
 * arbitrary words. Unknown code / dead table / any render failure → 302
 * to the static brand card, which is what the tags shipped before this
 * function existed.
 */

import { renderCardPng } from './og-render.mjs';
import { fetchPeek, paceLabel } from './peeks.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const code = (url.searchParams.get('code') ?? '').replace(/\.png$/i, '');

  const fallback = () =>
    Response.redirect(new URL('/assets/og-card.png', url.origin), 302);

  if ((kind !== 'join' && kind !== 'invite') || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
    return fallback();
  }

  try {
    const peek = await fetchPeek(kind, code);
    if (!peek) return fallback();

    const card =
      kind === 'join'
        ? {
            title: peek.name ?? `${peek.hostDisplayName}’s Table`,
            subtitle: `${peek.seatCount}/${peek.maxPlayers} seated · ${paceLabel(peek.mode)}`,
          }
        : {
            title: peek.displayName,
            subtitle: 'wants to be friends',
          };

    const png = await renderCardPng(card);
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
