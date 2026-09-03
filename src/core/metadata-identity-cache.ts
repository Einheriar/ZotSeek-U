/** Bounded, process-local metadata snapshot for Hybrid identity navigation. */

import { Logger } from '../utils/logger';
import type { MetadataIdentityCandidate } from './search-policy';

declare const Zotero: any;

export const METADATA_IDENTITY_CACHE_MAX_BYTES = 32 * 1024 * 1024;

export interface MetadataIdentityScope {
  libraryId?: number;
  collectionId?: number;
  excludeBooks: boolean;
}

export interface MetadataIdentitySnapshotCandidate extends MetadataIdentityCandidate {
  itemId: number;
  libraryKey: string;
  itemKey: string;
}

export interface MetadataIdentitySnapshot {
  scopeKey: string;
  generation: number;
  candidates: MetadataIdentitySnapshotCandidate[];
  estimatedBytes: number;
}

export interface MetadataIdentityCacheResult {
  state: 'hit' | 'built' | 'unavailable';
  snapshot?: MetadataIdentitySnapshot;
  reason?: string;
}

type SnapshotBuilder = (
  maxBytes: number,
) => Promise<MetadataIdentitySnapshotCandidate[]>;

interface InFlightBuild {
  scopeKey: string;
  generation: number;
  promise: Promise<MetadataIdentityCacheResult>;
}

interface UnavailableScope {
  scopeKey: string;
  generation: number;
  reason: string;
}

function stringBytes(value: string | undefined): number {
  return String(value ?? '').length * 2;
}

/** Conservative, deterministic logical payload estimate (not JS heap telemetry). */
export function estimateMetadataIdentityCandidateBytes(
  candidate: MetadataIdentitySnapshotCandidate,
): number {
  let bytes = 160
    + stringBytes(candidate.id)
    + stringBytes(candidate.libraryKey)
    + stringBytes(candidate.itemKey)
    + stringBytes(candidate.title)
    + stringBytes(candidate.doi)
    + stringBytes(candidate.year);
  for (const creator of candidate.creators) {
    bytes += 64
      + stringBytes(creator.firstName)
      + stringBytes(creator.lastName)
      + stringBytes(creator.name);
  }
  return bytes;
}

export function metadataIdentityScopeKey(scope: MetadataIdentityScope): string {
  return [
    `library:${scope.libraryId ?? '*'}`,
    `collection:${scope.collectionId ?? '*'}`,
    `excludeBooks:${scope.excludeBooks ? '1' : '0'}`,
  ].join('|');
}

export class MetadataIdentityCache {
  private logger = new Logger('MetadataIdentityCache');
  private generation = 0;
  private activeScopeKey: string | null = null;
  private snapshot: MetadataIdentitySnapshot | null = null;
  private unavailable: UnavailableScope | null = null;
  private inFlight: InFlightBuild | null = null;
  private observerID: string | null = null;
  private destroyed = false;

  constructor(private readonly maxBytes = METADATA_IDENTITY_CACHE_MAX_BYTES) {}

  start(): void {
    if (this.observerID) return;
    if (!Zotero?.Notifier?.registerObserver) {
      this.logger.warn('Zotero.Notifier unavailable; metadata identity cache disabled');
      this.destroy();
      return;
    }
    try {
      this.observerID = Zotero.Notifier.registerObserver(
        {
          notify: (event: string, type: string) => {
            this.invalidate(`${type}:${event}`);
          },
        },
        ['item', 'collection-item', 'collection'],
        'zotseek-metadata-identity-cache',
      );
      this.destroyed = false;
      this.invalidate('start');
      this.logger.info('Registered metadata identity cache observer');
    } catch (error: any) {
      this.logger.warn(`Could not register metadata cache observer: ${error?.message || error}`);
      this.destroy();
    }
  }

  stop(): void {
    this.destroy();
  }

  destroy(): void {
    if (this.observerID && Zotero?.Notifier?.unregisterObserver) {
      try {
        Zotero.Notifier.unregisterObserver(this.observerID);
      } catch (error: any) {
        this.logger.warn(`Could not unregister metadata cache observer: ${error?.message || error}`);
      }
    }
    this.observerID = null;
    this.destroyed = true;
    this.generation++;
    this.activeScopeKey = null;
    this.snapshot = null;
    this.unavailable = null;
    this.inFlight = null;
  }

  invalidate(reason = 'manual'): void {
    this.generation++;
    this.snapshot = null;
    this.unavailable = null;
    this.inFlight = null;
    this.logger.debug(`Invalidated metadata identity cache (${reason})`);
  }

  async getOrBuild(
    scope: MetadataIdentityScope,
    builder: SnapshotBuilder,
  ): Promise<MetadataIdentityCacheResult> {
    if (this.destroyed) return { state: 'unavailable', reason: 'destroyed' };

    const scopeKey = metadataIdentityScopeKey(scope);
    if (this.activeScopeKey !== scopeKey) {
      // A scope switch drops both the previous publication and failure state.
      this.generation++;
      this.activeScopeKey = scopeKey;
      this.snapshot = null;
      this.unavailable = null;
      this.inFlight = null;
    }

    if (this.snapshot?.scopeKey === scopeKey && this.snapshot.generation === this.generation) {
      return { state: 'hit', snapshot: this.snapshot };
    }
    if (this.unavailable?.scopeKey === scopeKey &&
        this.unavailable.generation === this.generation) {
      return { state: 'unavailable', reason: this.unavailable.reason };
    }
    if (this.inFlight?.scopeKey === scopeKey && this.inFlight.generation === this.generation) {
      return this.inFlight.promise;
    }

    const buildGeneration = this.generation;
    const promise = this.buildSnapshot(scopeKey, buildGeneration, builder);
    this.inFlight = { scopeKey, generation: buildGeneration, promise };
    try {
      return await promise;
    } finally {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    }
  }

  private async buildSnapshot(
    scopeKey: string,
    buildGeneration: number,
    builder: SnapshotBuilder,
  ): Promise<MetadataIdentityCacheResult> {
    try {
      const candidates = await builder(this.maxBytes);
      let estimatedBytes = 0;
      for (const candidate of candidates) {
        estimatedBytes += estimateMetadataIdentityCandidateBytes(candidate);
        if (estimatedBytes > this.maxBytes) {
          throw new Error(`metadata identity cache exceeds ${this.maxBytes} bytes`);
        }
      }

      if (this.destroyed || this.generation !== buildGeneration ||
          this.activeScopeKey !== scopeKey) {
        return { state: 'unavailable', reason: 'stale-build' };
      }

      const snapshot: MetadataIdentitySnapshot = {
        scopeKey,
        generation: buildGeneration,
        candidates,
        estimatedBytes,
      };
      this.snapshot = snapshot;
      this.unavailable = null;
      this.logger.info(
        `Published metadata identity cache: scope=${scopeKey} ` +
        `candidates=${candidates.length} bytes=${estimatedBytes}`
      );
      return { state: 'built', snapshot };
    } catch (error: any) {
      const reason = error?.message || String(error);
      if (!this.destroyed && this.generation === buildGeneration &&
          this.activeScopeKey === scopeKey) {
        this.unavailable = { scopeKey, generation: buildGeneration, reason };
      }
      this.logger.warn(`Metadata identity cache unavailable: ${reason}`);
      return { state: 'unavailable', reason };
    }
  }
}

export const metadataIdentityCache = new MetadataIdentityCache();
