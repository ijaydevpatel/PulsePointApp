import { Drug, InteractionRule } from '../domain/medicines';
import { InteractionRepository } from '../domain/ports';

const DRUGS: readonly Drug[] = [

  { id: 'paracetamol', name: 'Paracetamol', classes: ['ANALGESIC'],
    aliases: ['panadol', 'pamol', 'acetaminophen', 'paracetemol', 'panadeine'] },
  { id: 'ibuprofen', name: 'Ibuprofen', classes: ['NSAID'],
    aliases: ['nurofen', 'brufen', 'advil', 'ibugesic'] },
  { id: 'naproxen', name: 'Naproxen', classes: ['NSAID'],
    aliases: ['naprosyn', 'noflam', 'aleve'] },
  { id: 'diclofenac', name: 'Diclofenac', classes: ['NSAID'],
    aliases: ['voltaren', 'apo-diclo'] },
  { id: 'celecoxib', name: 'Celecoxib', classes: ['NSAID'],
    aliases: ['celebrex'] },
  { id: 'aspirin', name: 'Aspirin', classes: ['NSAID', 'ANTIPLATELET'],
    aliases: ['acetylsalicylic acid', 'aspec', 'cartia', 'disprin', 'asasantin'] },

  { id: 'warfarin', name: 'Warfarin', classes: ['ANTICOAGULANT'],
    aliases: ['coumadin', 'marevan'] },
  { id: 'dabigatran', name: 'Dabigatran', classes: ['ANTICOAGULANT'],
    aliases: ['pradaxa'] },
  { id: 'rivaroxaban', name: 'Rivaroxaban', classes: ['ANTICOAGULANT'],
    aliases: ['xarelto'] },
  { id: 'enoxaparin', name: 'Enoxaparin', classes: ['ANTICOAGULANT'],
    aliases: ['clexane', 'heparin'] },
  { id: 'clopidogrel', name: 'Clopidogrel', classes: ['ANTIPLATELET'],
    aliases: ['plavix', 'clopidin'] },

  { id: 'fluoxetine', name: 'Fluoxetine', classes: ['SSRI'], aliases: ['prozac', 'fluox'] },
  { id: 'citalopram', name: 'Citalopram', classes: ['SSRI'], aliases: ['cipramil', 'celapram'] },
  { id: 'escitalopram', name: 'Escitalopram', classes: ['SSRI'], aliases: ['lexapro', 'loxalate'] },
  { id: 'sertraline', name: 'Sertraline', classes: ['SSRI'], aliases: ['zoloft', 'setrona'] },
  { id: 'paroxetine', name: 'Paroxetine', classes: ['SSRI'], aliases: ['aropax', 'paxil'] },
  { id: 'venlafaxine', name: 'Venlafaxine', classes: ['SNRI'], aliases: ['efexor', 'enlafax'] },
  { id: 'duloxetine', name: 'Duloxetine', classes: ['SNRI'], aliases: ['cymbalta'] },
  { id: 'moclobemide', name: 'Moclobemide', classes: ['MAOI'], aliases: ['aurorix'] },
  { id: 'tranylcypromine', name: 'Tranylcypromine', classes: ['MAOI'], aliases: ['parnate'] },

  { id: 'tramadol', name: 'Tramadol', classes: ['OPIOID'], aliases: ['tramal', 'zydol'] },
  { id: 'codeine', name: 'Codeine', classes: ['OPIOID'], aliases: ['codalgin', 'panadeine forte'] },
  { id: 'morphine', name: 'Morphine', classes: ['OPIOID'], aliases: ['sevredol', 'm-eslon'] },
  { id: 'oxycodone', name: 'Oxycodone', classes: ['OPIOID'], aliases: ['oxynorm', 'oxycontin'] },
  { id: 'diazepam', name: 'Diazepam', classes: ['BENZODIAZEPINE'], aliases: ['valium', 'stesolid'] },
  { id: 'lorazepam', name: 'Lorazepam', classes: ['BENZODIAZEPINE'], aliases: ['ativan'] },
  { id: 'zopiclone', name: 'Zopiclone', classes: ['BENZODIAZEPINE'], aliases: ['imovane', 'zimovane'] },

  { id: 'sumatriptan', name: 'Sumatriptan', classes: ['TRIPTAN'], aliases: ['imigran', 'imitrex'] },
  { id: 'rizatriptan', name: 'Rizatriptan', classes: ['TRIPTAN'], aliases: ['maxalt'] },

  { id: 'cilazapril', name: 'Cilazapril', classes: ['ACE_INHIBITOR'], aliases: ['inhibace'] },
  { id: 'lisinopril', name: 'Lisinopril', classes: ['ACE_INHIBITOR'], aliases: ['zestril', 'accupril'] },
  { id: 'enalapril', name: 'Enalapril', classes: ['ACE_INHIBITOR'], aliases: ['renitec'] },
  { id: 'quinapril', name: 'Quinapril', classes: ['ACE_INHIBITOR'], aliases: ['accupro'] },
  { id: 'candesartan', name: 'Candesartan', classes: ['ARB'], aliases: ['atacand'] },
  { id: 'losartan', name: 'Losartan', classes: ['ARB'], aliases: ['cozaar'] },
  { id: 'spironolactone', name: 'Spironolactone', classes: ['POTASSIUM_SPARING_DIURETIC'],
    aliases: ['aldactone', 'spiractin'] },
  { id: 'amiloride', name: 'Amiloride', classes: ['POTASSIUM_SPARING_DIURETIC'], aliases: ['midamor'] },
  { id: 'bendroflumethiazide', name: 'Bendroflumethiazide', classes: ['THIAZIDE_DIURETIC'],
    aliases: ['bendrofluazide', 'aprinox'] },
  { id: 'metoprolol', name: 'Metoprolol', classes: ['BETA_BLOCKER'], aliases: ['betaloc', 'lopresor'] },
  { id: 'atenolol', name: 'Atenolol', classes: ['BETA_BLOCKER'], aliases: ['tenormin'] },
  { id: 'bisoprolol', name: 'Bisoprolol', classes: ['BETA_BLOCKER'], aliases: ['bicor'] },
  { id: 'verapamil', name: 'Verapamil', classes: ['RATE_LIMITING_CCB'], aliases: ['isoptin'] },
  { id: 'diltiazem', name: 'Diltiazem', classes: ['RATE_LIMITING_CCB'], aliases: ['cardizem', 'dilzem'] },
  { id: 'digoxin', name: 'Digoxin', classes: ['CARDIAC_GLYCOSIDE'], aliases: ['lanoxin'] },
  { id: 'amiodarone', name: 'Amiodarone', classes: ['ANTIARRHYTHMIC'], aliases: ['cordarone', 'aratac'] },
  { id: 'isosorbide', name: 'Isosorbide mononitrate', classes: ['NITRATE'],
    aliases: ['imdur', 'duride', 'glyceryl trinitrate', 'gtn', 'nitrolingual'] },
  { id: 'sildenafil', name: 'Sildenafil', classes: ['PDE5_INHIBITOR'], aliases: ['viagra', 'revatio'] },
  { id: 'tadalafil', name: 'Tadalafil', classes: ['PDE5_INHIBITOR'], aliases: ['cialis'] },

  { id: 'simvastatin', name: 'Simvastatin', classes: ['STATIN'], aliases: ['lipex', 'zocor'] },
  { id: 'atorvastatin', name: 'Atorvastatin', classes: ['STATIN'], aliases: ['lipitor', 'zarator'] },
  { id: 'rosuvastatin', name: 'Rosuvastatin', classes: ['STATIN'], aliases: ['crestor'] },

  { id: 'clarithromycin', name: 'Clarithromycin', classes: ['MACROLIDE', 'ANTIBIOTIC'], aliases: ['klacid'] },
  { id: 'erythromycin', name: 'Erythromycin', classes: ['MACROLIDE', 'ANTIBIOTIC'], aliases: ['eryc', 'e-mycin'] },
  { id: 'ciprofloxacin', name: 'Ciprofloxacin', classes: ['QUINOLONE', 'ANTIBIOTIC'], aliases: ['ciproxin', 'cipflox'] },
  { id: 'amoxicillin', name: 'Amoxicillin', classes: ['ANTIBIOTIC'], aliases: ['amoxil', 'ospamox', 'augmentin'] },
  { id: 'trimethoprim', name: 'Trimethoprim', classes: ['ANTIFOLATE', 'ANTIBIOTIC'],
    aliases: ['trisul', 'co-trimoxazole', 'trimethoprim-sulfamethoxazole'] },
  { id: 'metronidazole', name: 'Metronidazole', classes: ['ANTIBIOTIC'], aliases: ['flagyl', 'trichozole'] },

  { id: 'omeprazole', name: 'Omeprazole', classes: ['PPI'], aliases: ['losec', 'omezol'] },
  { id: 'pantoprazole', name: 'Pantoprazole', classes: ['PPI'], aliases: ['somac', 'protonix'] },
  { id: 'lithium', name: 'Lithium', classes: ['MOOD_STABILISER'], aliases: ['lithicarb', 'priadel'] },
  { id: 'methotrexate', name: 'Methotrexate', classes: ['IMMUNOSUPPRESSANT'], aliases: ['methoblastin'] },
  { id: 'azathioprine', name: 'Azathioprine', classes: ['IMMUNOSUPPRESSANT'], aliases: ['imuran'] },
  { id: 'allopurinol', name: 'Allopurinol', classes: ['XANTHINE_OXIDASE_INHIBITOR'],
    aliases: ['zyloprim', 'apo-allopurinol'] },
  { id: 'theophylline', name: 'Theophylline', classes: ['XANTHINE'], aliases: ['nuelin', 'aminophylline'] },
  { id: 'metformin', name: 'Metformin', classes: [], aliases: ['glucophage', 'diabex', 'metomin'] },
  { id: 'salbutamol', name: 'Salbutamol', classes: [], aliases: ['ventolin', 'asmol', 'albuterol'] },
  { id: 'prednisone', name: 'Prednisone', classes: [], aliases: ['apo-prednisone', 'prednisolone'] },
];

