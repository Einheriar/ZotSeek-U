/** Bundled defaults, profile-side overrides, and safe file publication for literature briefs. */

declare const IOUtils: any;
declare const PathUtils: any;
declare const Services: any;
declare const Ci: any;
declare const Zotero: any;

export type BriefPromptSlot = 'standard' | 'review';
export const BRIEF_PROMPT_DIRECTORY = 'zotseek-brief-prompts';
export const BRIEF_PROMPT_PROFILE_DIRECTORY = 'profiles';
export const BRIEF_PROMPT_ACTIVE_FILENAME = 'active.json';
export const BRIEF_PROMPT_MAX_BYTES = 256 * 1024;
export const BRIEF_BUNDLED_PROMPT_BASE_URI = 'chrome://zotseek/content/prompts';

const SLOT_FILENAMES: Readonly<Record<BriefPromptSlot, string>> = Object.freeze({
  standard: 'standard.md', review: 'review.md',
});
const BUNDLED_SLOT_FILENAMES: Readonly<Record<BriefPromptSlot, string>> = Object.freeze({
  standard: 'standard-article-brief.md', review: 'review-article-brief.md',
});
const SLOTS: readonly BriefPromptSlot[] = ['standard', 'review'];

export interface StoredBriefPrompt {
  slot: BriefPromptSlot;
  source: 'bundled' | 'custom';
  content: string;
  hash: string;
  byteLength: number;
  path: string;
}
export interface BriefPromptPair { standard: string; review: string; }
export interface BriefPromptStoreEnvironment {
  profileDir: string;
  join(...parts: string[]): string;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, content: Uint8Array): Promise<void>;
  move(source: string, destination: string, options?: { noOverwrite?: boolean }): Promise<void>;
  remove(path: string): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  temporarySuffix(): string;
  readBundled(uri: string): Promise<Uint8Array>;
  /** Mozilla's default download directory, injected by the UI/runtime boundary. */
  getDownloadDirectory?: () => Promise<string> | string;
  now?: () => number;
}
export interface BriefPromptDownloadFile {
  slot: BriefPromptSlot;
  status: 'downloaded' | 'failed' | 'cancelled';
  path?: string;
  error?: string;
}
export interface BriefPromptDownloadResult {
  status: 'downloaded' | 'failed' | 'cancelled';
  files: Record<BriefPromptSlot, BriefPromptDownloadFile>;
  directory?: string;
  error?: string;
}
export interface BriefPromptPublishResult {
  status: 'enabled' | 'failed' | 'cancelled';
  version?: string;
  prompts?: Record<BriefPromptSlot, StoredBriefPrompt>;
  error?: string;
}
export interface BriefPromptSaveResult {
  status: 'enabled' | 'downloaded_not_enabled' | 'failed' | 'cancelled';
  downloads: BriefPromptDownloadResult;
  publication?: BriefPromptPublishResult;
}

