import { InteractionRepository } from './ports';
import {
  Drug, InteractionFinding, InteractionReport, InteractionRule, Side,
  maxSeverity, severityRank,
} from './medicines';

export class CheckInteractionsUseCase {
  constructor(private readonly repo: InteractionRepository) {}

  execute(typedNames: readonly string[]): InteractionReport {
    const recognised: Drug[] = [];
    const unrecognised: string[] = [];
    const seen = new Set<string>();

    for (const raw of typedNames) {
      const text = raw.trim();
      if (!text) continue;

      const drug = this.repo.resolve(text);
      if (!drug) {
        if (!unrecognised.includes(text)) unrecognised.push(text);
        continue;
      }

      if (seen.has(drug.id)) continue;
      seen.add(drug.id);
      recognised.push(drug);
    }

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

    findings.sort((p, q) => {
      const bySeverity = severityRank(q.severity) - severityRank(p.severity);
      if (bySeverity !== 0) return bySeverity;
      return p.first.localeCompare(q.first);
    });

    const highest = findings.length
      ? findings.map((f) => f.severity).reduce(maxSeverity)
      : null;

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

function matches(side: Side, drug: Drug): boolean {
  return side.kind === 'DRUG'
    ? side.id === drug.id
    : drug.classes.includes(side.cls);
}

function ruleMatchesPair(rule: InteractionRule, x: Drug, y: Drug): boolean {
  if (x.id === y.id) return false;
  return (matches(rule.a, x) && matches(rule.b, y))
      || (matches(rule.a, y) && matches(rule.b, x));
}
