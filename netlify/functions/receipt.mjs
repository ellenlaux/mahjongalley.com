/**
 * receipt — a shared GAME as a printed receipt
 * (/receipt/<moment>?cat=…&line=…&pts=…&pat=…&chips=…&away=…&w=…&i=…&d=…).
 * A win, a loss, a wall game: the moment names which.
 *
 * Everything the card and page say comes from a CLOSED vocabulary
 * validated here — a moment from a fixed list, a card category from a
 * fixed list, a line number, a point value, a card pattern made of card
 * tokens, chips from a fixed list, tiles away as a small number, a seat
 * — plus the sender's display name, which comes ONLY from the
 * anon-callable invite peek (peek_app_invite) for the invite code on the
 * link, never from query text. Nobody can mint an official-looking
 * receipt with arbitrary words.
 *
 * Shared by receipt-preview.mjs (the page + OG tags) and og-receipt.mjs
 * (the PNG): both print the same lines (receiptLines).
 */

/** Moment → outcome. The keys are the app's (src/lib/resultShare.ts) and
 *  the asset names under assets/receipt/. */
export const MOMENTS = {
  'pouch-fill': 'win',
  'big-money': 'win',
  'burnt-joker': 'win',
  'heart-eyes': 'win',
  'purse-payout': 'loss',
  'match-lit': 'loss',
  'smoked': 'loss',
  'dead-hand': 'loss',
  'dizzy-dragon': 'wall',
  'shuffle-won': 'shuffle', // the Daily Shuffle: every Mahjong found
  'shuffle-missed': 'shuffle', // the Daily Shuffle: out of lives, or given up
};

/** Moments with recorded art in assets/receipt/ (<m>.mp4, <m>.webp,
 *  <m>-poster.png): the four win beats (2026-10-18) and the five loss and
 *  wall moments (2026-10-28). The Shuffle's two wait for wordless clips. */
export const HAS_ART = new Set(['pouch-fill', 'big-money', 'burnt-joker', 'heart-eyes', 'purse-payout', 'match-lit', 'smoked', 'dead-hand', 'dizzy-dragon']);

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

const SEATS = { south: 'SOUTH', west: 'WEST', north: 'NORTH' };

// One card-pattern token: a number group (2026, 1111, 33333), the 1D of
// the Winds & Dragons lines, flowers, dragons, winds, or NEWS. Six tokens
// at most — a hand is four groups, the longest lines five.
const TOKEN = /^(?:[0-9]{1,5}|1D|F{2,6}|D{1,4}|N{1,4}|E{2,4}|W{2,4}|S{2,4}|NEWS)$/;

/**
 * Parse + validate a receipt request. Moment from the preserved pathname
 * (/receipt/<m>, /og/receipt/<m>.png, /og/receipt-video/<m>.mp4 — Netlify rewrites keep the client's
 * own query string, so the rest rides as query params). Returns null when
 * the moment is unknown; every other field degrades to "absent" rather
 * than failing the request, so a damaged link still lands on a sane page.
 */
