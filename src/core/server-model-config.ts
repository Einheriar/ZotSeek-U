/**
 * Advanced single-slot server-model configuration loaded from the Zotero
 * profile. The JSON file is user-owned; `zotseek.serverModels` is only a
 * validated synchronous cache for the model registry.
 */

import {
  getActiveModelSelectionId,
  SERVER_SLOT_SELECTION_ID,
  type ServerModelEntry,
} from './model-registry';
import { assertLoopbackUrl } from './loopback-url';

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

export const SERVER_MODEL_CONFIG_SCHEMA_VERSION = 2;
export const SERVER_MODEL_CONFIG_FILENAME = 'zotseek-server-models.json';

const SERVER_MODELS_PREF = 'zotseek.serverModels';

export type ServerSlotKind = 'none' | 'unknown' | 'ready';

export interface ParsedServerModelConfig {
  kind: ServerSlotKind;
  model: ServerModelEntry | null;
  errors: string[];
  legacySchema: boolean;
}

export interface ServerModelConfigLoadResult extends ParsedServerModelConfig {
  path: string;
  created: boolean;
}

let lastLoadResult: ServerModelConfigLoadResult | null = null;

const EXAMPLE_MODEL = Object.freeze({
  id: 'server:bge-m3-local',
  baseUrl: 'http://127.0.0.1:1234',
  serverModelName: 'bge-m3',
  dimensions: 1024,
  maxInputTokens: 8192,
  recommendedChunkTokens: 2000,
  queryPrefix: '',
  docPrefix: '',
  apiKey: '',
});

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateModel(candidate: any, at = 'model'): { model: ServerModelEntry | null; errors: string[] } {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { model: null, errors: [`${at} must be an object or null.`] };
  }

  const errors: string[] = [];
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const serverModelName = typeof candidate.serverModelName === 'string'
    ? candidate.serverModelName.trim()
    : '';

  if (!id || !id.startsWith('server:')) {
    errors.push('id must be a non-empty string beginning with "server:"');
  }
  if (!serverModelName) errors.push('serverModelName must be a non-empty string');
  if (!isPositiveInteger(candidate.dimensions)) errors.push('dimensions must be a positive integer');
  if (!isPositiveInteger(candidate.maxInputTokens)) errors.push('maxInputTokens must be a positive integer');
  if (!isPositiveInteger(candidate.recommendedChunkTokens)) {
    errors.push('recommendedChunkTokens must be a positive integer');
  } else if (isPositiveInteger(candidate.maxInputTokens)
      && candidate.recommendedChunkTokens > candidate.maxInputTokens) {
    errors.push('recommendedChunkTokens cannot exceed maxInputTokens');
  }
  if (typeof candidate.queryPrefix !== 'string') {
    errors.push('queryPrefix must be present and must be a string (it may be empty)');
  }
  if (typeof candidate.docPrefix !== 'string') {
    errors.push('docPrefix must be present and must be a string (it may be empty)');
  }
  if (candidate.apiKey !== undefined && typeof candidate.apiKey !== 'string') {
    errors.push('apiKey must be a string when provided');
  }

  let baseUrl = '';
  if (typeof candidate.baseUrl !== 'string' || !candidate.baseUrl.trim()) {
    errors.push('baseUrl must be a non-empty loopback URL');
  } else {
    try {
      baseUrl = assertLoopbackUrl(candidate.baseUrl.trim()).origin;
    } catch (error: any) {
      errors.push(error?.message || String(error));
    }
  }

  if (errors.length > 0) {
    return { model: null, errors: [`${at}: ${errors.join('; ')}.`] };
  }

  return {
    model: {
      id,
      label: `Local Server (${serverModelName})`,
      baseUrl,
      serverModelName,
      dimensions: candidate.dimensions,
      maxInputTokens: candidate.maxInputTokens,
      recommendedChunkTokens: candidate.recommendedChunkTokens,
      queryPrefix: candidate.queryPrefix,
      docPrefix: candidate.docPrefix,
      ...(candidate.apiKey ? { apiKey: candidate.apiKey } : {}),
    },
    errors: [],
  };
}

