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
};

/** Moments with recorded art in assets/receipt/ (<m>.mp4, <m>.webp,
 *  <m>-poster.png). The others print the slip without a picture until
 *  their clips are recorded from the app's clip stage. */
export const HAS_ART = new Set(['pouch-fill', 'big-money', 'burnt-joker', 'heart-eyes']);

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
      table = { date: dd, table: Math.max(-150, Math.min(9999, Number(tbRaw))), closeness: Number(clRaw), fedCount: Number(fdRaw), pace: Number(pcRaw) };
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

  return { moment, outcome, handLine, points, pattern, chips, jokerless, selfPick, away, winnerSeat, table, code, date };
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

/** The Daily Deal's score from its parts (engine/dailyTable in the app):
 *  table + closeness + fed, fed being −5 a discard called, floor −20. */
export function tableFedPoints(fedCount) {
  const n = Number.isFinite(fedCount) && fedCount > 0 ? Math.floor(fedCount) : 0;
  return Math.max(-20, -5 * n);
}
export function tableScore(t) {
  return t.table + t.closeness + tableFedPoints(t.fedCount);
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
      const away = r.away;
      lines.push({ l: away === null ? 'NO READABLE HAND' : away <= 0 ? 'READY FOR MAHJONG' : `${away} AWAY`, r: signedPoints(t.closeness) });
    }
    lines.push({ l: `FED ${t.fedCount}`, r: signedPoints(tableFedPoints(t.fedCount)) });
    lines.push({ l: 'WALL DRAWS', r: String(t.pace), dim: true });
    lines.push('---');
    lines.push({ l: 'TOTAL', r: `${signedPoints(tableScore(t))} PTS`, bold: true });
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

/** The words around the slip: the page title / OG title + description. */
export function receiptCopy(r, name) {
  const stat = [r.handLine, r.points ? `${r.points} pts` : null].filter(Boolean).join(' · ');
  const who = name ?? null;
  // A ranked Daily Deal leads with the day and the score; the game's own
  // story follows in the description.
  if (r.table) {
    const score = signedPoints(tableScore(r.table));
    const dealLine = `Daily Deal · ${shortDay(r.table.date)} · ${score} · wall ${r.table.pace}`;
    return {
      title: who ? `${who} scored ${score} on the Daily Deal` : `${score} on the Daily Deal · ${shortDay(r.table.date)}`,
      description: `${dealLine}${stat ? ` — ${headline(r).replace('!', '')} on ${stat}` : ''}. Play this deal on Mahjong Alley.`,
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
