/**
 * invite-preview — serves /join/CODE and /invite/CODE (via _redirects →
 * ?kind=&code=) with PER-TABLE Open Graph tags injected into the static
 * invite page (Ellen 2026-07-22: the iMessage card should read
 * "ElleBell's Table · 2/4 seated", not the generic brand card).
 *
 * The human experience is untouched: we fetch the deployed 404.html (the
 * invite page — its JS reads location.pathname, which the rewrite
 * preserves in the browser) and string-swap only <title> + the og:/
 * twitter: metas. Unknown code / peek failure → the page exactly as it
 * was, generic tags and all.
 *
 * All injected text is HTML-escaped — table and display names are user
 * content and land inside attribute values.
 */

import { fetchPeek, paceLabel } from './peeks.mjs';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function metaSwap(html, { title, description, image }) {
  const t = esc(title);
  const d = esc(description);
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${t}</title>`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`],
    [/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`],
    [/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`],
  ];
  return swaps.reduce((acc, [re, sub]) => acc.replace(re, sub), html);
}

export default async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const code = url.searchParams.get('code') ?? '';

  // The static invite page is the base (and the graceful answer to
  // everything unexpected).
  const baseRes = await fetch(new URL('/404.html', url.origin));
  const baseHtml = await baseRes.text();
  const asPage = (html) =>
    new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Seat counts move — keep crawler/browser copies short-lived.
        'cache-control': 'public, max-age=60',
      },
    });

  if ((kind !== 'join' && kind !== 'invite') || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
    return asPage(baseHtml);
  }

  const peek = await fetchPeek(kind, code);
  if (!peek) return asPage(baseHtml);

  const image = `${url.origin}/og/${kind}/${encodeURIComponent(code.toUpperCase())}.png`;
  const tags =
    kind === 'join'
      ? {
          title: peek.name ?? `${peek.hostDisplayName}’s Table`,
          description: `${peek.seatCount}/${peek.maxPlayers} seated · ${paceLabel(peek.mode)} · ${
            peek.rulesMode === 'social' ? 'House Rules' : 'NMJL Standard'
          } — tap to join on Mahjong Alley.`,
          image,
        }
      : {
          title: `${peek.displayName} wants to be friends`,
          description: 'Join them on Mahjong Alley — come play American Mahjong, with friends.',
          image,
        };

  return asPage(metaSwap(baseHtml, tags));
};