/** Parse user JSON without Zotero I/O. Schema v1 is accepted for migration. */
export function parseServerModelConfig(
  raw: string,
  preferredLegacyId?: string,
): ParsedServerModelConfig {
  let root: any;
  try {
    root = JSON.parse(raw);
  } catch (error: any) {
    return {
      kind: 'unknown',
      model: null,
      errors: [`Invalid JSON: ${error?.message || error}`],
      legacySchema: false,
    };
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      kind: 'unknown',
      model: null,
      errors: ['The configuration root must be a JSON object.'],
      legacySchema: false,
    };
  }

  let candidate: any = null;
  let legacySchema = false;
  if (root.schemaVersion === SERVER_MODEL_CONFIG_SCHEMA_VERSION) {
    if (!Object.prototype.hasOwnProperty.call(root, 'model')) {
      return {
        kind: 'unknown',
        model: null,
        errors: ['The configuration field "model" must be present. Use null when no server model is configured.'],
        legacySchema: false,
      };
    }
    if (root.model === null) {
      const legacyCandidates = Array.isArray(root.legacyCandidates) ? root.legacyCandidates : [];
      if (legacyCandidates.length > 0) {
        return {
          kind: 'unknown',
          model: null,
          errors: ['Multiple legacy server models were found. Copy exactly one candidate into "model" and remove the others.'],
          legacySchema: false,
        };
      }
      return { kind: 'none', model: null, errors: [], legacySchema: false };
    }
    candidate = root.model;
  } else if (root.schemaVersion === 1 && Array.isArray(root.models)) {
    legacySchema = true;
    const candidates = root.models.filter((value: any) => value && typeof value === 'object');
    candidate = preferredLegacyId
      ? candidates.find((value: any) => value.id === preferredLegacyId)
      : undefined;
    if (!candidate && candidates.length === 1) candidate = candidates[0];
    if (!candidate && candidates.length === 0) {
      return { kind: 'none', model: null, errors: [], legacySchema: true };
    }
    if (!candidate) {
      return {
        kind: 'unknown',
        model: null,
        errors: ['The legacy template contains multiple server models. Keep exactly one model in the schema v2 "model" field.'],
        legacySchema: true,
      };
    }
  } else {
    return {
      kind: 'unknown',
      model: null,
      errors: [
        `Unsupported schemaVersion '${String(root.schemaVersion)}'; ` +
        `expected ${SERVER_MODEL_CONFIG_SCHEMA_VERSION}.`,
      ],
      legacySchema: false,
    };
  }

  const validated = validateModel(candidate, legacySchema ? 'legacy model' : 'model');
  return validated.model
    ? { kind: 'ready', model: validated.model, errors: [], legacySchema }
    : { kind: 'unknown', model: null, errors: validated.errors, legacySchema };
}

export function getServerModelConfigPath(): string {
  if (typeof PathUtils !== 'undefined' && Zotero?.Profile?.dir) {
    return PathUtils.join(Zotero.Profile.dir, SERVER_MODEL_CONFIG_FILENAME);
  }
  return `<Zotero profile>/${SERVER_MODEL_CONFIG_FILENAME}`;
}

