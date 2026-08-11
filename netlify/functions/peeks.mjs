/**
 * peeks — shared Supabase reads for the link-preview functions.
 *
 * Uses the app's PUBLIC url + publishable key (the same pair shipped in
 * the app binary — not secrets) against the two anon-callable preview
 * RPCs from app migration 0084:
 *   - peek_lobby_preview(p_code)  → table card data
 *   - peek_app_invite(p_code)     → friend-invite card data
 *
 * Every failure resolves to null — callers fall back to the generic
 * brand card / untouched page. A short timeout keeps a slow DB from
 * stalling crawler fetches (they give up fast).
 */

const SUPABASE_URL = 'https://bhtuztrwgpyzhxipcjda.supabase.co';
const SUPABASE_KEY = 'sb_publishable_86_PUFmbyZ5tKDuik07Y8A_8xNqUTE3';

async function rpc(fn, args) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * kind + code from the ORIGINAL request URL. Netlify DISCARDS query
 * params written in a _redirects destination (only the client's own
 * query string is forwarded), so `?kind=&code=` never reaches the
 * function on a rewritten request — the preserved pathname is the
 * reliable carrier: /join/CODE, /invite/CODE, /og/join/CODE.png,
 * /og/invite/CODE.png. Query params remain as a fallback so direct
 * function invocation (testing) still works.
 */
export function parsePreviewRequest(url) {
  const m = url.pathname.match(
    /^\/(?:og\/)?(join|invite)\/([A-Za-z0-9]{4,12})(?:\.png)?\/?$/,
  );
  if (m) return { kind: m[1], code: m[2] };
  return {
    kind: url.searchParams.get('kind'),
    code: (url.searchParams.get('code') ?? '').replace(/\.png$/i, ''),
  };
}

export function paceLabel(mode) {
  if (mode === 'async') return 'Async';
  if (mode === 'live_scheduled') return 'Scheduled';
  return 'Live';
}

/** kind 'join' → table peek; kind 'invite' → friend-invite peek.
 *  Null on miss/error. */
export async function fetchPeek(kind, code) {
  if (kind === 'join') {
    const rows = await rpc('peek_lobby_preview', { p_code: code.toUpperCase() });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return {
      name: row.name ?? null,
      hostDisplayName: row.host_display_name ?? 'A player',
      hostHandle: row.host_handle ?? null,
      seatCount: Number(row.seat_count ?? 0),
      maxPlayers: Number(row.max_players ?? 4),
      mode: row.mode ?? 'live_now',
      rulesMode: row.rules_mode ?? 'nmjl',
      joinable: Boolean(row.joinable),
    };
  }
  const rows = await rpc('peek_app_invite', { p_code: code.toUpperCase() });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    displayName: row.display_name ?? 'A friend',
    handle: row.handle ?? null,
  };
}