export class BriefPromptStoreError extends Error {
  readonly code = 'BRIEF_PROMPT_STORE_ERROR' as const;
  constructor(message: string) { super(message); this.name = 'BriefPromptStoreError'; }
}
export class BriefPromptOperationCancelledError extends BriefPromptStoreError {
  constructor() { super('Literature-brief prompt operation was cancelled.'); this.name = 'BriefPromptOperationCancelledError'; }
}
function assertSlot(slot: string): asserts slot is BriefPromptSlot {
  if (slot !== 'standard' && slot !== 'review') throw new BriefPromptStoreError('Unknown literature-brief prompt slot.');
}
function filename(path: string): string { return path.split(/[\\/]/).pop() || ''; }
function validateSourceExtension(path: string): void {
  if (!/\.(?:md|txt)$/i.test(filename(path))) throw new BriefPromptStoreError('Literature-brief prompts must use a .md or .txt extension.');
}
function decodePrompt(bytes: Uint8Array): string {
  if (bytes.byteLength > BRIEF_PROMPT_MAX_BYTES) throw new BriefPromptStoreError('Literature-brief prompt exceeds the 256 KiB limit.');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); }
  catch { throw new BriefPromptStoreError('Literature-brief prompt is not valid UTF-8.'); }
  if (!content.trim()) throw new BriefPromptStoreError('Literature-brief prompt must not be empty.');
  return content;
}
function encodePrompt(content: string): Uint8Array {
  if (typeof content !== 'string') throw new BriefPromptStoreError('Literature-brief prompt must be text.');
  const normalized = content.replace(/^\uFEFF/, '');
  const bytes = new TextEncoder().encode(normalized);
  let decoded: string;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new BriefPromptStoreError('Literature-brief prompt is not valid UTF-8.'); }
  if (decoded !== normalized) throw new BriefPromptStoreError('Literature-brief prompt is not valid UTF-8.');
  decodePrompt(bytes);
  return bytes;
}
async function sha256(value: Uint8Array): Promise<string> {
  const runtimeCrypto = globalThis.crypto;
  if (!runtimeCrypto?.subtle) throw new BriefPromptStoreError('SHA-256 is unavailable in this runtime.');
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  const digest = await runtimeCrypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function runtimeDownloadDirectory(): string {
  // DfltDwnld is the Mozilla platform service used by Firefox/Zotero.
  if (typeof Services !== 'undefined' && typeof Ci !== 'undefined') {
    try { return Services.dirsvc.get('DfltDwnld', Ci.nsIFile).path; } catch { /* probe next */ }
  }
  try {
    const downloads = Zotero?.getMainWindow?.()?.Downloads;
    if (downloads?.getPreferredDownloadsDirectory) return downloads.getPreferredDownloadsDirectory();
  } catch { /* unavailable in this runtime */ }
  throw new BriefPromptStoreError('The default download directory is unavailable.');
}
function runtimeEnvironment(): BriefPromptStoreEnvironment {
  if (!Zotero?.Profile?.dir || typeof PathUtils === 'undefined' || typeof IOUtils === 'undefined') throw new BriefPromptStoreError('Zotero profile file access is unavailable.');
  return {
    profileDir: Zotero.Profile.dir,
    join: (...parts) => PathUtils.join(...parts),
    exists: path => IOUtils.exists(path), read: path => IOUtils.read(path),
    write: (path, content) => IOUtils.write(path, content),
    move: (source, destination, options) => IOUtils.move(source, destination, options || {}),
    remove: path => IOUtils.remove(path, { ignoreAbsent: true }),
    makeDirectory: path => IOUtils.makeDirectory(path, { createAncestors: true, ignoreExisting: true }),
    temporarySuffix: () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    readBundled: async uri => { const response = await fetch(uri); if (!response.ok) throw new Error(`HTTP ${response.status}`); return new Uint8Array(await response.arrayBuffer()); },
    getDownloadDirectory: runtimeDownloadDirectory, now: Date.now,
  };
}
function isCancelled(signal?: { readonly aborted?: boolean }): boolean { return signal?.aborted === true; }
function assertNotCancelled(signal?: { readonly aborted?: boolean }): void { if (isCancelled(signal)) throw new BriefPromptOperationCancelledError(); }

interface ActiveRecord {
  schema: 1; version: string;
  standard: { filename: 'standard.md'; hash: string; byteLength: number };
  review: { filename: 'review.md'; hash: string; byteLength: number };
  publishedAt: string;
}
function isSafeVersion(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value); }
function isHash(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
function parseActiveRecord(bytes: Uint8Array): ActiveRecord {
  let parsed: any;
  try { parsed = JSON.parse(decodePrompt(bytes)); } catch { throw new BriefPromptStoreError('The active literature-brief prompt record is invalid.'); }
  if (parsed?.schema !== 1 || !isSafeVersion(parsed.version) || !isHash(parsed.standard?.hash) || !isHash(parsed.review?.hash) ||
      !Number.isSafeInteger(parsed.standard?.byteLength) || parsed.standard.byteLength <= 0 ||
      !Number.isSafeInteger(parsed.review?.byteLength) || parsed.review.byteLength <= 0 ||
      parsed.standard.filename !== 'standard.md' || parsed.review.filename !== 'review.md' || typeof parsed.publishedAt !== 'string') {
    throw new BriefPromptStoreError('The active literature-brief prompt record is invalid.');
  }
  return parsed as ActiveRecord;
}

export class BriefPromptStore {
  constructor(private readonly environment?: BriefPromptStoreEnvironment) {}
  private env(): BriefPromptStoreEnvironment { return this.environment || runtimeEnvironment(); }
  getDirectoryPath(): string { const env = this.env(); return env.join(env.profileDir, BRIEF_PROMPT_DIRECTORY); }
  getVersionsPath(): string { return this.env().join(this.getDirectoryPath(), BRIEF_PROMPT_PROFILE_DIRECTORY); }
  getActiveRecordPath(): string { return this.env().join(this.getDirectoryPath(), BRIEF_PROMPT_ACTIVE_FILENAME); }
  getPromptPath(slot: BriefPromptSlot): string { assertSlot(slot); return this.env().join(this.getDirectoryPath(), SLOT_FILENAMES[slot]); }
  getBundledPromptURI(slot: BriefPromptSlot): string { assertSlot(slot); return `${BRIEF_BUNDLED_PROMPT_BASE_URI}/${BUNDLED_SLOT_FILENAMES[slot]}`; }
  getVersionPromptPath(version: string, slot: BriefPromptSlot): string {
    assertSlot(slot); if (!isSafeVersion(version)) throw new BriefPromptStoreError('Invalid prompt profile version.');
    return this.env().join(this.getVersionsPath(), version, SLOT_FILENAMES[slot]);
  }
  private async record(slot: BriefPromptSlot, source: StoredBriefPrompt['source'], path: string, bytes: Uint8Array): Promise<StoredBriefPrompt> {
    const content = decodePrompt(bytes); const normalizedBytes = encodePrompt(content);
    return { slot, source, content, hash: await sha256(normalizedBytes), byteLength: normalizedBytes.byteLength, path };
  }
  async loadBundled(slot: BriefPromptSlot): Promise<StoredBriefPrompt> {
    assertSlot(slot); const uri = this.getBundledPromptURI(slot);
    try { return await this.record(slot, 'bundled', uri, await this.env().readBundled(uri)); }
    catch (error: any) { if (error instanceof BriefPromptStoreError) throw error; throw new BriefPromptStoreError('Could not read the bundled literature-brief prompt.'); }
  }
  async loadBundledRequired(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    const [standard, review] = await Promise.all([this.loadBundled('standard'), this.loadBundled('review')]); return { standard, review };
  }
  private async loadActive(): Promise<Record<BriefPromptSlot, StoredBriefPrompt> | null> {
    const env = this.env(); const activePath = this.getActiveRecordPath(); if (!await env.exists(activePath)) return null;
    let active: ActiveRecord;
    try { active = parseActiveRecord(await env.read(activePath)); }
    catch (error: any) { if (error instanceof BriefPromptStoreError) throw error; throw new BriefPromptStoreError('Could not read the active literature-brief prompt record.'); }
    const result = {} as Record<BriefPromptSlot, StoredBriefPrompt>;
    for (const slot of SLOTS) {
      const path = this.getVersionPromptPath(active.version, slot); let stored: StoredBriefPrompt;
      try { stored = await this.record(slot, 'custom', path, await env.read(path)); }
      catch { throw new BriefPromptStoreError('The active literature-brief prompt profile is incomplete.'); }
      const metadata = active[slot];
      if (stored.hash !== metadata.hash || stored.byteLength !== metadata.byteLength) throw new BriefPromptStoreError('The active literature-brief prompt profile failed integrity validation.');
      result[slot] = stored;
    }
    return result;
  }
  async load(slot: BriefPromptSlot): Promise<StoredBriefPrompt | null> {
    assertSlot(slot); const active = await this.loadActive(); if (active) return active[slot];
    const env = this.env(); const path = this.getPromptPath(slot);
    if (await env.exists(path)) {
      try { return await this.record(slot, 'custom', path, await env.read(path)); }
      catch (error: any) { if (error instanceof BriefPromptStoreError) throw error; throw new BriefPromptStoreError('Could not read the custom literature-brief prompt.'); }
    }
    return await this.loadBundled(slot);
  }
  async loadRequired(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    const active = await this.loadActive(); if (active) return active;
    const [standard, review] = await Promise.all([this.load('standard'), this.load('review')]);
    if (!standard || !review) throw new BriefPromptStoreError('Literature-brief prompts are unavailable.'); return { standard, review };
  }
  private nextVersion(): string { const env = this.env(); return `${(env.now || Date.now)()}-${env.temporarySuffix().replace(/[^A-Za-z0-9_-]/g, '') || 'v'}`; }
  /** Publish both slots as one profile; the active record is the commit point. */
  async publishPair(pair: BriefPromptPair, options: { signal?: { readonly aborted?: boolean }; version?: string } = {}): Promise<BriefPromptPublishResult> {
    const env = this.env(); const bytes: Record<BriefPromptSlot, Uint8Array> = { standard: encodePrompt(pair.standard), review: encodePrompt(pair.review) };
    assertNotCancelled(options.signal); const version = options.version || this.nextVersion();
    if (!isSafeVersion(version)) throw new BriefPromptStoreError('Invalid prompt profile version.');
    const directory = this.getDirectoryPath(); const versionDirectory = env.join(this.getVersionsPath(), version); const temporaryActive = `${this.getActiveRecordPath()}.tmp-${env.temporarySuffix()}`;
    try {
      await env.makeDirectory(versionDirectory);
      for (const slot of SLOTS) { assertNotCancelled(options.signal); await env.write(this.getVersionPromptPath(version, slot), bytes[slot]); }
      assertNotCancelled(options.signal);
      const metadata: any = { schema: 1, version, publishedAt: new Date((env.now || Date.now)()).toISOString() };
      for (const slot of SLOTS) metadata[slot] = { filename: SLOT_FILENAMES[slot], hash: await sha256(bytes[slot]), byteLength: bytes[slot].byteLength };
      await env.makeDirectory(directory); await env.write(temporaryActive, new TextEncoder().encode(JSON.stringify(metadata)));
      assertNotCancelled(options.signal); await env.move(temporaryActive, this.getActiveRecordPath(), { noOverwrite: false });
      const prompts = {} as Record<BriefPromptSlot, StoredBriefPrompt>;
      for (const slot of SLOTS) prompts[slot] = await this.record(slot, 'custom', this.getVersionPromptPath(version, slot), bytes[slot]);
      return { status: 'enabled', version, prompts };
    } catch (error: any) {
      if (error instanceof BriefPromptOperationCancelledError || isCancelled(options.signal)) throw new BriefPromptOperationCancelledError();
      if (error instanceof BriefPromptStoreError) throw error; throw new BriefPromptStoreError('Could not publish the literature-brief prompt profile.');
    } finally { try { await env.remove(temporaryActive); } catch { /* best-effort temporary cleanup */ } }
  }
  async publishGeneratedPair(pair: BriefPromptPair, options?: { signal?: { readonly aborted?: boolean }; version?: string }): Promise<BriefPromptPublishResult> { return await this.publishPair(pair, options); }
  private async writeDownloadFile(directory: string, slot: BriefPromptSlot, bytes: Uint8Array): Promise<string> {
    const env = this.env(); const stamp = (env.now || Date.now)();
    for (let attempt = 0; attempt < 20; attempt++) {
      const suffix = attempt ? `-${attempt}` : ''; const destination = env.join(directory, `zotseek-brief-${slot}-${stamp}-${env.temporarySuffix()}${suffix}.md`);
      if (await env.exists(destination)) continue;
      const temporary = `${destination}.tmp-${env.temporarySuffix()}`;
      try { await env.write(temporary, bytes); await env.move(temporary, destination, { noOverwrite: true }); return destination; }
      catch (error) { try { await env.remove(temporary); } catch { /* best effort */ } if (await env.exists(destination)) continue; throw error; }
    }
    throw new BriefPromptStoreError('Could not choose a non-overwriting prompt download filename.');
  }
  /** Download both generated files without overwriting user files. */
  async downloadPair(pair: BriefPromptPair, options: { signal?: { readonly aborted?: boolean } } = {}): Promise<BriefPromptDownloadResult> {
    const bytes: Record<BriefPromptSlot, Uint8Array> = { standard: encodePrompt(pair.standard), review: encodePrompt(pair.review) }; const files = {} as Record<BriefPromptSlot, BriefPromptDownloadFile>;
    for (const slot of SLOTS) files[slot] = { slot, status: 'failed' };
    if (isCancelled(options.signal)) { for (const slot of SLOTS) files[slot] = { slot, status: 'cancelled' }; return { status: 'cancelled', files }; }
    const env = this.env(); let directory: string;
    try { if (!env.getDownloadDirectory) throw new BriefPromptStoreError('The default download directory is unavailable.'); directory = await env.getDownloadDirectory(); if (!directory) throw new BriefPromptStoreError('The default download directory is unavailable.'); }
    catch (error: any) { return { status: 'failed', files, error: error instanceof Error ? error.message : 'Download directory unavailable.' }; }
    for (const slot of SLOTS) {
      if (isCancelled(options.signal)) { files[slot] = { slot, status: 'cancelled' }; continue; }
      try { files[slot] = { slot, status: 'downloaded', path: await this.writeDownloadFile(directory, slot, bytes[slot]) }; }
      catch { files[slot] = { slot, status: 'failed', error: 'Could not save the prompt download.' }; }
    }
    const status = isCancelled(options.signal) ? 'cancelled' : SLOTS.every(slot => files[slot].status === 'downloaded') ? 'downloaded' : 'failed'; return { status, files, directory };
  }
  /** Download first, then publish both slots; only a complete pair is enabled. */
  async saveGeneratedPair(pair: BriefPromptPair, options: { signal?: { readonly aborted?: boolean } } = {}): Promise<BriefPromptSaveResult> {
    const downloads = await this.downloadPair(pair, options); if (downloads.status === 'cancelled') return { status: 'cancelled', downloads }; if (downloads.status !== 'downloaded') return { status: 'failed', downloads }; if (isCancelled(options.signal)) return { status: 'cancelled', downloads };
    try { const publication = await this.publishPair(pair, options); return { status: 'enabled', downloads, publication }; }
    catch (error: any) { const publication: BriefPromptPublishResult = { status: error instanceof BriefPromptOperationCancelledError ? 'cancelled' : 'failed', error: error instanceof Error ? error.message : 'Could not publish the prompt profile.' }; return { status: publication.status === 'cancelled' ? 'cancelled' : 'downloaded_not_enabled', downloads, publication }; }
  }
  /** Validate and atomically copy one external prompt into its managed slot. */
  async importFromFile(slot: BriefPromptSlot, sourcePath: string): Promise<StoredBriefPrompt> {
    assertSlot(slot); validateSourceExtension(sourcePath); const env = this.env(); let sourceBytes: Uint8Array;
    try { sourceBytes = await env.read(sourcePath); } catch { throw new BriefPromptStoreError('Could not read the selected literature-brief prompt.'); }
    const content = decodePrompt(sourceBytes); const bytes = encodePrompt(content);
    if (await env.exists(this.getActiveRecordPath())) {
      const current = await this.loadRequired(); const pair: BriefPromptPair = { standard: slot === 'standard' ? content : current.standard.content, review: slot === 'review' ? content : current.review.content };
      const published = await this.publishPair(pair); if (!published.prompts) throw new BriefPromptStoreError('Could not save the managed literature-brief prompt.'); return published.prompts[slot];
    }
    const directory = this.getDirectoryPath(); const destination = this.getPromptPath(slot); const temporary = `${destination}.tmp-${env.temporarySuffix()}`;
    try { await env.makeDirectory(directory); await env.write(temporary, bytes); await env.move(temporary, destination, { noOverwrite: false }); }
    catch { throw new BriefPromptStoreError('Could not save the managed literature-brief prompt.'); }
    finally { try { await env.remove(temporary); } catch { /* best-effort temporary cleanup */ } }
    return await this.record(slot, 'custom', destination, bytes);
  }

  /** Restore packaged defaults without deleting historical managed versions or downloads. */
  async resetToBundled(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    const env = this.env();
    try {
      // Verify that the packaged pair is readable before removing the active
      // pointer. A damaged build must not turn a recoverable custom profile
      // into an unusable prompt configuration.
      const bundled = await this.loadBundledRequired();
      // Remove legacy single-slot overrides first. The active pair remains the
      // effective profile until its record is removed as the final commit.
      await env.remove(this.getPromptPath('standard'));
      await env.remove(this.getPromptPath('review'));
      await env.remove(this.getActiveRecordPath());
      return bundled;
    } catch (error: any) {
      if (error instanceof BriefPromptStoreError) throw error;
      throw new BriefPromptStoreError('Could not restore the bundled literature-brief prompts.');
    }
  }
}
export const briefPromptStore = new BriefPromptStore();
