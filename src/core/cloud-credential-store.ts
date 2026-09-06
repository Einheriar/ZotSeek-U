/** Secure storage for Cloud BYOK credentials. Never falls back to prefs or plaintext files. */

import { invalidateBriefConnectionVerification } from './brief-generation-config';

declare const Components: any;
declare const ChromeUtils: any;
declare const Services: any;
declare const Zotero: any;

const LOGIN_ORIGIN = 'chrome://zotseek';
const LOGIN_REALM = 'ZotSeek Cloud Embedding API Key (encrypted)';
const COMPAT_CIPHERTEXT_PREFIX = 'zotseek-oskeystore-v1:';
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
  if (provider === 'alibaba-bailian') {
    try { invalidateBriefConnectionVerification(); } catch { /* preferences unavailable */ }
  }
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

/**
 * Zotero 9.0 ships Mozilla's OSKeyStore module but does not expose
 * Zotero.OSKeyStore. Keep the newer public wrapper as the preferred path and
 * use the bundled module as an encrypted-at-rest compatibility path.
 */
export function resolveCloudOSKeyStore(
  zoteroRuntime: any,
  chromeUtilsRuntime: any,
): CloudOSKeyStore {
  const exposed = zoteroRuntime?.OSKeyStore;
  if (exposed && typeof exposed.encrypt === 'function' &&
      typeof exposed.decrypt === 'function' &&
      typeof exposed.isEncrypted === 'function') {
    return exposed;
  }

  let bundled: any;
  try {
    bundled = chromeUtilsRuntime?.importESModule?.(
      'resource://gre/modules/OSKeyStore.sys.mjs',
    )?.OSKeyStore;
  } catch {
    // The caller converts this into the generic secure-storage error.
  }
  if (!bundled || typeof bundled.encrypt !== 'function' || typeof bundled.decrypt !== 'function') {
    throw new CloudCredentialStorageError('Zotero secure credential storage is unavailable.');
  }
  return {
    encrypt: async value => {
      const cipherText = await bundled.encrypt(value);
      if (!cipherText) return '';
      return `${COMPAT_CIPHERTEXT_PREFIX}${cipherText}`;
    },
    decrypt: async value => {
      if (!value.startsWith(COMPAT_CIPHERTEXT_PREFIX)) {
        throw new CloudCredentialStorageError(
          'The stored Cloud API key is not protected by Zotero OSKeyStore.',
        );
      }
      return await bundled.decrypt(value.slice(COMPAT_CIPHERTEXT_PREFIX.length));
    },
    isEncrypted: value => value.startsWith(COMPAT_CIPHERTEXT_PREFIX),
  };
}

function runtimeEnvironment(): CloudCredentialEnvironment {
  const logins = Services?.logins;
  if (!logins) {
    throw new CloudCredentialStorageError('Zotero secure credential storage is unavailable.');
  }
  const keyStore = resolveCloudOSKeyStore(Zotero, ChromeUtils);
  return {
    search: () => logins.searchLoginsAsync({ origin: LOGIN_ORIGIN, httpRealm: LOGIN_REALM }),
    add: login => logins.addLoginAsync(login),
    modify: (oldLogin, newLogin) => logins.modifyLoginAsync(oldLogin, newLogin),
    remove: login => logins.removeLoginAsync(login),
    makeLogin: (username, encryptedValue) => {
      const LoginInfo = new Components.Constructor(
        '@mozilla.org/login-manager/loginInfo;1',
        Components.interfaces.nsILoginInfo,
        'init',
      );
      return new LoginInfo(
        LOGIN_ORIGIN,
        null,
        LOGIN_REALM,
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
