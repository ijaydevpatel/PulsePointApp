/**
 * Health score and check-in streak, computed from what the device actually
 * holds.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The backend declares `healthScore` (default 100) and `streak` (default 0) on
 * the Profile schema and never writes to either. The website renders those
 * defaults, so every account shows 100/100 regardless of anything the person
 * has recorded. A health app displaying an uncomputed "100 / 100" is offering
 * reassurance with nothing behind it, which is worse than showing no score at
 * all.
 *
 * Both figures below are derived from real episode history, and both expose
 * the reasoning that produced them so the UI can show its working rather than
 * asking to be trusted.
 *
 * ── What the score is, and is not ────────────────────────────────────────────
 *
 * It is a summary of what this app has observed: how severe recent
 * assessments were and whether any red flags are outstanding. It is not a
 * measure of health. It cannot see blood pressure, sleep, bloods or anything
 * the person did not enter, so it is deliberately named and worded as a
 * summary of *recorded* activity, and the UI says as much.
 *
 * It only ever moves on evidence. With no episodes there is no score - the
 * function returns null rather than 100, because "nothing recorded" and
 * "everything is fine" are different states and conflating them is the exact
 * failure in the web version.
 */
import { HistoryEntry } from './ports';
import { TriageBand } from './entities';

/* ─────────────────────────────── score ──────────────────────────────────── */

/**
 * Points deducted per band, for the most severe episode in the window.
 *
 * The weights are ordinal, not clinical: they encode "an urgent result should
 * pull the summary down further than a self-care one", which is a statement
 * about the summary rather than about medicine. No threshold here is claimed
 * to be a validated cut-off.
 */
const BAND_PENALTY: Record<TriageBand, number> = {
  SELF_CARE: 4,
  PHARMACY_GP: 12,
  URGENT: 28,
  EMERGENCY: 45,
};

/** Each distinct red flag still outstanding in the window. */
const FLAG_PENALTY = 6;

/** Episodes older than this stop counting toward the current score. */
export const SCORE_WINDOW_DAYS = 30;

export interface ScoreReason {
  readonly label: string;
  /** Negative numbers only - the score starts at 100 and is deducted from. */
  readonly delta: number;
}

export interface HealthScore {
  readonly value: number;
  readonly reasons: readonly ScoreReason[];
  /** Episodes the score was computed from. */
  readonly episodeCount: number;
  readonly windowDays: number;
}

/**
 * Null when there is nothing to score.
 *
 * The caller must render that as "no assessments yet", never as a number.
 */
export function healthScore(
  history: readonly HistoryEntry[],
  now: number = Date.now(),
): HealthScore | null {
  const cutoff = now - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const recent = history.filter((h) => {
    const t = new Date(h.episode.capturedAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });

  if (recent.length === 0) return null;

  const reasons: ScoreReason[] = [];

  /*
   * The worst band in the window, not an average. Averaging lets a run of
   * mild episodes dilute a single urgent one, which is precisely the episode
   * the summary should not be quiet about.
   */
  let worst: TriageBand = 'SELF_CARE';
  for (const h of recent) {
    if (BAND_PENALTY[h.result.band] > BAND_PENALTY[worst]) worst = h.result.band;
  }
  reasons.push({ label: `Most severe recent result: ${worst.replace('_', ' ').toLowerCase()}`, delta: -BAND_PENALTY[worst] });

  /* Distinct flags, so one recurring symptom is not counted five times. */
  const flags = new Set<string>();
  for (const h of recent) for (const f of h.result.redFlags) flags.add(f);
  if (flags.size > 0) {
    reasons.push({
      label: flags.size === 1 ? '1 red flag recorded' : `${flags.size} red flags recorded`,
      delta: -Math.min(flags.size * FLAG_PENALTY, 30),
    });
  }

  const deducted = reasons.reduce((n, r) => n + r.delta, 0);
  const value = Math.max(0, Math.min(100, 100 + deducted));

  return { value, reasons, episodeCount: recent.length, windowDays: SCORE_WINDOW_DAYS };
}

/* ─────────────────────────────── streak ─────────────────────────────────── */

/** Local calendar day as YYYY-MM-DD, so a streak counts days not 24h blocks. */
function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDays(key: string, by: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + by);
  return dayKey(dt.toISOString())!;
}

export interface Streak {
  /** Consecutive days, counting back from today or yesterday. */
  readonly days: number;
  /** True while today has no check-in but yesterday did - the streak is
   *  alive and will break at midnight. */
  readonly atRisk: boolean;
}

/**
 * Consecutive calendar days with at least one assessment.
 *
 * Counts back from today; if today has nothing but yesterday does, the streak
 * still stands and is reported as at risk. Anything older than that is a
 * broken streak and returns zero - a streak that survives gaps is not a
 * streak, and inflating it would be the same dishonesty as the default 100.
 */
export function checkInStreak(
  history: readonly HistoryEntry[],
  now: number = Date.now(),
): Streak {
  const days = new Set<string>();
  for (const h of history) {
    const k = dayKey(h.episode.capturedAt);
    if (k) days.add(k);
  }
  if (days.size === 0) return { days: 0, atRisk: false };

  const today = dayKey(new Date(now).toISOString())!;
  const yesterday = shiftDays(today, -1);

  let cursor: string;
  let atRisk: boolean;

  if (days.has(today)) {
    cursor = today;
    atRisk = false;
  } else if (days.has(yesterday)) {
    cursor = yesterday;
    atRisk = true;
  } else {
    return { days: 0, atRisk: false };
  }

  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftDays(cursor, -1);
  }

  return { days: count, atRisk };
}
