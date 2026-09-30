import {
  SymptomEpisode, TriageResult, Symptom, AgeBand, TriageBand,
  ResultSource, SyncStatus,
} from '../../domain/entities';
import { HistoryEntry } from '../../domain/ports';
import { SymptomAnalysis } from '../../domain/remote';

export interface EpisodeRow {
  id: string;
  captured_at: string;
  age_band: string;
  duration_hours: number;
  symptoms_json: string;
  band: string;
  severity: number;
  confidence: number;
  source: string;
  red_flags_json: string;
  rationale_json: string;
  sync_status: string;
  analysis_json?: string | null;
}

const BANDS: readonly string[] = ['SELF_CARE', 'PHARMACY_GP', 'URGENT', 'EMERGENCY'];
const AGES: readonly string[] = ['CHILD', 'ADULT', 'OLDER_ADULT'];
const SOURCES: readonly string[] = ['ON_DEVICE_RULES', 'ON_DEVICE_MODEL', 'REMOTE'];
const STATUSES: readonly string[] = ['PENDING_SYNC', 'SYNCED'];

export class RowCorruptError extends Error {}

function oneOf<T extends string>(v: string, allowed: readonly string[], field: string): T {
  if (!allowed.includes(v)) {
    throw new RowCorruptError(`${field} has unexpected value "${v}"`);
  }
  return v as T;
}

function parseArray<T>(json: string, field: string): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new RowCorruptError(`${field} is not valid JSON`);
  }
  if (!Array.isArray(parsed)) throw new RowCorruptError(`${field} is not an array`);
  return parsed as T[];
}

export function toRow(episode: SymptomEpisode, result: TriageResult): EpisodeRow {
  return {
    id: episode.id,
    captured_at: episode.capturedAt,
    age_band: episode.ageBand,
    duration_hours: episode.durationHours,
    symptoms_json: JSON.stringify(episode.symptoms),
    band: result.band,
    severity: result.severity,
    confidence: result.confidence,
    source: result.source,
    red_flags_json: JSON.stringify(result.redFlags),
    rationale_json: JSON.stringify(result.rationale),
    sync_status: result.syncStatus,
    analysis_json: null,
  };
}

export function fromRow(row: EpisodeRow): HistoryEntry {
  const episode: SymptomEpisode = {
    id: row.id,
    capturedAt: row.captured_at,
    ageBand: oneOf<AgeBand>(row.age_band, AGES, 'age_band'),
    durationHours: row.duration_hours,
    symptoms: parseArray<Symptom>(row.symptoms_json, 'symptoms_json'),
  };
  const result: TriageResult = {
    episodeId: row.id,
    band: oneOf<TriageBand>(row.band, BANDS, 'band'),
    severity: row.severity,
    confidence: row.confidence,
    source: oneOf<ResultSource>(row.source, SOURCES, 'source'),
    redFlags: parseArray<string>(row.red_flags_json, 'red_flags_json'),
    rationale: parseArray<string>(row.rationale_json, 'rationale_json'),
    syncStatus: oneOf<SyncStatus>(row.sync_status, STATUSES, 'sync_status'),
  };
  let analysis: SymptomAnalysis | null = null;
  if (row.analysis_json) {
    try {
      analysis = JSON.parse(row.analysis_json) as SymptomAnalysis;
    } catch {
      analysis = null;
    }
  }

  return { episode, result, analysis };
}
