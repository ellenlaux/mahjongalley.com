/**
 * daily-invite — the closed vocabulary of a Daily invite link, kept apart
 * from the card's renderer (og-daily.mjs) so invite-preview can read a link
 * without bundling satori and resvg.
 *
 * A friend invite sent from one of The Daily's leaderboards is the friend
 * invite with the puzzle and the day on it: /invite/CODE?k=deal&d=2026-10-28.
 * `k` is the app's DailyKind — 'deal' is the Shuffle, 'table' the Daily
 * Deal — the same tokens the board receipt's `k` uses. Anything else on the
 * link (an unknown kind, a day that isn't one) is no Daily invite, and the
 * friend card and page answer instead.
 */

/** The three puzzles, by the app's kind. `name` is the player's name for
 *  it, `blurb` the registry's one line — keep both in step with the app's
 *  DAILY_CHALLENGES (src/lib/theDaily.ts). `aspect` is the wordmark
 *  outline's own width ÷ height (DailySectionBadge's WORDMARK). The page
 *  (daily-invite/index.html) keeps its own copy of the same three. */
export const DAILY_PUZZLES = {
  deal: {
    name: 'Daily Shuffle',
    blurb: 'Three hands, shuffled. Sort them out.',
    aspect: 272.57 / 37,
  },
  read: {
    name: 'Daily Read',
    blurb: 'Their exposures are showing. What are they playing?',
    aspect: 236.98 / 36,
  },
  table: {
    name: 'Daily Deal',
    blurb: 'One deal, same for everyone. Play it for score.',
    aspect: 232.63 / 36,
  },
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** A real calendar day, YYYY-MM-DD, or null. */
function parseDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  if (y < 2026 || y > 2100) return null;
  return s;
}

/** The Daily invite a link names — `{ kind, date }` — or null when the
 *  link is a plain friend invite (or names something unknown). */
export function parseDailyInvite(searchParams) {
  const kind = searchParams.get('k');
  const date = parseDay(searchParams.get('d'));
  if (!date || !Object.prototype.hasOwnProperty.call(DAILY_PUZZLES, kind)) return null;
  return { kind, date };
}

/** `2026-10-28` → `OCT 28`: the badge's day (the app's shortDateLabel,
 *  upper-cased). */
export function badgeDay(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
