/**
 * FR6 use case: check a list of medicines against the on-device table.
 *
 * Pure and synchronous. Given the same input and the same table version it
 * returns the same report, every time, with no network and no clock. That is
 * what makes it testable at the 45-vignette scale the audit in Phase 12 needs.
 *
 * This file imports NOTHING outside the domain (requirement L2).
 */
import { InteractionRepository } from './ports';
import {
  Drug, InteractionFinding, InteractionReport, InteractionRule, Side,
  maxSeverity, severityRank,
} from './medicines';

export class CheckInteractionsUseCase {
  constructor(private readonly repo: InteractionRepository) {}

  execute(typedNames: readonly string[]): InteractionReport {
    /* ── 1. Resolve what the user typed ───────────────────────────────────── */

    const recognised: Drug[] = [];
    const unrecognised: string[] = [];
    const seen = new Set<string>();

    for (const raw of typedNames) {
      const text = raw.trim();
      if (!text) continue;

      const drug = this.repo.resolve(text);
      if (!drug) {
        // Preserve what they actually typed. Echoing a normalised guess back
        // would imply the app understood it.
        if (!unrecognised.includes(text)) unrecognised.push(text);
        continue;
      }
      // Two brands of the same generic are one drug. Checking paracetamol
      // against Panadol would otherwise produce a nonsense self-pairing.
      if (seen.has(drug.id)) continue;
      seen.add(drug.id);
      recognised.push(drug);
    }

    /* ── 2. Compare every unordered pair ──────────────────────────────────── */

    const rules = this.repo.rules();
    const findings: InteractionFinding[] = [];
    let pairsChecked = 0;

    for (let i = 0; i < recognised.length; i++) {
      for (let j = i + 1; j < recognised.length; j++) {
        const x = recognised[i]!;
        const y = recognised[j]!;
        pairsChecked++;

        for (const rule of rules) {
          if (!ruleMatchesPair(rule, x, y)) continue;
          findings.push({
            ruleId: rule.id,
            // Report the pair in the order the rule describes the risk, so the
            // effect sentence reads correctly rather than backwards.
            first: matches(rule.a, x) ? x.name : y.name,
            second: matches(rule.a, x) ? y.name : x.name,
            severity: rule.severity,
            action: rule.action,
            effect: rule.effect,
            advice: rule.advice,
            source: rule.source,
          });
        }
      }
    }

    /* ── 3. Order so the worst cannot be buried ───────────────────────────── */

    findings.sort((p, q) => {
      const bySeverity = severityRank(q.severity) - severityRank(p.severity);
      if (bySeverity !== 0) return bySeverity;
      return p.first.localeCompare(q.first);
    });

    const highest = findings.length
      ? findings.map((f) => f.severity).reduce(maxSeverity)
      : null;

    /* ── 4. Outcome ───────────────────────────────────────────────────────── */

    // Note the ordering: NOT_ENOUGH is decided by how many were *recognised*,
    // not how many were typed. Two unrecognised entries must not be reported
    // as a completed check that found nothing.
    const outcome =
      recognised.length < 2 ? 'NOT_ENOUGH'
      : findings.length === 0 ? 'CLEAR'
      : 'FINDINGS';

    return {
      outcome,
      highest,
      findings,
      recognised: recognised.map((d) => d.name),
      unrecognised,
      pairsChecked,
    };
  }
}

/* ────────────────────────────────  matching  ────────────────────────────── */

function matches(side: Side, drug: Drug): boolean {
  return side.kind === 'DRUG'
    ? side.id === drug.id
    : drug.classes.includes(side.cls);
}

/**
 * Rules are symmetric: the pair matches if either assignment works.
 *
 * The second clause guards a real trap. A class-versus-class rule such as
 * NSAID × ANTICOAGULANT would otherwise match a single drug that belongs to
 * both classes against itself - aspirin is both an NSAID and an antiplatelet -
 * producing a warning about taking one medicine with itself.
 */
function ruleMatchesPair(rule: InteractionRule, x: Drug, y: Drug): boolean {
  if (x.id === y.id) return false;
  return (matches(rule.a, x) && matches(rule.b, y))
      || (matches(rule.a, y) && matches(rule.b, x));
}