export function parseReceipt(url) {
  const m = url.pathname.match(/^\/(?:og\/)?receipt(?:-video)?\/([a-z-]{3,24})(?:\.png|\.mp4)?\/?$/);
  const moment = m ? m[1] : url.searchParams.get('moment');
  const outcome = MOMENTS[moment];
  if (!outcome) return null;
  const q = url.searchParams;

  const category = CATEGORIES[(q.get('cat') ?? '').toLowerCase()] ?? null;
  const lineRaw = q.get('line') ?? '';
  const line = /^\d{1,2}$/.test(lineRaw) && Number(lineRaw) > 0 ? Number(lineRaw) : null;
  const handLine = category && line ? `${category} #${line}` : null;

  const ptsRaw = q.get('pts') ?? '';
  const points = /^\d{1,3}$/.test(ptsRaw) && Number(ptsRaw) > 0 ? Number(ptsRaw) : null;

  const tokens = (q.get('pat') ?? '').toUpperCase().trim().split(/\s+/).filter(Boolean);
  const pattern = tokens.length > 0 && tokens.length <= 6 && tokens.every((t) => TOKEN.test(t)) ? tokens.join(' ') : null;

  const chips = [];
  if (outcome === 'win') {
    for (const slug of (q.get('chips') ?? '').toLowerCase().split(',').filter(Boolean)) {
      if (CHIPS[slug]) chips.push(CHIPS[slug]);
      else {
        const s = slug.match(/^streak-(\d{1,3})$/);
        if (s && Number(s[1]) >= 2) chips.push(`${Number(s[1])}-win streak`);
      }
      if (chips.length >= 3) break;
    }
  }

  // How the win was paid (wins only): no joker doubles the hand's value,
  // a self-pick is paid double by everyone.
  const jokerless = outcome === 'win' && q.get('jl') === '1';
  const selfPick = outcome === 'win' && q.get('sp') === '1';

  const awayRaw = q.get('away') ?? '';
  const away = outcome !== 'win' && /^\d{1,2}$/.test(awayRaw) && Number(awayRaw) <= 14 ? Number(awayRaw) : null;

  const winnerSeat = moment === 'match-lit' ? SEATS[(q.get('w') ?? '').toLowerCase()] ?? null : null;

  // A ranked Daily Deal (the app's kind 'table'): the day and the score's
  // parts — TABLE (what the hand paid, signed), the closeness bonus (the
  // ladder: 20/15/10/5), the fed count (−5 each, floor −20), the pace
  // (wall draws). The score is re-added here; the link never carries it.
  let table = null;
  const dd = q.get('dd') ?? '';
  const ddm = dd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ddm) {
    const dt = new Date(Date.UTC(+ddm[1], +ddm[2] - 1, +ddm[3]));
    const tbRaw = q.get('tb') ?? '';
    const clRaw = q.get('cl') ?? '';
    const fdRaw = q.get('fd') ?? '';
    const pcRaw = q.get('pc') ?? '';
    if (
      dt.getUTCFullYear() === +ddm[1] && dt.getUTCMonth() === +ddm[2] - 1 && dt.getUTCDate() === +ddm[3] &&
      /^-?\d{1,4}$/.test(tbRaw) && /^(?:0|5|10|15|20)$/.test(clRaw) && /^\d{1,2}$/.test(fdRaw) && /^\d{1,3}$/.test(pcRaw)
    ) {
      // Tiles away as the Daily Deal's scorer read the hand (the game's
      // own `away` is absent on a wall game); null: no readable hand.
      const taRaw = q.get('ta') ?? '';
      const tilesAway = /^\d{1,2}$/.test(taRaw) && Number(taRaw) <= 14 ? Number(taRaw) : null;
      table = { date: dd, table: Math.max(-150, Math.min(9999, Number(tbRaw))), closeness: Number(clRaw), fedCount: Number(fdRaw), pace: Number(pcRaw), tilesAway, rank: null };
      table.rank = parseRankStamp(q);
    }
  }

  // The Daily Shuffle (the three-Mahjong puzzle): the day, the Mahjongs
  // found of how many, hints and the time they bought, misses (a fixed
  // minute each), the clock in tenths, an archive play — and, on an
  // archive play, where it would have placed that day (`wb` of `wf`). The
  // total — the adjusted time that ranks — is re-added here, never
  // carried. The hands' names never ride: a recipient may go play this
  // very shuffle.
  let shuffle = null;
  if (outcome === 'shuffle') {
    const sd = q.get('sd') ?? '';
    const sdm = sd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const n = q.get('n') ?? '';
    const h = q.get('h') ?? '';
    const hn = q.get('hn') ?? '';
    const hp = q.get('hp') ?? '';
    const mi = q.get('m') ?? '';
    const c = q.get('c') ?? '';
    if (sdm && /^[1-3]$/.test(n) && /^[0-3]$/.test(h) && Number(h) <= Number(n) && /^\d{1,2}$/.test(hn) && /^\d{1,4}$/.test(hp) && /^\d{1,2}$/.test(mi) && /^\d{1,6}$/.test(c)) {
      const dt = new Date(Date.UTC(+sdm[1], +sdm[2] - 1, +sdm[3]));
      if (dt.getUTCFullYear() === +sdm[1] && dt.getUTCMonth() === +sdm[2] - 1 && dt.getUTCDate() === +sdm[3]) {
        const isArchive = q.get('a') === '1';
        shuffle = { date: sd, handsMade: Number(h), hands: Number(n), hints: Number(hn), hintPenalty: Number(hp), misses: Number(mi), clock: Number(c) / 10, isArchive, rank: parseRankStamp(q), wouldBe: isArchive ? parseWouldBe(q) : null };
      }
    }
  }

  // A Social Play hand (the app's multiplayer session): which hand of how
  // many (no denominator on an open-ended table), what the hand paid the
  // player (signed), the balance carried in from the hands before, the
  // player's place of how many seats, and whether the table closed on
  // this hand. The balance is re-added here, never carried. Only the
  // player's own account rides: no other seat, no other loss.
  let session = null;
  if (outcome !== 'shuffle') {
    const sh = q.get('sh') ?? '';
    const sx = q.get('sx') ?? '';
    const sb = q.get('sb') ?? '';
    const sk = q.get('sk') ?? '';
    const sn = q.get('sn') ?? '';
    if (/^\d{1,3}$/.test(sh) && Number(sh) > 0 && /^-?\d{1,5}$/.test(sx) && /^-?\d{1,6}$/.test(sb) && /^[1-4]$/.test(sk) && /^[2-4]$/.test(sn) && Number(sk) <= Number(sn)) {
      const so = q.get('so') ?? '';
      const of = /^\d{1,3}$/.test(so) && Number(so) >= Number(sh) ? Number(so) : null;
      // The finished game's id and the player's seat: the seats' NAMES
      // never ride the link — the functions read them from the game
      // (peeks.withSeatNames) and list the other three after the player.
      const g = (q.get('g') ?? '').toLowerCase();
      const gameId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(g) ? g : null;
      const vs = (q.get('vs') ?? '').toLowerCase();
      const viewerSeat = ['east', 'south', 'west', 'north'].includes(vs) ? vs : null;
      session = { hand: Number(sh), of, delta: Number(sx), before: Number(sb), place: Number(sk), seats: Number(sn), final: of !== null && q.get('sf') === '1', gameId, viewerSeat, with: null };
    }
  }

  const codeRaw = (q.get('i') ?? '').toUpperCase();
  const code = /^[A-Z2-9]{8}$/.test(codeRaw) ? codeRaw : null;

  // The day of the game, for the receipt. A real calendar date or nothing.
  const dRaw = q.get('d') ?? '';
  const dm = dRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let date = null;
  if (dm) {
    const t = new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3]));
    if (t.getUTCFullYear() === +dm[1] && t.getUTCMonth() === +dm[2] - 1 && t.getUTCDate() === +dm[3]) date = dRaw;
  }

  return { moment, outcome, handLine, points, pattern, chips, jokerless, selfPick, away, winnerSeat, table, session, shuffle, code, date };
}