const D = (id: string) => ({ kind: 'DRUG' as const, id });
const C = (cls: Drug['classes'][number]) => ({ kind: 'CLASS' as const, cls });

const NZF = 'New Zealand Formulary - interactions';

const RULES: readonly InteractionRule[] = [

  {
    id: 'IX-ANTICOAG-NSAID',
    a: C('ANTICOAGULANT'), b: C('NSAID'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Together these markedly increase the risk of serious bleeding, including bleeding in the stomach and gut.',
    advice: 'Do not start an anti-inflammatory while on a blood thinner without asking your prescriber. Paracetamol is usually the safer choice for pain. Seek urgent help for black or bloody stools, vomiting blood, or unusual bruising.',
    source: NZF,
  },
  {
    id: 'IX-ANTICOAG-ANTIPLATELET',
    a: C('ANTICOAGULANT'), b: C('ANTIPLATELET'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both reduce clotting by different routes, so taking them together raises bleeding risk substantially.',
    advice: 'This combination is sometimes prescribed deliberately after a stent or heart attack. If nobody has told you to take both, check with your pharmacist or GP before continuing.',
    source: NZF,
  },
  {
    id: 'IX-SSRI-ANTICOAG',
    a: C('SSRI'), b: C('ANTICOAGULANT'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'SSRIs reduce the ability of platelets to clot, which adds to the effect of a blood thinner.',
    advice: 'Often used together safely, but worth flagging. Watch for easy bruising, nosebleeds that are hard to stop, or blood in your stools.',
    source: NZF,
  },
  {
    id: 'IX-SSRI-NSAID',
    a: C('SSRI'), b: C('NSAID'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'This pairing raises the risk of bleeding in the stomach and gut more than either medicine alone.',
    advice: 'Ask your pharmacist whether you need stomach protection, or whether paracetamol would do instead.',
    source: NZF,
  },
  {
    id: 'IX-WARFARIN-PARACETAMOL',
    a: D('warfarin'), b: D('paracetamol'),
    severity: 'MINOR', action: 'MONITOR',
    effect: 'Regular full-dose paracetamol over several days can increase the effect of warfarin.',
    advice: 'Occasional use is fine. If you are taking it regularly for more than a few days, mention it at your next INR check.',
    source: NZF,
  },
  {
    id: 'IX-WARFARIN-AMIODARONE',
    a: D('warfarin'), b: D('amiodarone'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Amiodarone slows the breakdown of warfarin, which can raise your INR and cause bleeding.',
    advice: 'Your warfarin dose usually needs reducing and your INR checking more often. Do not adjust the dose yourself.',
    source: NZF,
  },
  {
    id: 'IX-CLOPIDOGREL-PPI',
    a: D('clopidogrel'), b: D('omeprazole'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Omeprazole can reduce how well clopidogrel works, which may make it less protective against clots.',
    advice: 'Pantoprazole is generally preferred with clopidogrel. Ask your pharmacist about switching.',
    source: NZF,
  },

  {
    id: 'IX-MAOI-SSRI',
    a: C('MAOI'), b: C('SSRI'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Combining these can cause serotonin syndrome, which can be life-threatening.',
    advice: 'These should not be taken together, and a gap is needed when switching between them. Contact your prescriber before taking both. Get urgent help for agitation, a racing heart, high fever, muscle twitching or confusion.',
    source: NZF,
  },
  {
    id: 'IX-MAOI-SNRI',
    a: C('MAOI'), b: C('SNRI'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Combining these can cause serotonin syndrome, which can be life-threatening.',
    advice: 'These should not be taken together. Contact your prescriber before taking both. Get urgent help for agitation, a racing heart, high fever, muscle twitching or confusion.',
    source: NZF,
  },
  {
    id: 'IX-SSRI-TRAMADOL',
    a: C('SSRI'), b: D('tramadol'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both raise serotonin levels, and tramadol also lowers the seizure threshold. Together they raise the risk of serotonin syndrome and of seizures.',
    advice: 'Sometimes prescribed together with care. If it was not prescribed as a pair, check before taking. Get urgent help for agitation, a racing heart, fever, muscle twitching or confusion.',
    source: NZF,
  },
  {
    id: 'IX-SNRI-TRAMADOL',
    a: C('SNRI'), b: D('tramadol'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both raise serotonin levels, increasing the risk of serotonin syndrome and of seizures.',
    advice: 'Check with your prescriber before taking these together. Get urgent help for agitation, a racing heart, fever or confusion.',
    source: NZF,
  },
  {
    id: 'IX-SSRI-TRIPTAN',
    a: C('SSRI'), b: C('TRIPTAN'),
    severity: 'MODERATE', action: 'MONITOR',
    effect: 'A small added risk of serotonin syndrome when a migraine triptan is taken with an SSRI.',
    advice: 'Widely used together. Be aware of the signs - agitation, a racing heart, shivering, muscle twitching - particularly after a dose increase.',
    source: NZF,
  },

  {
    id: 'IX-OPIOID-BENZO',
    a: C('OPIOID'), b: C('BENZODIAZEPINE'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Together these can slow your breathing dangerously, particularly when you are asleep.',
    advice: 'Avoid unless a prescriber has specifically told you to take both, and never add alcohol. Seek urgent help if breathing becomes slow or shallow, or you cannot rouse someone.',
    source: NZF,
  },

  {
    id: 'IX-ACE-POTASSIUM',
    a: C('ACE_INHIBITOR'), b: C('POTASSIUM_SPARING_DIURETIC'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both raise blood potassium. Too much potassium can cause dangerous heart rhythms.',
    advice: 'This pair is often prescribed together deliberately in heart failure, with regular blood tests. Make sure your potassium is being checked.',
    source: NZF,
  },
  {
    id: 'IX-ARB-POTASSIUM',
    a: C('ARB'), b: C('POTASSIUM_SPARING_DIURETIC'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both raise blood potassium, which can cause dangerous heart rhythms.',
    advice: 'Sometimes intended, with monitoring. Confirm your potassium and kidney function are being checked regularly.',
    source: NZF,
  },
  {
    id: 'IX-ACE-NSAID',
    a: C('ACE_INHIBITOR'), b: C('NSAID'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Anti-inflammatories reduce how well blood pressure medicines work and can strain the kidneys, especially alongside a diuretic.',
    advice: 'Occasional use is usually fine. Avoid regular anti-inflammatories without advice, and keep well hydrated.',
    source: NZF,
  },
  {
    id: 'IX-ARB-NSAID',
    a: C('ARB'), b: C('NSAID'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Anti-inflammatories blunt the blood-pressure effect and can strain the kidneys.',
    advice: 'Prefer paracetamol for regular pain relief, and check with your pharmacist before ongoing anti-inflammatory use.',
    source: NZF,
  },
  {
    id: 'IX-ACE-ARB',
    a: C('ACE_INHIBITOR'), b: C('ARB'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'These work on the same system, and combining them raises the risk of kidney problems, high potassium and low blood pressure without much added benefit.',
    advice: 'This combination is generally avoided. If you are taking both, check with your GP that it is intended.',
    source: NZF,
  },

  {
    id: 'IX-LITHIUM-NSAID',
    a: D('lithium'), b: C('NSAID'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Anti-inflammatories reduce how much lithium your kidneys clear, which can push lithium to toxic levels.',
    advice: 'Use paracetamol instead unless your prescriber has said otherwise. Get help for vomiting, diarrhoea, coarse tremor, slurred speech or unsteadiness.',
    source: NZF,
  },
  {
    id: 'IX-LITHIUM-ACE',
    a: D('lithium'), b: C('ACE_INHIBITOR'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'ACE inhibitors can raise lithium levels toward the toxic range.',
    advice: 'Needs closer lithium monitoring. Do not stop either medicine on your own - ask your prescriber.',
    source: NZF,
  },
  {
    id: 'IX-LITHIUM-THIAZIDE',
    a: D('lithium'), b: C('THIAZIDE_DIURETIC'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Thiazide diuretics reduce lithium clearance and can raise it to toxic levels.',
    advice: 'Needs lithium monitoring. Watch for tremor, vomiting, diarrhoea or unsteadiness.',
    source: NZF,
  },

  {
    id: 'IX-BETA-CCB',
    a: C('BETA_BLOCKER'), b: C('RATE_LIMITING_CCB'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Both slow the heart, and together they can slow it too much or cause heart block.',
    advice: 'Only take together if specifically prescribed. Report dizziness, fainting, or a pulse under about 50.',
    source: NZF,
  },
  {
    id: 'IX-DIGOXIN-AMIODARONE',
    a: D('digoxin'), b: D('amiodarone'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Amiodarone raises digoxin levels, which can cause digoxin toxicity.',
    advice: 'The digoxin dose is usually halved when amiodarone starts. Report nausea, visual disturbance or a very slow pulse.',
    source: NZF,
  },
  {
    id: 'IX-DIGOXIN-VERAPAMIL',
    a: D('digoxin'), b: D('verapamil'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Verapamil raises digoxin levels and slows the heart further.',
    advice: 'Needs dose adjustment and monitoring. Report nausea, vision changes or a very slow pulse.',
    source: NZF,
  },
  {
    id: 'IX-NITRATE-PDE5',
    a: C('NITRATE'), b: C('PDE5_INHIBITOR'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Together these can cause a sudden, severe drop in blood pressure.',
    advice: 'Do not take an erectile dysfunction medicine with any nitrate, including a GTN spray. Tell any doctor treating chest pain if you have taken one.',
    source: NZF,
  },

  {
    id: 'IX-SIMVASTATIN-MACROLIDE',
    a: D('simvastatin'), b: C('MACROLIDE'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'These antibiotics slow the breakdown of simvastatin, which can cause severe muscle damage.',
    advice: 'The statin is usually paused for the antibiotic course. Report muscle pain, tenderness or dark urine promptly.',
    source: NZF,
  },
  {
    id: 'IX-ATORVASTATIN-MACROLIDE',
    a: D('atorvastatin'), b: C('MACROLIDE'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Clarithromycin and erythromycin raise atorvastatin levels, increasing the risk of muscle damage.',
    advice: 'Ask your pharmacist whether to pause the statin for the antibiotic course. Report muscle pain or dark urine.',
    source: NZF,
  },
  {
    id: 'IX-METHOTREXATE-TRIMETHOPRIM',
    a: D('methotrexate'), b: D('trimethoprim'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Both block folate. Together they can severely suppress the bone marrow.',
    advice: 'This pairing is generally avoided - ask for a different antibiotic. Report mouth ulcers, sore throat, fever or unusual bruising urgently.',
    source: NZF,
  },
  {
    id: 'IX-METHOTREXATE-NSAID',
    a: D('methotrexate'), b: C('NSAID'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Anti-inflammatories reduce methotrexate clearance, which can increase its toxicity.',
    advice: 'Common at low weekly methotrexate doses with monitoring. Confirm your blood tests are up to date.',
    source: NZF,
  },
  {
    id: 'IX-ALLOPURINOL-AZATHIOPRINE',
    a: D('allopurinol'), b: D('azathioprine'),
    severity: 'MAJOR', action: 'AVOID',
    effect: 'Allopurinol blocks the breakdown of azathioprine, which can cause life-threatening bone marrow suppression.',
    advice: 'Requires a large azathioprine dose reduction and specialist supervision. Do not take both unless this has been arranged.',
    source: NZF,
  },
  {
    id: 'IX-THEOPHYLLINE-QUINOLONE',
    a: D('theophylline'), b: C('QUINOLONE'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Ciprofloxacin raises theophylline levels, which can cause seizures and dangerous heart rhythms.',
    advice: 'Ask for a different antibiotic where possible. Report nausea, agitation, palpitations or tremor.',
    source: NZF,
  },
  {
    id: 'IX-THEOPHYLLINE-MACROLIDE',
    a: D('theophylline'), b: C('MACROLIDE'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Macrolide antibiotics can raise theophylline levels toward the toxic range.',
    advice: 'Mention it to your pharmacist. Report nausea, palpitations or tremor.',
    source: NZF,
  },

  {
    id: 'IX-NSAID-NSAID',
    a: C('NSAID'), b: C('NSAID'),
    severity: 'MODERATE', action: 'AVOID',
    effect: 'Taking two anti-inflammatories together adds their stomach and kidney risks without adding pain relief.',
    advice: 'Use one at a time. Low-dose aspirin taken for the heart is a separate case - check with your pharmacist rather than stopping it.',
    source: NZF,
  },
  {
    id: 'IX-SSRI-SSRI',
    a: C('SSRI'), b: C('SSRI'),
    severity: 'MAJOR', action: 'DISCUSS',
    effect: 'Two SSRIs together raise serotonin levels and the risk of serotonin syndrome, with no added benefit.',
    advice: 'If you are cross-tapering between two antidepressants this may be intended. If not, check with your prescriber.',
    source: NZF,
  },
  {
    id: 'IX-OPIOID-OPIOID',
    a: C('OPIOID'), b: C('OPIOID'),
    severity: 'MODERATE', action: 'DISCUSS',
    effect: 'Taking two opioids together increases drowsiness, constipation and the risk of slowed breathing.',
    advice: 'A regular plus a breakthrough opioid can be intentional. If nobody planned it, check before taking both.',
    source: NZF,
  },
];

function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')

    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b/g, ' ')
    .replace(/\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|sr|cr|xl|er|mr|forte)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class BundledInteractionTable implements InteractionRepository {
  readonly version = '2026.08-nzf';

  private readonly index: ReadonlyMap<string, Drug>;

  constructor() {
    const m = new Map<string, Drug>();
    for (const d of DRUGS) {
      m.set(normalise(d.name), d);
      m.set(d.id, d);
      for (const a of d.aliases) m.set(normalise(a), d);
    }
    this.index = m;
  }

  resolve(typed: string): Drug | null {
    const key = normalise(typed);
    if (!key) return null;

    const exact = this.index.get(key);
    if (exact) return exact;

    const words = key.split(' ').filter((w) => w.length > 3);
    const hits = new Set<Drug>();
    for (const w of words) {
      const d = this.index.get(w);
      if (d) hits.add(d);
    }
    return hits.size === 1 ? [...hits][0]! : null;
  }

  rules(): readonly InteractionRule[] {
    return RULES;
  }

  suggest(prefix: string, limit = 6): readonly Drug[] {
    const key = normalise(prefix);
    if (key.length < 2) return [];
    const out: Drug[] = [];
    for (const d of DRUGS) {
      const hit = normalise(d.name).startsWith(key)
        || d.aliases.some((a) => normalise(a).startsWith(key));
      if (hit && !out.includes(d)) out.push(d);
      if (out.length >= limit) break;
    }
    return out;
  }

  get drugCount(): number { return DRUGS.length; }
  get ruleCount(): number { return RULES.length; }
}
