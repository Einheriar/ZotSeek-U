/** Secure storage for Cloud BYOK credentials. Never falls back to prefs or plaintext files. */

import { invalidateBriefConnectionVerification } from './brief-generation-config';
import type { CloudProviderId } from './cloud-model-config';

declare const Components: any;
declare const ChromeUtils: any;
declare const Services: any;
declare const Zotero: any;

const LOGIN_ORIGIN = 'chrome://zotseek';
const LOGIN_REALM = 'ZotSeek Cloud Embedding API Key (encrypted)';
const COMPAT_CIPHERTEXT_PREFIX = 'zotseek-oskeystore-v1:';
const PUBLIC_CIPHERTEXT_PREFIX = 'oskv1:';
const LEGACY_STORE_LABEL = 'Firefox Encrypted Storage';
const CURRENT_STORE_LABEL = 'Zotero Encrypted Storage';
const CREDENTIAL_REVISION_PREF = 'zotseek.cloud.credentialRevision';

function credentialRevisionPref(provider: string): string {
  return `${CREDENTIAL_REVISION_PREF}.${provider}`;
}

/** Non-secret monotonic revision used to invalidate stale async verification. */
export function getCloudCredentialRevision(provider: string): number {
  try {
    const value = Number(Zotero?.Prefs?.get?.(credentialRevisionPref(provider), true));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function bumpCloudCredentialRevision(provider: string): void {
  try {
    Zotero?.Prefs?.set?.(
      credentialRevisionPref(provider),
      getCloudCredentialRevision(provider) + 1,
      true,
    );
  } catch {
    // Test environments and early startup may not expose preferences yet.
  }
  try { invalidateBriefConnectionVerification(provider as CloudProviderId); }
  catch { /* preferences unavailable */ }
}

/**
 * One encrypted login per provider. The login username is the stable provider
 * id, so providers keep separate keys and switching providers never overwrites
 * another provider's credential. The historical Bailian entry already used the
 * provider id as its username, so existing keys need no migration.
 */
export function cloudCredentialUsername(provider: string): string {
  return provider;
}

export interface CloudCredentialLogin {
  username: string;
  password: string;
  [key: string]: unknown;
}

export interface CloudCredentialEnvironment {
  search(): Promise<CloudCredentialLogin[]>;
  add(login: CloudCredentialLogin): Promise<void>;
  modify(oldLogin: CloudCredentialLogin, newLogin: CloudCredentialLogin): Promise<void>;
  remove(login: CloudCredentialLogin): Promise<void>;
  makeLogin(username: string, encryptedValue: string): CloudCredentialLogin;
  encrypt(value: string): Promise<string>;
  decrypt(value: string): Promise<string>;
  isEncrypted(value: string): boolean;
}

export class CloudCredentialStorageError extends Error {
  readonly code = 'CLOUD_CREDENTIAL_STORAGE_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CloudCredentialStorageError';
  }
}

interface CloudOSKeyStore {
  encrypt(value: string): Promise<string>;
  decrypt(value: string): Promise<string>;
  isEncrypted(value: string): boolean;
}

interface CloudNativeKeyStore {
  asyncSecretAvailable(label: string): Promise<boolean>;
  asyncDecryptBytes(label: string, ciphertext: string): Promise<ArrayLike<number>>;
}

/**
 * Writing follows the available runtime, but reading follows the stored format.
 * Upgrading to Zotero 10 must not strand ciphertext written by Zotero 9.
 */
export function resolveCloudOSKeyStore(
  zoteroRuntime: any,
  chromeUtilsRuntime: any,
  nativeKeyStore?: () => CloudNativeKeyStore,
): CloudOSKeyStore {
  const candidate = zoteroRuntime?.OSKeyStore;
  const exposed = candidate && typeof candidate.encrypt === 'function' &&
    typeof candidate.decrypt === 'function' && typeof candidate.isEncrypted === 'function'
    ? candidate : null;
  let bundled: any;
  const getBundled = () => {
    if (!bundled) {
      try {
        bundled = chromeUtilsRuntime?.importESModule?.(
          'resource://gre/modules/OSKeyStore.sys.mjs',
        )?.OSKeyStore;
      } catch {
        // Never copy platform errors that could contain secret material.
      }
    }
    if (!bundled || typeof bundled.encrypt !== 'function' || typeof bundled.decrypt !== 'function') {
      throw new CloudCredentialStorageError('Zotero secure credential storage is unavailable.');
    }
    return bundled;
  };
  if (!exposed) getBundled();

  const ciphertextPrefix = (value: string): string | null => {
    if (typeof value !== 'string') return null;
    return [COMPAT_CIPHERTEXT_PREFIX, PUBLIC_CIPHERTEXT_PREFIX]
      .find(prefix => value.startsWith(prefix) && value.length > prefix.length) || null;
  };
  return {
    encrypt: async value => {
      if (exposed) return await exposed.encrypt(value);
      const cipherText = await getBundled().encrypt(value);
      if (!cipherText) return '';
      return `${COMPAT_CIPHERTEXT_PREFIX}${cipherText}`;
    },
    decrypt: async value => {
      const prefix = ciphertextPrefix(value);
      if (!prefix) {
        throw new CloudCredentialStorageError(
          'The stored Cloud API key is not protected by Zotero OSKeyStore.',
        );
      }
      // The public wrapper returns unknown formats unchanged. Never let that
      // behavior turn legacy ciphertext (or plaintext) into a usable API key.
      if (prefix === PUBLIC_CIPHERTEXT_PREFIX && exposed) {
        return await exposed.decrypt(value);
      }
      const raw = getBundled();
      if (prefix === COMPAT_CIPHERTEXT_PREFIX && raw.STORE_LABEL === CURRENT_STORE_LABEL && nativeKeyStore) {
        // Zotero 9 used MOZ_APP_BASENAME=Firefox; Zotero 10 changed it to
        // Zotero, which also changed Mozilla's OSKeyStore lookup label. Read
        // only an existing historical secret for our known legacy format.
        // Never mutate the shared module's STORE_LABEL or generate a secret.
        const native = nativeKeyStore();
        // Raw decrypt() can generate a missing current secret via
        // ensureLoggedIn(). Native reads avoid that side effect entirely.
        for (const label of [CURRENT_STORE_LABEL, LEGACY_STORE_LABEL]) {
          if (!await native.asyncSecretAvailable(label)) continue;
          try {
            const bytes = await native.asyncDecryptBytes(label, value.slice(prefix.length));
            return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
          } catch (error: any) {
            // Honor an explicit unlock cancellation (NS_ERROR_ABORT), rather
            // than trying another label after the user declined access.
            if (label === LEGACY_STORE_LABEL || error?.name === 'AbortError' ||
                (typeof error?.result === 'number' && (error.result >>> 0) === 0x80004004)) throw error;
          }
        }
        throw new CloudCredentialStorageError('Could not read the Cloud API key from secure storage.');
      }
      const binary: string = await raw.decrypt(value.slice(prefix.length));
      // Mozilla returns UTF-8 bytes as a binary string; only its raw result
      // needs decoding. The public Zotero wrapper already decodes its result.
      return new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(binary, char => char.charCodeAt(0)),
      );
    },
    isEncrypted: value => ciphertextPrefix(value) !== null,
  };
}

