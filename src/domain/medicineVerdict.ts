import { MedicineCheck } from './remote';

/*
 * The backend returns the verdict, the risk level, the conflict flags and the
 * advice as four independent fields, and they can disagree: a check has come
 * back reading "Generally Safe" and "RISK: LOW" while the advice said to avoid
 * taking the two drugs together and two critical markers were listed.
 *
 * This is the same rule the triage engine already applies to red flags. The
 * reported evidence sets a floor, the floor can only raise the band, and
 * nothing here can lower what the model said.
 */

export type RiskBand = 'UNKNOWN' | 'LOW' | 'MODERATE' | 'HIGH';

const ORDER: readonly RiskBand[] = ['UNKNOWN', 'LOW', 'MODERATE', 'HIGH'];

/** Words a result may use to say "go ahead", which evidence can contradict. */
const REASSURING = /\bsafe\b|\bno known\b|\bno interaction\b|\bcompatible\b|\bminimal\b/i;

export function toBand(riskLevel: string): RiskBand {
  const r = riskLevel.trim().toLowerCase();
  if (r === 'critical' || r === 'high' || r === 'severe') return 'HIGH';
  if (r === 'medium' || r === 'moderate') return 'MODERATE';
  if (r === 'low' || r === 'minimal' || r === 'none') return 'LOW';
  return 'UNKNOWN';
}

export interface DisplayedVerdict {
  /** Headline to show. Equals the model's verdict unless it had to be raised. */
  readonly verdict: string;
  /** Band to show. Never below the band the model reported. */
  readonly risk: RiskBand;
  /** True when the reported evidence outranked the reported band or verdict. */
  readonly escalated: boolean;
  /** Why it was raised, for display. Null when nothing was raised. */
  readonly reason: string | null;
}

/**
 * Reconciles the four fields so the screen cannot show a reassuring headline
 * next to evidence of a problem. Escalate-only: never returns a band lower
 * than `check.riskLevel`.
 */
export function reconcileMedicineCheck(check: MedicineCheck): DisplayedVerdict {
  const stated = toBand(check.riskLevel);
  const markers = check.warnings.length;
  const flags = check.conflictFlags.length;

  let floor: RiskBand = 'UNKNOWN';
  let reason: string | null = null;

  if (markers > 0 || flags > 0) {
    floor = 'MODERATE';
    reason = markers > 0
      ? `${markers} critical marker${markers === 1 ? ' was' : 's were'} reported`
      : `${flags} conflict flag${flags === 1 ? ' was' : 's were'} reported`;
  }
  if (check.dangerDetected) {
    floor = 'HIGH';
    reason = 'the check reported a danger';
  }

  const risk = ORDER.indexOf(floor) > ORDER.indexOf(stated) ? floor : stated;
  const raised = risk !== stated;

  const statedVerdict = check.compatibilityVerdict.trim();
  const misleading = raised && REASSURING.test(statedVerdict);

  return {
    verdict: misleading || (raised && statedVerdict.length === 0)
      ? 'Care needed'
      : statedVerdict,
    risk,
    escalated: raised,
    reason: raised ? reason : null,
  };
}
