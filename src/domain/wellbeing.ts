import { HistoryEntry } from './ports';
import { TriageBand } from './entities';

const BAND_PENALTY: Record<TriageBand, number> = {
  SELF_CARE: 4,
  PHARMACY_GP: 12,
  URGENT: 28,
  EMERGENCY: 45,
};

const FLAG_PENALTY = 6;

export const SCORE_WINDOW_DAYS = 30;

export interface ScoreReason {
  readonly label: string;

  readonly delta: number;
}

export interface HealthScore {
  readonly value: number;
  readonly reasons: readonly ScoreReason[];

  readonly episodeCount: number;
  readonly windowDays: number;
}

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

  let worst: TriageBand = 'SELF_CARE';
  for (const h of recent) {
    if (BAND_PENALTY[h.result.band] > BAND_PENALTY[worst]) worst = h.result.band;
  }
  reasons.push({ label: `Most severe recent result: ${worst.replace('_', ' ').toLowerCase()}`, delta: -BAND_PENALTY[worst] });

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
  readonly days: number;

  readonly atRisk: boolean;
}

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