function readLegacyEntries(): any[] {
  try {
    const raw = Zotero.Prefs.get(SERVER_MODELS_PREF, true);
    if (typeof raw !== 'string' || !raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(entry => entry && typeof entry === 'object')
      : [];
  } catch {
    return [];
  }
}

function prepareLegacyEntry(entry: any): any {
  return {
    ...entry,
    maxInputTokens: isPositiveInteger(entry.maxInputTokens) ? entry.maxInputTokens : null,
    recommendedChunkTokens: isPositiveInteger(entry.recommendedChunkTokens)
      ? entry.recommendedChunkTokens
      : 450,
  };
}

function makeInitialTemplate(): string {
  const legacyEntries = readLegacyEntries();
  const selected = Zotero.Prefs.get('zotseek.embeddingModel', true);
  const selectedLegacy = typeof selected === 'string' && selected.startsWith('server:')
    ? legacyEntries.find(entry => entry.id === selected)
    : undefined;
  const chosen = selectedLegacy || (legacyEntries.length === 1 ? legacyEntries[0] : null);
  const legacyCandidates = !chosen && legacyEntries.length > 1
    ? legacyEntries.map(prepareLegacyEntry)
    : undefined;

  return JSON.stringify({
    schemaVersion: SERVER_MODEL_CONFIG_SCHEMA_VERSION,
    model: chosen ? prepareLegacyEntry(chosen) : null,
    ...(legacyCandidates ? { legacyCandidates } : {}),
    example: EXAMPLE_MODEL,
  }, null, 2) + '\n';
}

/** Load the profile template and refresh the synchronous registry cache. */
export async function loadServerModelConfig(): Promise<ServerModelConfigLoadResult> {
  const path = getServerModelConfigPath();
  let created = false;
  try {
    let raw: string;
    if (!await IOUtils.exists(path)) {
      raw = makeInitialTemplate();
      await IOUtils.writeUTF8(path, raw);
      created = true;
    } else {
      raw = await IOUtils.readUTF8(path);
    }

    const selected = Zotero.Prefs.get('zotseek.embeddingModel', true);
    const preferredLegacyId = typeof selected === 'string' && selected.startsWith('server:')
      ? selected
      : undefined;
    const parsed = parseServerModelConfig(raw, preferredLegacyId);
    const cache = parsed.kind === 'ready' && parsed.model ? [parsed.model] : [];
    Zotero.Prefs.set(SERVER_MODELS_PREF, JSON.stringify(cache), true);
    if (preferredLegacyId && preferredLegacyId !== SERVER_SLOT_SELECTION_ID) {
      Zotero.Prefs.set('zotseek.embeddingModel', SERVER_SLOT_SELECTION_ID, true);
    }
    lastLoadResult = { ...parsed, path, created };
  } catch (error: any) {
    const message = `Could not read or create the configuration file: ${error?.message || error}`;
    try { Zotero.Prefs.set(SERVER_MODELS_PREF, '[]', true); } catch { /* ignore */ }
    lastLoadResult = {
      kind: 'unknown',
      model: null,
      errors: [message],
      legacySchema: false,
      path,
      created,
    };
  }
  return lastLoadResult;
}

export function getLastServerModelConfigLoadResult(): ServerModelConfigLoadResult | null {
  return lastLoadResult
    ? {
        ...lastLoadResult,
        model: lastLoadResult.model ? { ...lastLoadResult.model } : null,
        errors: [...lastLoadResult.errors],
      }
    : null;
}

export function formatServerModelConfigErrors(errors: readonly string[], limit = 3): string {
  if (errors.length === 0) return '';
  const shown = errors.slice(0, limit).map(error => `- ${error}`).join('\n');
  const remaining = errors.length - Math.min(errors.length, limit);
  return remaining > 0 ? `${shown}\n- ...and ${remaining} more error(s).` : shown;
}

export interface ServerModelConfigurationIssue {
  state: 'NONE' | 'UNKNOWN';
  path: string;
  errors: string[];
}

/** Return an issue only when the user has actually selected the Server slot. */
export function getSelectedServerModelConfigurationIssue(): ServerModelConfigurationIssue | null {
  if (getActiveModelSelectionId() !== SERVER_SLOT_SELECTION_ID) return null;
  const result = getLastServerModelConfigLoadResult();
  if (result?.kind === 'ready' && result.model) return null;
  return {
    state: result?.kind === 'unknown' ? 'UNKNOWN' : 'NONE',
    path: result?.path || getServerModelConfigPath(),
    errors: result?.errors.length
      ? [...result.errors]
      : ['Set the template\'s "model" field to one complete server model object.'],
  };
}

/** Plain error text for MCP/REST and non-UI callers. */
export function serverModelConfigurationErrorMessage(issue: ServerModelConfigurationIssue): string {
  return (
    `Local Server (${issue.state}) is selected, but its model information is incomplete. ` +
    `Edit ${issue.path} and restart Zotero.\n${formatServerModelConfigErrors(issue.errors)}`
  );
}
