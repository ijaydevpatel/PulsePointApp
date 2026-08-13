/**
 * Medicine interaction domain. FR6.
 *
 * This file imports NOTHING — no React, no SQLite, no network (requirement L2).
 *
 * ── Why this feature exists in the form it does ──────────────────────────────
 *
 * The web app's interaction checker calls a language model over the network. In
 * testing on 12 Aug it was given Warfarin + Aspirin — one of the most
 * clinically significant common interactions there is — and returned nothing at
 * all. No result, no error, just "Awaiting Synchronization". A user would
 * reasonably read a blank panel as "no interaction found", which is the exact
 * opposite of the truth.
 *
 * Three design rules follow from that failure, and they are enforced by types
 * here rather than by discipline at the call site:
 *
 *   1. The check is a pure function over a local table. It cannot depend on a
 *      network, so it cannot fail silently when one is missing.
 *
 *   2. There is no "safe" verdict. The result type distinguishes "no
 *      interaction found in this table" from "safe", because this table is a
 *      curated subset and absence of a rule is not evidence of absence of risk.
 *
 *   3. Unrecognised medicines are a first-class part of the result, not a
 *      silent no-op. If the user types something the table does not know, the
 *      UI is obliged to say so — an unmatched drug producing a clean-looking
 *      result is precisely the failure mode being fixed.
 */

/* ─────────────────────────────────  drugs  ──────────────────────────────── */

/**
 * Pharmacological classes. Interactions are overwhelmingly class effects — all
 * NSAIDs raise bleeding risk with warfarin, not just ibuprofen — so rules match
 * on class where the evidence is a class effect, and on the specific drug where
 * it is not (for example clarithromycin with simvastatin, which is a CYP3A4
 * effect specific to certain statins).
 */
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

/** One medicine the table knows about. */
export interface Drug {
  /** Canonical lowercase generic name. Stable identifier. */
  readonly id: string;
  /** How it is shown back to the user. */
  readonly name: string;
  readonly classes: readonly DrugClass[];
  /**
   * Brand names and common spellings, lowercase. Someone holding a box reads
   * the brand, not the generic, so matching only on generic names would fail
   * the exact situation this feature is for — standing in a pharmacy.
   */
  readonly aliases: readonly string[];
}

/* ──────────────────────────────  interactions  ──────────────────────────── */

/**
 * Severity, in the sense used by clinical references rather than by triage.
 * Deliberately a separate type from TriageBand: conflating "this drug pair is
 * dangerous" with "you should go to hospital" would let one leak into the other.
 */
export type InteractionSeverity = 'MAJOR' | 'MODERATE' | 'MINOR';

export const SEVERITY_ORDER: readonly InteractionSeverity[] = ['MINOR', 'MODERATE', 'MAJOR'];

export function severityRank(s: InteractionSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export function maxSeverity(a: InteractionSeverity, b: InteractionSeverity): InteractionSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

/** What the user is being told to do. Kept separate from the explanation. */
export type InteractionAction =
  /** Do not take together without prescriber advice. */
  | 'AVOID'
  /** Can be appropriate, but needs a pharmacist or GP to agree it. */
  | 'DISCUSS'
  /** Usually manageable; know what to watch for. */
  | 'MONITOR';

/**
 * A matcher for one side of a rule: either a specific drug, or any drug in a
 * class. Rules are symmetric — order of entry must not change the result.
 */
export type Side =
  | { readonly kind: 'DRUG'; readonly id: string }
  | { readonly kind: 'CLASS'; readonly cls: DrugClass };

export interface InteractionRule {
  readonly id: string;
  readonly a: Side;
  readonly b: Side;
  readonly severity: InteractionSeverity;
  readonly action: InteractionAction;
  /** One sentence, plain language, naming the actual risk. */
  readonly effect: string;
  /** What to watch for or do. Never "stop taking your medicine". */
  readonly advice: string;
  /** Where the rule comes from, so it can be checked and kept current. */
  readonly source: string;
}

/* ────────────────────────────────  results  ─────────────────────────────── */

/** A rule that fired, with the two medicines the user actually entered. */
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

/**
 * The outcome of a check.
 *
 * Note what is absent: there is no `safe: boolean`. The three states below are
 * exhaustive and none of them means "safe". `CLEAR` means only that no rule in
 * this table matched, which the UI is required to word accordingly.
 */
export type CheckOutcome =
  /** Fewer than two recognised medicines — nothing could be compared. */
  | 'NOT_ENOUGH'
  /** Compared, and no rule in this table matched. */
  | 'CLEAR'
  /** At least one rule matched. */
  | 'FINDINGS';

export interface InteractionReport {
  readonly outcome: CheckOutcome;
  /** Highest severity found, or null when there are no findings. */
  readonly highest: InteractionSeverity | null;
  /** Sorted most severe first, so the UI cannot bury the worst one. */
  readonly findings: readonly InteractionFinding[];
  /** Recognised medicines, by display name. */
  readonly recognised: readonly string[];
  /**
   * What the user typed that the table does not know. Surfaced, never dropped.
   * A result computed over a subset of the user's medicines, presented as if it
   * covered all of them, is worse than no result at all.
   */
  readonly unrecognised: readonly string[];
  /** How many pairs were actually compared. Lets the UI show its working. */
  readonly pairsChecked: number;
}

/** True when the report contains something the user must act on. */
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
  MONITOR: 'Usually manageable — know the signs',
};
