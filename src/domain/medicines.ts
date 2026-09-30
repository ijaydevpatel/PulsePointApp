export type DrugClass =
  | 'NSAID'
  | 'ANTICOAGULANT'
  | 'ANTIPLATELET'
  | 'SSRI'
  | 'SNRI'
  | 'MAOI'
  | 'TRIPTAN'
  | 'OPIOID'
  | 'BENZODIAZEPINE'
  | 'ACE_INHIBITOR'
  | 'ARB'
  | 'POTASSIUM_SPARING_DIURETIC'
  | 'THIAZIDE_DIURETIC'
  | 'BETA_BLOCKER'
  | 'RATE_LIMITING_CCB'
  | 'STATIN'
  | 'MACROLIDE'
  | 'QUINOLONE'
  | 'NITRATE'
  | 'PDE5_INHIBITOR'
  | 'ANALGESIC'
  | 'PPI'
  | 'ANTIARRHYTHMIC'
  | 'CARDIAC_GLYCOSIDE'
  | 'MOOD_STABILISER'
  | 'IMMUNOSUPPRESSANT'
  | 'ANTIFOLATE'
  | 'XANTHINE'
  | 'XANTHINE_OXIDASE_INHIBITOR'
  | 'ANTIBIOTIC';

export interface Drug {
  readonly id: string;

  readonly name: string;
  readonly classes: readonly DrugClass[];

  readonly aliases: readonly string[];
}

export type InteractionSeverity = 'MAJOR' | 'MODERATE' | 'MINOR';

export const SEVERITY_ORDER: readonly InteractionSeverity[] = ['MINOR', 'MODERATE', 'MAJOR'];

export function severityRank(s: InteractionSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export function maxSeverity(a: InteractionSeverity, b: InteractionSeverity): InteractionSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export type InteractionAction =

  | 'AVOID'

  | 'DISCUSS'

  | 'MONITOR';

export type Side =
  | { readonly kind: 'DRUG'; readonly id: string }
  | { readonly kind: 'CLASS'; readonly cls: DrugClass };

export interface InteractionRule {
  readonly id: string;
  readonly a: Side;
  readonly b: Side;
  readonly severity: InteractionSeverity;
  readonly action: InteractionAction;

  readonly effect: string;

  readonly advice: string;

  readonly source: string;
}

export interface InteractionFinding {
  readonly ruleId: string;
  readonly first: string;
  readonly second: string;
  readonly severity: InteractionSeverity;
  readonly action: InteractionAction;
  readonly effect: string;
  readonly advice: string;
  readonly source: string;
}

export type CheckOutcome =

  | 'NOT_ENOUGH'

  | 'CLEAR'

  | 'FINDINGS';

export interface InteractionReport {
  readonly outcome: CheckOutcome;

  readonly highest: InteractionSeverity | null;

  readonly findings: readonly InteractionFinding[];

  readonly recognised: readonly string[];

  readonly unrecognised: readonly string[];

  readonly pairsChecked: number;
}

export function needsAttention(r: InteractionReport): boolean {
  return r.findings.some((f) => f.action === 'AVOID' || f.severity === 'MAJOR');
}

export const SEVERITY_LABEL: Record<InteractionSeverity, string> = {
  MAJOR: 'Major',
  MODERATE: 'Moderate',
  MINOR: 'Minor',
};

export const ACTION_LABEL: Record<InteractionAction, string> = {
  AVOID: 'Do not take together without advice',
  DISCUSS: 'Check with a pharmacist or GP',
  MONITOR: 'Usually manageable - know the signs',
};
