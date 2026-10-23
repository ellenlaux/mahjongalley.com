/**
 * receipt-preview — serves /receipt/<moment>?… (a _redirects rewrite)
 * with the receipt's Open Graph tags injected into the static receipt
 * page, plus the validated receipt (its lines, media, and link label) as
 * JSON for the page's own script. Same shape as invite-preview: fetch the
 * deployed page, swap only <title>, the metas, and one data placeholder.
 * Anything unexpected → the page as it is, generic tags and all.
 *
 * The card (og:image) is the receipt, and the only preview media: a link
 * preview shows either a video or an image, and with the clip as og:video
 * Messages showed only the dragon (Ellen 2026-10-23). The clips stay for
 * the page itself (the keyed WebP on the slip).
 */

import { fetchPeek } from './peeks.mjs';
import { parseReceipt, receiptCopy, receiptLines, receiptMedia } from './receipt.mjs';

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
  const baseRes = await fetch(new URL('/receipt/index.html', url.origin));
  const baseHtml = await baseRes.text();
  const asPage = (html) =>
    new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });

  const r = parseReceipt(url);
  if (!r) return asPage(baseHtml);

  const peek = r.code ? await fetchPeek('invite', r.code).catch(() => null) : null;
  const name = peek?.displayName ?? null;
  const copy = receiptCopy(r, name);
  const media = receiptMedia(url.origin, r.moment);
  // The card URL carries the same query, so the PNG says what the page
  // says. The query lands inside an attribute value, so its & is &amp;.
  const image = esc(`${url.origin}/og/receipt/${r.moment}.png${url.search}`);

  const data = JSON.stringify({
    moment: r.moment,
    outcome: r.outcome,
    code: r.code,
    name,
    lines: receiptLines(r, name),
    linkLabel: name ? `PLAY WITH ${name.toUpperCase()} ›` : 'GET MAHJONG ALLEY ›',
    motion: media.motion,
    art: media.art,
  })
    // A closing script tag inside a JSON string would end the data block early.
    .replace(/</g, '\\u003c');
  const html = metaSwap(baseHtml, { title: copy.title, description: copy.description, image }).replace(
    '<script id="receipt-data" type="application/json">null</script>',
    `<script id="receipt-data" type="application/json">${data}</script>`,
  );
  return asPage(html);
};