/** Internal runtime adapter; an isolated login scope also permits real self-tests. */
export function createCloudCredentialEnvironment(
  zoteroRuntime: any,
  chromeUtilsRuntime: any,
  servicesRuntime: any,
  componentsRuntime: any,
  scope = { origin: LOGIN_ORIGIN, realm: LOGIN_REALM },
): CloudCredentialEnvironment {
  const logins = servicesRuntime?.logins;
  if (!logins) {
    throw new CloudCredentialStorageError('Zotero secure credential storage is unavailable.');
  }
  const keyStore = resolveCloudOSKeyStore(zoteroRuntime, chromeUtilsRuntime, () =>
    componentsRuntime.classes['@mozilla.org/security/oskeystore;1']
      .getService(componentsRuntime.interfaces.nsIOSKeyStore));
  return {
    search: () => logins.searchLoginsAsync({ origin: scope.origin, httpRealm: scope.realm }),
    add: login => logins.addLoginAsync(login),
    // ESR Login Manager has synchronous modify/remove methods. Preserve the
    // async store contract without assuming every method has an Async variant.
    modify: async (oldLogin, newLogin) => {
      if (typeof logins.modifyLoginAsync === 'function') await logins.modifyLoginAsync(oldLogin, newLogin);
      else logins.modifyLogin(oldLogin, newLogin);
    },
    remove: async login => {
      if (typeof logins.removeLoginAsync === 'function') await logins.removeLoginAsync(login);
      else logins.removeLogin(login);
    },
    makeLogin: (username, encryptedValue) => {
      const LoginInfo = new componentsRuntime.Constructor(
        '@mozilla.org/login-manager/loginInfo;1',
        componentsRuntime.interfaces.nsILoginInfo,
        'init',
      );
      return new LoginInfo(
        scope.origin,
        null,
        scope.realm,
        username,
        encryptedValue,
        '',
        '',
      );
    },
    encrypt: value => keyStore.encrypt(value),
    decrypt: value => keyStore.decrypt(value),
    isEncrypted: value => keyStore.isEncrypted(value),
  };
}

