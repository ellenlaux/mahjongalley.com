/**
 * code-preview — serves /code/CODE (a _redirects rewrite) with the
 * promo-code Open Graph tags injected into the static code page, so a
 * teacher's share text previews the gift ("A rare joker is waiting") and
 * not the brand card. Same shape as invite-preview: fetch the deployed
 * page, swap only <title> + the og:/twitter: metas; anything unexpected →
 * the page exactly as it is.
 *
 * Only a real, active code gets the card (peek_redeem_code, 0121); the
 * page itself renders for any well-formed code so the person still sees
 * what to do — the app tells them if the code is wrong.
 */

import { fetchCodeExists } from './peeks.mjs';

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
  const i = esc(image);
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${t}</title>`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`],
    [/(<meta property="og:image" content=")[^"]*(")/, `$1${i}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`],
    [/(<meta name="twitter:image" content=")[^"]*(")/, `$1${i}$2`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`],
  ];
  return swaps.reduce((acc, [re, sub]) => acc.replace(re, sub), html);
}

const CODE_RE = /^\/code\/([A-Za-z0-9]{4,16})\/?$/;

export default async (req) => {
  const url = new URL(req.url);
  const baseRes = await fetch(new URL('/code/index.html', url.origin));
  const baseHtml = await baseRes.text();
  const asPage = (html) =>
    new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });

  const m = url.pathname.match(CODE_RE);
  if (!m) return asPage(baseHtml);
  const code = m[1].toUpperCase();
  if (!(await fetchCodeExists(code))) return asPage(baseHtml);

  return asPage(
    metaSwap(baseHtml, {
      title: 'A rare joker is waiting',
      description: `Open in Mahjong Alley to unlock it, or enter ${code}.`,
      image: `${url.origin}/og/code/${encodeURIComponent(code)}.png`,
    }),
  );
};
