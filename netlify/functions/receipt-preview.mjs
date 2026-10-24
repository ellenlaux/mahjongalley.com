/**
 * receipt-preview — serves /receipt/<moment>?… (a _redirects rewrite)
 * with the receipt's Open Graph tags injected into the static receipt
 * page, plus the validated receipt (its lines, media, and link label) as
 * JSON for the page's own script. Same shape as invite-preview: fetch the
 * deployed page, swap only <title>, the metas, and one data placeholder.
 * Anything unexpected → the page as it is, generic tags and all.
 *
 * The card is the receipt in both media: og:image is the PNG, og:video the
 * same slip with the moment's clip composed live in its header
 * (og-receipt-video). A preview shows either a video or an image, never
 * both — with the bare clip as the video Messages showed only the dragon
 * (Ellen 2026-10-23: "the dragon is animated on the receipt"). A moment
 * with no clip yet drops the video tags.
 */

import { fetchPeek } from './peeks.mjs';
import { parseReceipt, receiptCopy, receiptLines, receiptLink, receiptMedia } from './receipt.mjs';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function metaSwap(html, { title, description, image, video }) {
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
  if (video) {
    swaps.push(
      [/(<meta property="og:video" content=")[^"]*(")/, `$1${video}$2`],
      [/(<meta property="og:video:secure_url" content=")[^"]*(")/, `$1${video}$2`],
    );
  }
  const swapped = swaps.reduce((acc, [re, sub]) => acc.replace(re, sub), html);
  return video ? swapped : stripVideo(swapped);
}

/** Drop the static page's og:video tags. They point at the default
 *  moment's video with NO query — a card nobody built, so the first
 *  crawler to ask waits ~10s for ffmpeg while Messages gives up on the
 *  whole preview (Apple's fetcher measured 12s on an unparsed receipt
 *  link, 2026-10-24). A video is advertised only when THIS receipt's is
 *  already built and quick. */
function stripVideo(html) {
  return html.replace(/\s*<meta property="og:video[^"]*" content="[^"]*" \/>/g, '');
}

/** True when the card video answers fast (built and cached) — a cold
 *  build takes seconds, which is exactly what the preview can't wait
 *  for. The probe itself kicks that build off, so the NEXT look finds it. */
async function videoReady(videoUrl) {
  try {
    const res = await fetch(videoUrl, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
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
  // An unparsed link still gets the page, with its generic tags — minus
  // the default video, which would stall the preview (see stripVideo).
  if (!r) return asPage(stripVideo(baseHtml));

  const peek = r.code ? await fetchPeek('invite', r.code).catch(() => null) : null;
  const name = peek?.displayName ?? null;
  const copy = receiptCopy(r, name);
  const media = receiptMedia(url.origin, r.moment);
  // The card URL carries the same query, so the PNG says what the page
  // says. The query lands inside an attribute value, so its & is &amp;.
  const image = esc(`${url.origin}/og/receipt/${r.moment}.png${url.search}`);

  const link = receiptLink(r, name);
  const data = JSON.stringify({
    moment: r.moment,
    outcome: r.outcome,
    code: r.code,
    name,
    lines: receiptLines(r, name),
    linkLabel: link.label,
    scheme: link.scheme,
    motion: media.motion,
    art: media.art,
  })
    // A closing script tag inside a JSON string would end the data block early.
    .replace(/</g, '\\u003c');
  // The video carries the same query as the card, so it says what the
  // card says — but it is advertised ONLY when it is already built and
  // quick to fetch. Messages builds its preview on the sender's phone
  // and gives up on a slow og:video, taking the whole card with it
  // (Ellen 2026-10-23: no unfurl at all). The app warms the video when
  // the receipt prints, so by the time it is shared the probe answers
  // in time; a cold one gets the still card. Inside an attribute value
  // the query's & is &amp;.
  const videoUrl = media.video ? `${media.video}${url.search}` : null;
  const video = videoUrl && (await videoReady(videoUrl)) ? esc(videoUrl) : null;
  const html = metaSwap(baseHtml, { title: copy.title, description: copy.description, image, video }).replace(
    '<script id="receipt-data" type="application/json">null</script>',
    `<script id="receipt-data" type="application/json">${data}</script>`,
  );
  return asPage(html);
};