/**
 * The payout math on a win, in points, the way the app's
 * src/lib/resultShare.ts receiptMath computes it (and engine/scoring
 * pays it): card value, ×2 jokerless, per player ×2 on self-pick; a
 * self-pick is paid by all three players, a called mahjong by the
 * thrower at 2× and the two others at 1× — four shares.
 */
export function receiptMath(points, { jokerless, selfPick }) {
  const perPlayer = points * (jokerless ? 2 : 1) * (selfPick ? 2 : 1);
  const shares = selfPick ? 3 : 4;
  return { perPlayer, shares, total: perPlayer * shares };
}

/** The rank stamp — where a score stood on the day's board when the
 *  receipt printed, and when — from its tokens, or null. */
function parseRankStamp(q) {
  const rk = q.get('rk') ?? '';
  const at = q.get('at') ?? '';
  if (!(/^\d{1,4}$/.test(rk) && Number(rk) > 0 && /^([01]\d|2[0-3])[0-5]\d$/.test(at))) return null;
  const of = q.get('of') ?? '';
  const fr = q.get('fr') ?? '';
  const fo = q.get('fo') ?? '';
  const friends = /^\d{1,4}$/.test(fr) && /^\d{1,4}$/.test(fo) && Number(fr) > 0 && Number(fo) >= Number(fr) ? { rank: Number(fr), of: Number(fo) } : null;
  return { rank: Number(rk), of: /^\d{1,4}$/.test(of) && Number(of) >= Number(rk) ? Number(of) : null, friends, at: `${at.slice(0, 2)}:${at.slice(2)}` };
}

