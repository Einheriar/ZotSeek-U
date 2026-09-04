/** Bundled defaults and profile-side overrides for literature-brief prompts. */

declare const IOUtils: any;
declare const PathUtils: any;
declare const Zotero: any;

export type BriefPromptSlot = 'standard' | 'review';

export const BRIEF_PROMPT_DIRECTORY = 'zotseek-brief-prompts';
export const BRIEF_PROMPT_MAX_BYTES = 256 * 1024;
export const BRIEF_BUNDLED_PROMPT_BASE_URI = 'chrome://zotseek/content/prompts';

const SLOT_FILENAMES: Readonly<Record<BriefPromptSlot, string>> = Object.freeze({
  standard: 'standard.md',
  review: 'review.md',
});

const BUNDLED_SLOT_FILENAMES: Readonly<Record<BriefPromptSlot, string>> = Object.freeze({
  standard: 'standard-article-brief.md',
  review: 'review-article-brief.md',
});

export interface StoredBriefPrompt {
  slot: BriefPromptSlot;
  source: 'bundled' | 'custom';
  content: string;
  hash: string;
  byteLength: number;
  path: string;
}

export interface BriefPromptStoreEnvironment {
  profileDir: string;
  join(...parts: string[]): string;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, content: Uint8Array): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  temporarySuffix(): string;
  readBundled(uri: string): Promise<Uint8Array>;
}

export class BriefPromptStoreError extends Error {
  readonly code = 'BRIEF_PROMPT_STORE_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'BriefPromptStoreError';
  }
}

function assertSlot(slot: string): asserts slot is BriefPromptSlot {
  if (slot !== 'standard' && slot !== 'review') {
    throw new BriefPromptStoreError('Unknown literature-brief prompt slot.');
  }
}

function filename(path: string): string {
  return path.split(/[\\/]/).pop() || '';
}

function validateSourceExtension(path: string): void {
  if (!/\.(?:md|txt)$/i.test(filename(path))) {
    throw new BriefPromptStoreError('Literature-brief prompts must use a .md or .txt extension.');
  }
}

function decodePrompt(bytes: Uint8Array): string {
  if (bytes.byteLength > BRIEF_PROMPT_MAX_BYTES) {
    throw new BriefPromptStoreError('Literature-brief prompt exceeds the 256 KiB limit.');
  }
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    throw new BriefPromptStoreError('Literature-brief prompt is not valid UTF-8.');
  }
  if (!content.trim()) {
    throw new BriefPromptStoreError('Literature-brief prompt must not be empty.');
  }
  return content;
}

async function sha256(value: Uint8Array): Promise<string> {
  const runtimeCrypto = globalThis.crypto;
  if (!runtimeCrypto?.subtle) {
    throw new BriefPromptStoreError('SHA-256 is unavailable in this runtime.');
  }
  // Copy into an explicit ArrayBuffer so Firefox/Node type definitions do not
  // widen a caller-provided Uint8Array backing store to SharedArrayBuffer.
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  const digest = await runtimeCrypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function runtimeEnvironment(): BriefPromptStoreEnvironment {
  if (!Zotero?.Profile?.dir || typeof PathUtils === 'undefined' || typeof IOUtils === 'undefined') {
    throw new BriefPromptStoreError('Zotero profile file access is unavailable.');
  }
  return {
    profileDir: Zotero.Profile.dir,
    join: (...parts) => PathUtils.join(...parts),
    exists: path => IOUtils.exists(path),
    read: path => IOUtils.read(path),
    write: (path, content) => IOUtils.write(path, content),
    move: (source, destination) => IOUtils.move(source, destination, { noOverwrite: false }),
    remove: path => IOUtils.remove(path, { ignoreAbsent: true }),
    makeDirectory: path => IOUtils.makeDirectory(
      path,
      { createAncestors: true, ignoreExisting: true },
    ),
    temporarySuffix: () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    readBundled: async uri => {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

export class BriefPromptStore {
  constructor(private readonly environment?: BriefPromptStoreEnvironment) {}

  private env(): BriefPromptStoreEnvironment {
    return this.environment || runtimeEnvironment();
  }

  getDirectoryPath(): string {
    const env = this.env();
    return env.join(env.profileDir, BRIEF_PROMPT_DIRECTORY);
  }

  getPromptPath(slot: BriefPromptSlot): string {
    assertSlot(slot);
    const env = this.env();
    return env.join(this.getDirectoryPath(), SLOT_FILENAMES[slot]);
  }

  getBundledPromptURI(slot: BriefPromptSlot): string {
    assertSlot(slot);
    return `${BRIEF_BUNDLED_PROMPT_BASE_URI}/${BUNDLED_SLOT_FILENAMES[slot]}`;
  }

  private async record(
    slot: BriefPromptSlot,
    source: StoredBriefPrompt['source'],
    path: string,
    bytes: Uint8Array,
  ): Promise<StoredBriefPrompt> {
    const content = decodePrompt(bytes);
    const normalizedBytes = new TextEncoder().encode(content);
    return {
      slot,
      source,
      content,
      hash: await sha256(normalizedBytes),
      byteLength: normalizedBytes.byteLength,
      path,
    };
  }

  async load(slot: BriefPromptSlot): Promise<StoredBriefPrompt | null> {
    assertSlot(slot);
    const env = this.env();
    const path = this.getPromptPath(slot);
    if (await env.exists(path)) {
      try {
        return await this.record(slot, 'custom', path, await env.read(path));
      } catch (error: any) {
        if (error instanceof BriefPromptStoreError) throw error;
        throw new BriefPromptStoreError('Could not read the custom literature-brief prompt.');
      }
    }

    const bundledURI = this.getBundledPromptURI(slot);
    try {
      return await this.record(slot, 'bundled', bundledURI, await env.readBundled(bundledURI));
    } catch (error: any) {
      if (error instanceof BriefPromptStoreError) throw error;
      throw new BriefPromptStoreError('Could not read the bundled literature-brief prompt.');
    }
  }

  async loadRequired(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    const [standard, review] = await Promise.all([
      this.load('standard'),
      this.load('review'),
    ]);
    // The packaged defaults make both slots available before the user imports
    // an override. A missing bundled resource is therefore a broken build.
    if (!standard || !review) throw new BriefPromptStoreError('Literature-brief prompts are unavailable.');
    return { standard, review };
  }

  /** Validate and atomically copy one external prompt into its managed slot. */
  async importFromFile(slot: BriefPromptSlot, sourcePath: string): Promise<StoredBriefPrompt> {
    assertSlot(slot);
    validateSourceExtension(sourcePath);
    const env = this.env();
    let sourceBytes: Uint8Array;
    try {
      sourceBytes = await env.read(sourcePath);
    } catch {
      throw new BriefPromptStoreError('Could not read the selected literature-brief prompt.');
    }
    const content = decodePrompt(sourceBytes);
    const bytes = new TextEncoder().encode(content);
    const directory = this.getDirectoryPath();
    const destination = this.getPromptPath(slot);
    const temporary = `${destination}.tmp-${env.temporarySuffix()}`;
    try {
      await env.makeDirectory(directory);
      await env.write(temporary, bytes);
      await env.move(temporary, destination);
    } catch {
      throw new BriefPromptStoreError('Could not save the managed literature-brief prompt.');
    } finally {
      try { await env.remove(temporary); } catch { /* best-effort temporary cleanup */ }
    }
    return await this.record(slot, 'custom', destination, bytes);
  }
}

export const briefPromptStore = new BriefPromptStore();
