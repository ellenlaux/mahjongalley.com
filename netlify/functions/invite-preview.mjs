/**
 * invite-preview — serves /join/CODE and /invite/CODE (a _redirects
 * rewrite; kind + code are parsed from the preserved original pathname —
 * see parsePreviewRequest) with PER-TABLE Open Graph tags injected into
 * the static invite page. A table link reads as an invitation (Ellen
 * 2026-10-30): the card says "Hey! @ElleBell saved you a seat on Mahjong
 * Alley →" and the bold line Messages draws under it says the table and
 * when, "ElleBell's Table · Join now". The table's name appears once, and
 * no seats are counted.
 *
 * The human experience is untouched: we fetch the deployed 404.html (the
 * invite page — its JS reads location.pathname, which the rewrite
 * preserves in the browser) and string-swap only <title> + the og:/
 * twitter: metas. Unknown code / peek failure / a table that closed or
 * filled → the page exactly as it was, generic tags and all.
 *
 * All injected text is HTML-escaped — table and display names are user
 * content and land inside attribute values.
 *
 * A friend invite sent from one of The Daily's leaderboards carries the
 * puzzle and the day (/invite/CODE?k=deal&d=2026-10-28, daily-invite.mjs): it
 * gets The Daily's page (daily-invite/index.html) and its card, titled
 * "<Name> invited you to the Daily Shuffle" (Ellen 2026-10-28).
 */

import { DAILY_PUZZLES, parseDailyInvite } from './daily-invite.mjs';
import { fetchPeek, parsePreviewRequest, tableLabel, whenLabel } from './peeks.mjs';

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
  const { kind, code } = parsePreviewRequest(url);

  // The static invite page is the base (and the graceful answer to
  // everything unexpected) — The Daily's own page for a Daily invite.
  const daily = kind === 'invite' ? parseDailyInvite(url.searchParams) : null;
  const baseRes = await fetch(new URL(daily ? '/daily-invite/index.html' : '/404.html', url.origin));
  const baseHtml = await baseRes.text();
  const asPage = (html) =>
    new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // A table can close — keep crawler/browser copies short-lived.
        'cache-control': 'public, max-age=60',
      },
    });

  if ((kind !== 'join' && kind !== 'invite') || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
    return asPage(baseHtml);
  }

  const peek = await fetchPeek(kind, code);
  if (!peek) return asPage(baseHtml);
  // "Saved you a seat" is false on a table that closed or filled.
  if (kind === 'join' && !peek.joinable) return asPage(baseHtml);

  const image = `${url.origin}/og/${kind}/${encodeURIComponent(code.toUpperCase())}.png`;
  // A Daily invite's card is the same image URL with the puzzle and the day
  // on it, rebuilt from the parsed tokens (never the raw query). It lands
  // in an attribute value, so its & is &amp;.
  const tags = daily
    ? {
        title: `${peek.displayName} invited you to the ${DAILY_PUZZLES[daily.kind].name}`,
        description: DAILY_PUZZLES[daily.kind].blurb,
        image: esc(`${image}?k=${daily.kind}&d=${daily.date}`),
      }
    : kind === 'join'
      ? {
          title: `${tableLabel(peek)} · ${whenLabel(peek.mode)}`,
          description: "Let's mahj.",
          image,
        }
      : {
          title: `${peek.displayName} wants to be friends`,
          description: 'Check out Mahjong Alley',
          image,
        };

  return asPage(metaSwap(baseHtml, tags));
};