/** A late (archive) play's would-be place (the app's Daily rules, Ellen
 *  2026-10-27): `wb` of `wf`, the field counting the player. A late play
 *  is never on the day's board, so it never carries the rank stamp; this
 *  says where it would have placed instead. Nothing to place among (a
 *  field of 1) prints nothing. */
function parseWouldBe(q) {
  const wb = q.get('wb') ?? '';
  const wf = q.get('wf') ?? '';
  if (!(/^\d{1,4}$/.test(wb) && /^\d{1,4}$/.test(wf))) return null;
  const place = Number(wb);
  const field = Number(wf);
  return place > 0 && field > 1 && field >= place ? { place, field } : null;
}

/** The rank stamp's lines — EVERYONE, FRIENDS when another friend
 *  played, AS OF — or none without a stamp. */
function rankStampLines(rank) {
  if (!rank) return [];
  const lines = [{ l: 'EVERYONE', r: rankLine(rank.rank, rank.of) }];
  if (rank.friends) lines.push({ l: 'FRIENDS', r: rankLine(rank.friends.rank, rank.friends.of) });
  lines.push({ l: 'AS OF', r: clockLabel(rank.at), dim: true });
  return lines;
}

/** A miss costs a fixed minute (the app's PENALTY_MS.mistake). */
const SHUFFLE_MISS_SECONDS = 60;
/** The Shuffle's adjusted time: the clock plus what was bought on it. */
export function shuffleTotalSeconds(f) {
  return Math.round((f.clock + f.hintPenalty + f.misses * SHUFFLE_MISS_SECONDS) * 10) / 10;
}
/** `4:12.3`, `1:02:03.4` (tenths), or `+1:30` for a price. Mirrors the app's formatClock. */
export function formatClock(seconds, { tenths = true, signed = false } = {}) {
  const total = Math.max(0, tenths ? Math.round(seconds * 10) / 10 : Math.floor(seconds));
  const whole = Math.floor(total);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = whole % 60;
  const t = Math.round((total - whole) * 10) % 10;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const body = `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}${tenths ? `.${t}` : ''}`;
  return signed ? `+${body}` : body;
}

/** The Daily Deal's score from its parts (engine/dailyTable in the app):
 *  table + closeness + fed, fed being −5 a discard called, floor −20. */
export function tableFedPoints(fedCount) {
  const n = Number.isFinite(fedCount) && fedCount > 0 ? Math.floor(fedCount) : 0;
  return Math.max(-20, -5 * n);
}
export function tableScore(t) {
  return t.table + t.closeness + tableFedPoints(t.fedCount);
}
/** The Daily Deal's tiebreak as players see it: the tiles LEFT in the
 *  wall when the game ended (152 − pace; pace counts every tile taken,
 *  the deal included). The app's receiptModel `tableWallLeft`. */
