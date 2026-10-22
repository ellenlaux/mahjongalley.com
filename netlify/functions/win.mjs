/**
 * win — the shared SOLO WIN (/win/<beat>?cat=…&line=…&pts=…&pat=…&chips=…&i=…).
 *
 * Everything the card and page say comes from a CLOSED vocabulary
 * validated here — a beat from a fixed list, a card category from a fixed
 * list, a line number, a point value, a card pattern made of card tokens,
 * chips from a fixed list — plus the sender's display name, which comes
 * ONLY from the anon-callable invite peek (peek_app_invite) for the
 * invite code on the link, never from query text. Nobody can mint an
 * official-looking card with arbitrary words.
 *
 * Shared by win-preview.mjs (the page + OG tags) and og-win.mjs (the PNG).
 */

export const WIN_BEATS = ['pouch-fill', 'big-money', 'burnt-joker', 'heart-eyes'];

/** Card category slug (as the app sends it) → the card's own name. */
export const CATEGORIES = {
  '2026': '2026',
  '2468': '2468',
  '369': '369',
  '1-3-5-7-9': '1 3 5 7 9',
  'any-like-numbers': 'Any Like Numbers',
  'consecutive-run': 'Consecutive Run',
  'quints': 'Quints',
  'singles-pairs': 'Singles & Pairs',
  'winds-dragons': 'Winds & Dragons',
};

/** Chip slug → label. A `streak-N` slug is handled separately. */
export const CHIPS = {
  'concealed': 'Concealed',
  'jokerless': 'Jokerless',
  'self-pick': 'Self-pick',
  '50-points': '50+ points',
  'new-hand': 'New hand!',
};

// One card-pattern token: a number group (2026, 1111, 33333), the 1D of
// the Winds & Dragons lines, flowers, dragons, winds, or NEWS. Six tokens at most — a hand is four groups,
// the longest lines five.
const TOKEN = /^(?:[0-9]{1,5}|1D|F{2,6}|D{1,4}|N{1,4}|E{2,4}|W{2,4}|S{2,4}|NEWS)$/;

/**
 * Parse + validate a win request. Beat from the preserved pathname
 * (/win/<beat>, /og/win/<beat>.png — Netlify rewrites keep the client's
 * own query string, so the rest rides as query params). Returns null when
 * the beat is unknown; every other field degrades to "absent" rather than
 * failing the request, so a damaged link still lands on a sane page.
 */
export function parseWin(url) {
  const m = url.pathname.match(/^\/(?:og\/)?win\/([a-z-]{3,24})(?:\.png)?\/?$/);
  const beat = m ? m[1] : url.searchParams.get('beat');
  if (!WIN_BEATS.includes(beat)) return null;
  const q = url.searchParams;

  const catSlug = (q.get('cat') ?? '').toLowerCase();
  const category = CATEGORIES[catSlug] ?? null;
  const lineRaw = q.get('line') ?? '';
  const line = /^\d{1,2}$/.test(lineRaw) && Number(lineRaw) > 0 ? Number(lineRaw) : null;
  const handLine = category && line ? `${category} #${line}` : null;

  const ptsRaw = q.get('pts') ?? '';
  const points = /^\d{1,3}$/.test(ptsRaw) && Number(ptsRaw) > 0 ? Number(ptsRaw) : null;

  const tokens = (q.get('pat') ?? '').toUpperCase().trim().split(/\s+/).filter(Boolean);
  const pattern = tokens.length > 0 && tokens.length <= 6 && tokens.every((t) => TOKEN.test(t)) ? tokens.join(' ') : null;

  const chips = [];
  for (const slug of (q.get('chips') ?? '').toLowerCase().split(',').filter(Boolean)) {
    if (CHIPS[slug]) chips.push(CHIPS[slug]);
    else {
      const s = slug.match(/^streak-(\d{1,3})$/);
      if (s && Number(s[1]) >= 2) chips.push(`${Number(s[1])}-win streak`);
    }
    if (chips.length >= 3) break;
  }

  const codeRaw = (q.get('i') ?? '').toUpperCase();
  const code = /^[A-Z2-9]{8}$/.test(codeRaw) ? codeRaw : null;

  return { beat, handLine, points, pattern, chips, code };
}

/** The words, from a parsed win + the (server-verified) sender name. */
export function winCopy(win, name) {
  const who = name ? `${name} won` : 'Mahjong!';
  const stat = [win.handLine, win.points ? `${win.points} pts` : null].filter(Boolean).join(' · ');
  const title = name
    ? stat ? `${name} won with ${win.handLine ?? `${win.points} pts`}` : `${name} won on Mahjong Alley`
    : stat ? `Mahjong! ${stat}` : 'Mahjong! on Mahjong Alley';
  const descParts = [stat, win.pattern, win.chips.join(' · ')].filter(Boolean);
  const description = `${descParts.length ? descParts.join(' — ') + '. ' : ''}${
    name ? `Play with ${name} on Mahjong Alley.` : 'Come play American Mahjong on Mahjong Alley.'
  }`;
  return { who, stat, title, description };
}

/** The beat's media: the mp4 for og:video (link previews), the keyed
 *  transparent WebP the page plays, and its payoff frame. */
export function winMedia(origin, beat) {
  return {
    video: `${origin}/assets/win/${beat}.mp4`,
    motion: `${origin}/assets/win/${beat}.webp`,
    art: `${origin}/assets/win/${beat}-poster.png`,
  };
}