function runtimeEnvironment(): CloudCredentialEnvironment {
  return createCloudCredentialEnvironment(Zotero, ChromeUtils, Services, Components);
}

export function maskCloudApiKey(value: string): string {
  if (value.length <= 10) return '*****';
  return `${value.slice(0, 5)}*****${value.slice(-5)}`;
}

export class CloudCredentialStore {
  constructor(private readonly environment?: CloudCredentialEnvironment) {}

  private env(): CloudCredentialEnvironment {
    return this.environment || runtimeEnvironment();
  }

  private async matchingLogins(username: string): Promise<CloudCredentialLogin[]> {
    const found = await this.env().search();
    return found.filter(login => login.username === username);
  }

  async get(provider: string): Promise<string | null> {
    try {
      const login = (await this.matchingLogins(cloudCredentialUsername(provider)))[0];
      if (!login) return null;
      if (!this.env().isEncrypted(login.password)) {
        throw new CloudCredentialStorageError(
          'The stored Cloud API key is not protected by Zotero OSKeyStore.',
        );
      }
      return await this.env().decrypt(login.password);
    } catch (error: any) {
      if (error instanceof CloudCredentialStorageError) throw error;
      // Platform errors are intentionally not copied into user-visible text:
      // a credential backend must never be allowed to echo secret material.
      throw new CloudCredentialStorageError('Could not read the Cloud API key from secure storage.');
    }
  }

  async has(provider: string): Promise<boolean> {
    return (await this.get(provider)) !== null;
  }

  async set(value: string, provider: string): Promise<void> {
    const apiKey = value.trim();
    if (!apiKey) throw new CloudCredentialStorageError('Cloud API key must not be empty.');
    const username = cloudCredentialUsername(provider);
    try {
      const env = this.env();
      const encrypted = await env.encrypt(apiKey);
      if (!encrypted || !env.isEncrypted(encrypted)) {
        throw new CloudCredentialStorageError(
          'Zotero OSKeyStore did not return an encrypted credential.',
        );
      }
      const current = await this.matchingLogins(username);
      const replacement = env.makeLogin(username, encrypted);
      if (current.length > 0) await env.modify(current[0], replacement);
      else await env.add(replacement);
      // The primary value is already changed at this point. Invalidate any
      // verification before best-effort duplicate cleanup, so a cleanup error
      // cannot leave an old key certified.
      bumpCloudCredentialRevision(provider);
      // Remove stale duplicates only after the new value has been stored.
      for (const duplicate of current.slice(1)) await env.remove(duplicate);
    } catch (error: any) {
      if (error instanceof CloudCredentialStorageError) throw error;
      throw new CloudCredentialStorageError('Could not save the Cloud API key securely.');
    }
  }

  async clear(provider: string): Promise<void> {
    try {
      const env = this.env();
      for (const login of await this.matchingLogins(cloudCredentialUsername(provider))) {
        await env.remove(login);
      }
      bumpCloudCredentialRevision(provider);
    } catch {
      throw new CloudCredentialStorageError('Could not remove the Cloud API key from secure storage.');
    }
  }
}

export const cloudCredentialStore = new CloudCredentialStore();