export function tableWallLeft(pace) {
  const taken = Number.isFinite(pace) ? Math.floor(pace) : 0;
  return Math.min(152, Math.max(0, 152 - taken));
}
/** `#12 OF 340`, or `#12` when the field was larger than the app read. */
export function rankLine(rank, of) {
  return of === null ? `#${rank}` : `#${rank} OF ${of}`;
}
/** 'HH:MM' (24 h) → '2:14 PM'. */
export function clockLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
/** The session balance after a Social Play hand: carried in plus paid. */
export function sessionTotal(s) {
  return s.before + s.delta;
}
/** `1ST`, `2ND`, `3RD`, `4TH`. */
export function ordinalCaps(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}TH`;
  return `${n}${['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`;
}
/** `1st`, `2nd`, `3rd`, `4th`. */
export function ordinalWord(n) {
  return ordinalCaps(n).toLowerCase().replace(/^(\d+)/, '$1');
}
/** `+160`, `−40`, `0`. */
export function signedPoints(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2026-10-12` → `Oct 12`. */
export function shortDay(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1] ?? ''} ${d}`.trim();
}

/** "10/22/26" — the receipt's date line. */
export function receiptDate(date) {
  if (!date) return null;
  const [y, m, d] = date.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

/** The big line on the slip, per moment. */
export function headline(r) {
  switch (r.moment) {
    case 'purse-payout':
      return r.away === 3 ? 'ALMOST' : 'SO CLOSE';
    case 'smoked':
      return 'SMOKED!';
    case 'match-lit':
      return 'YOU LIT IT';
    case 'dead-hand':
      return 'DEAD HAND';
    case 'dizzy-dragon':
      return 'WALL GAME';
    case 'shuffle-won':
      return 'YOU WON!';
    case 'shuffle-missed':
      return 'NICE TRY';
    default:
      return 'MAHJONG!';
  }
}

/**
 * The lines on the slip, after the header art — the single source both
 * the page and the card print. Shapes:
 *   '---'                         a dashed rule
 *   { c, big?, small?, bold? }    one centered line
 *   { q, l, r }                   an item: quantity, the thing, the price
 *   { l, r, bold?, dim?, indent? } a row: left and right
 */
export function receiptLines(r, name) {
  if (r.outcome === 'shuffle') return r.shuffle ? shuffleReceiptLines(r.shuffle, r.moment, name) : ['---', { c: headline(r), big: true }, '---', { c: 'THANK YOU · PLAY AGAIN SOON' }];
  const pts = r.points ? `${r.points} PTS` : null;
  const lines = ['---'];
  if (r.date) lines.push({ l: 'DATE', r: receiptDate(r.date) });
  if (name) lines.push({ l: 'PLAYER', r: name.toUpperCase() });
  if (r.date || name) lines.push('---');
  lines.push({ c: headline(r), big: true });

  let total = pts;
  if (r.outcome === 'win') {
    if (r.handLine) lines.push({ q: 1, l: r.handLine.toUpperCase(), r: pts ?? '' });
    else if (pts) lines.push({ q: 1, l: 'HAND', r: pts });
    if (r.pattern) lines.push({ l: r.pattern, r: '', indent: true, dim: true });
    // The math (Ellen 2026-10-22): how the total was reached, never who
    // paid it. Multipliers, the per-player figure when one applied, then
    // the shares that made the total.
    if (r.points) {
      const math = receiptMath(r.points, r);
      if (r.jokerless) lines.push({ l: 'JOKERLESS', r: '×2', indent: true });
      if (r.selfPick) lines.push({ l: 'SELF-PICK', r: '×2', indent: true });
      if (math.perPlayer !== r.points) lines.push({ l: 'PER PLAYER', r: `${math.perPlayer} PTS`, indent: true });
      if (r.selfPick) lines.push({ l: '3 PLAYERS PAY', r: '×3', indent: true });
      else lines.push({ l: 'THROWER ×2 · 2 OTHERS ×1', r: '×4', indent: true });
      total = `${math.total} PTS`;
    }
    for (const chip of r.chips) {
      // Jokerless and self-pick already printed as multipliers.
      if ((r.jokerless && chip === 'Jokerless') || (r.selfPick && chip === 'Self-pick')) continue;
      const streak = /^(\d+)-win streak$/i.exec(chip);
      if (streak) lines.push({ q: Number(streak[1]), l: 'WIN STREAK', r: '' });
      else lines.push({ q: 1, l: chip.toUpperCase().replace('!', ''), r: '' });
    }
  } else {
    if (r.moment === 'match-lit') {
      lines.push({ q: 1, l: 'WINNING TILE', r: 'THROWN' });
      if (r.winnerSeat) lines.push({ l: 'WINNER', r: r.winnerSeat });
    }
    if (r.moment === 'dead-hand') {
      lines.push({ q: 1, l: 'DEAD HAND', r: '' });
      lines.push({ l: 'NO LINE LEFT ON THE CARD', r: '', indent: true, dim: true });
    }
    if (r.moment === 'dizzy-dragon') lines.push({ l: 'NO WINNER', r: '' });
    if (r.handLine && r.moment !== 'dead-hand') {
      lines.push({ q: 1, l: r.handLine.toUpperCase(), r: pts ?? '' });
      if (r.pattern) lines.push({ l: r.pattern, r: '', indent: true, dim: true });
      if (r.away !== null) lines.push({ l: 'TILES AWAY', r: String(r.away) });
    }
  }

  // A ranked Daily Deal: the day's score, itemized under the game's own
  // lines, and the TOTAL is the score, signed. Mirrors the app's
  // lib/receiptLines.ts.
  const t = r.table;
  if (t) {
    lines.push('---');
    lines.push({ l: 'DAILY DEAL', r: receiptDate(t.date) });
    lines.push({ l: 'TABLE', r: signedPoints(t.table) });
    if (r.outcome !== 'win') {
      const away = t.tilesAway !== null ? t.tilesAway : r.away;
      lines.push({ l: away === null ? 'NO READABLE HAND' : away <= 0 ? 'READY FOR MAHJONG' : `${away} AWAY`, r: signedPoints(t.closeness) });
    }
    lines.push({ l: `FED ${t.fedCount}`, r: signedPoints(tableFedPoints(t.fedCount)) });
    lines.push({ l: 'WALL LEFT', r: `${tableWallLeft(t.pace)} TILES`, dim: true });
    lines.push(...rankStampLines(t.rank));
    lines.push('---');
    lines.push({ l: 'TOTAL', r: `${signedPoints(tableScore(t))} PTS`, bold: true });
    lines.push('---');
    lines.push({ c: 'THANK YOU · PLAY AGAIN SOON' });
    return lines;
  }

  // A Social Play hand: the player's account at the table under the
  // hand's own lines, and the TOTAL is the session balance. Mirrors the
  // app's lib/receiptLines.ts sessionLines.
  const s = r.session;
  if (s) {
    lines.push('---');
    lines.push(...sessionLines(s));
    lines.push('---');
    lines.push({ l: 'TOTAL', r: `${signedPoints(sessionTotal(s))} PTS`, bold: true });
    lines.push('---');
    lines.push({ c: 'THANK YOU · PLAY AGAIN SOON' });
    return lines;
  }

  lines.push('---');
  lines.push({ l: 'TOTAL', r: r.outcome === 'win' ? total ?? '—' : '0 PTS', bold: true });
  lines.push('---');
  lines.push({ c: 'THANK YOU · PLAY AGAIN SOON' });
  return lines;
}

/** The Social Play section: which hand, what it paid, the balance
 *  carried forward (from the second hand on), the place at the table,
 *  TABLE CLOSED when the session ended on this hand. */
export function sessionLines(s) {
  const lines = [{ l: 'SOCIAL PLAY', r: s.of === null ? `HAND ${s.hand}` : `HAND ${s.hand} OF ${s.of}` }];
  // Who was at the table — names only, one a row, never their accounts.
  (s.with ?? []).forEach((name, i) => lines.push({ l: i === 0 ? 'WITH' : '', r: name.toUpperCase() }));
  lines.push({ l: 'THIS HAND', r: signedPoints(s.delta) });
  if (s.hand > 1) lines.push({ l: 'BALANCE FWD', r: signedPoints(s.before) });
  lines.push({ l: 'PLACE', r: `${ordinalCaps(s.place)} OF ${s.seats}` });
  if (s.final) lines.push({ c: 'TABLE CLOSED', small: true });
  return lines;
}

/** The Daily Shuffle's slip — the app's lib/receiptLines.ts
 *  shuffleReceiptLines, line for line: a bill. */
export function shuffleReceiptLines(f, moment, name) {
  const lines = ['---', { l: 'SHUFFLE', r: receiptDate(f.date) }];
  if (name) lines.push({ l: 'PLAYER', r: name.toUpperCase() });
  lines.push('---', { c: headline({ moment }), big: true });
  lines.push({ q: f.handsMade, l: 'MAHJONG', r: '' });
  if (f.handsMade < f.hands) lines.push({ l: `${f.hands - f.handsMade} LEFT ON THE RACKS`, r: '', indent: true, dim: true });
  lines.push({ l: 'ON THE CLOCK', r: formatClock(f.clock) });
  if (f.hints > 0) lines.push({ q: f.hints, l: f.hints === 1 ? 'HINT' : 'HINTS', r: formatClock(f.hintPenalty, { tenths: false, signed: true }) });
  if (f.misses > 0) lines.push({ q: f.misses, l: f.misses === 1 ? 'MISS' : 'MISSES', r: formatClock(f.misses * SHUFFLE_MISS_SECONDS, { tenths: false, signed: true }) });
  if (f.isArchive) lines.push({ l: 'ARCHIVE PLAY', r: '', dim: true });
  if (f.wouldBe) lines.push({ l: 'WOULD BE', r: rankLine(f.wouldBe.place, f.wouldBe.field) });
  lines.push(...rankStampLines(f.rank));
  lines.push('---', { l: 'TOTAL', r: formatClock(shuffleTotalSeconds(f)), bold: true }, '---', { c: 'THANK YOU · PLAY AGAIN SOON' });
  return lines;
}

/** The words around the slip: the page title / OG title + description. */
export function receiptCopy(r, name) {
  const stat = [r.handLine, r.points ? `${r.points} pts` : null].filter(Boolean).join(' · ');
  const who = name ?? null;
  // The Daily Shuffle: solved in a time, or how many of its Mahjongs.
  if (r.outcome === 'shuffle') {
    const f = r.shuffle;
    if (!f) return { title: 'The Daily Shuffle on Mahjong Alley', description: 'One puzzle a day. Find three Mahjongs. Play this shuffle on Mahjong Alley.' };
    const time = formatClock(shuffleTotalSeconds(f));
    const rk = f.rank;
    const standing = rk ? (rk.of === null ? `#${rk.rank}` : `#${rk.rank} of ${rk.of}`) : null;
    const solved = r.moment === 'shuffle-won';
    const title = solved
      ? who ? `${who} solved the Daily Shuffle in ${time}` : `Daily Shuffle · ${shortDay(f.date)} · solved in ${time}`
      : who ? `${who} found ${f.handsMade} of ${f.hands} on the Daily Shuffle` : `Daily Shuffle · ${shortDay(f.date)} · ${f.handsMade} of ${f.hands}`;
    const details = [`Daily Shuffle · ${shortDay(f.date)}${f.isArchive ? ' · archive' : ''}`, `${f.handsMade} of ${f.hands} Mahjongs`, time];
    if (standing) details.push(standing);
    return { title, description: `${details.join(' · ')}. Play this shuffle on Mahjong Alley.` };
  }
  // A ranked Daily Deal leads with the day and the score; the game's own
  // story follows in the description.
  if (r.table) {
    const score = signedPoints(tableScore(r.table));
    const rk = r.table.rank;
    const standing = rk ? (rk.of === null ? `#${rk.rank}` : `#${rk.rank} of ${rk.of}`) : null;
    const dealLine = `Daily Deal · ${shortDay(r.table.date)} · ${score} · wall ${r.table.pace}${standing ? ` · ${standing}` : ''}`;
    return {
      title: who
        ? standing ? `${who} is ${standing} on the Daily Deal · ${score}` : `${who} scored ${score} on the Daily Deal`
        : `${score} on the Daily Deal · ${shortDay(r.table.date)}${standing ? ` · ${standing}` : ''}`,
      description: `${dealLine}${stat ? ` — ${headline(r).replace('!', '')} on ${stat}` : ''}. Play this deal on Mahjong Alley.`,
    };
  }
  // A Social Play hand leads with the table's line — which hand, the
  // session balance, the player's place — and the hand's story follows.
  if (r.session) {
    const s = r.session;
    const balance = signedPoints(sessionTotal(s));
    const place = `${ordinalWord(s.place)} of ${s.seats}`;
    const hand = s.final ? 'Final hand' : s.of === null ? `Hand ${s.hand}` : `Hand ${s.hand} of ${s.of}`;
    const story = r.outcome === 'win' ? `Mahjong${stat ? ` on ${stat}` : ''}` : headline(r).replace('!', '').toLowerCase().replace(/^./, (c) => c.toUpperCase());
    const names = s.with?.length ? ` with ${s.with.length > 1 ? `${s.with.slice(0, -1).join(', ')} and ${s.with[s.with.length - 1]}` : s.with[0]}` : '';
    return {
      title: who
        ? s.final ? `${who} finished ${place} at the table · ${balance}` : `${who} is ${place} after hand ${s.hand} · ${balance}`
        : `Social Play · ${hand} · ${balance} · ${place}`,
      description: `Social Play · ${hand}${names} · ${balance} · ${place} — ${story}. ${who ? `Play with ${who} on Mahjong Alley.` : 'Come play American Mahjong on Mahjong Alley.'}`,
    };
  }
  let title;
  switch (r.moment) {
    case 'purse-payout':
      title = who ? `${who} ${r.away === 3 ? 'almost had it' : 'came so close'}` : `${r.away === 3 ? 'Almost' : 'So close'}${stat ? ` · ${stat}` : ''}`;
      break;
    case 'smoked':
      title = who ? `${who} got smoked` : `Smoked${stat ? ` · ${stat}` : ''}`;
      break;
    case 'match-lit':
      title = who ? `${who} lit the match` : 'You lit it';
      break;
    case 'dead-hand':
      title = who ? `${who} played a dead hand` : 'Dead hand';
      break;
    case 'dizzy-dragon':
      title = who ? `${who} hit the wall` : 'Wall game';
      break;
    default:
      title = who ? `${who} won${r.handLine ? ` with ${r.handLine}` : ' on Mahjong Alley'}` : `Mahjong!${stat ? ` ${stat}` : ' on Mahjong Alley'}`;
  }
  const details = [];
  if (r.outcome === 'win') {
    if (stat) details.push(stat);
    if (r.pattern) details.push(r.pattern);
    if (r.points) {
      const math = receiptMath(r.points, r);
      details.push([r.jokerless ? 'Jokerless ×2' : null, r.selfPick ? 'Self-pick ×2' : null, `${math.total} pts total`].filter(Boolean).join(' · '));
    }
    const chips = r.chips.filter((c) => !((r.jokerless && c === 'Jokerless') || (r.selfPick && c === 'Self-pick')));
    if (chips.length) details.push(chips.join(' · '));
  } else {
    if (r.handLine && r.away !== null) details.push(`${r.away} tile${r.away === 1 ? '' : 's'} from ${r.handLine}`);
    else if (stat) details.push(stat);
    if (r.pattern) details.push(r.pattern);
  }
  const description = `${details.length ? details.join(' — ') + '. ' : ''}${
    who ? `Play with ${who} on Mahjong Alley.` : 'Come play American Mahjong on Mahjong Alley.'
  }`;
  return { title, description };
}

/** The one link on the slip: where it goes and what it says. A Daily
 *  Deal's receipt invites to the same deal (the app's daily-table route
 *  by scheme; the store when nothing answers); any other receipt opens
 *  the app — into the friend ceremony when the sender's code is on it. */
export function receiptLink(r, name) {
  if (r.shuffle) return { label: 'PLAY THIS SHUFFLE ›', scheme: `mahjong://daily-deal/${r.shuffle.date}?via=share` };
  if (r.table) return { label: 'PLAY THIS DEAL ›', scheme: `mahjong://daily-table/${r.table.date}?via=share` };
  if (r.code) return { label: name ? `PLAY WITH ${name.toUpperCase()} ›` : 'GET MAHJONG ALLEY ›', scheme: `mahjong://invite/${r.code}` };
  return { label: 'GET MAHJONG ALLEY ›', scheme: 'mahjong://' };
}

/** The moment's media, when its art exists: the keyed transparent WebP the
 *  page plays, its payoff frame, and the card as a VIDEO for og:video
 *  (the same slip with the clip composed live in its header — a preview
 *  shows either a clip or an image, so the clip must carry the receipt). */
export function receiptMedia(origin, moment) {
  if (!HAS_ART.has(moment)) return { motion: null, art: null, video: null };
  return {
    video: `${origin}/og/receipt-video/${moment}.mp4`,
    motion: `${origin}/assets/receipt/${moment}.webp`,
    art: `${origin}/assets/receipt/${moment}-poster.png`,
  };
}
