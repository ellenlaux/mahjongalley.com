/**
 * og-code — the promo-code preview card PNG (/og/code/CODE.png; a
 * _redirects rewrite, code parsed from the preserved pathname).
 *
 * Only a REAL, active code renders (peek_redeem_code, 0121) — otherwise
 * anyone could mint official-looking "A rare joker is waiting / Code:
 * ANYTHING" cards. Unknown code or any render failure → 302 to the static
 * brand card.
 */

import { renderCodeCardPng } from './og-render.mjs';
import { fetchCodeExists } from './peeks.mjs';

const CODE_RE = /^\/og\/code\/([A-Za-z0-9]{4,16})(?:\.png)?\/?$/;

export default async (req) => {
  const url = new URL(req.url);
  const fallback = () => Response.redirect(new URL('/assets/og-card.png', url.origin), 302);
  const m = url.pathname.match(CODE_RE);
  if (!m) return fallback();
  const code = m[1].toUpperCase();
  try {
    if (!(await fetchCodeExists(code))) return fallback();
    const png = await renderCodeCardPng({ code });
    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' },
    });
  } catch {
    return fallback();
  }
};
