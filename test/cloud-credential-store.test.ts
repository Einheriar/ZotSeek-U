import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CloudCredentialEnvironment,
  CloudCredentialStore,
  cloudCredentialUsername,
  maskCloudApiKey,
  resolveCloudOSKeyStore,
} from '../src/core/cloud-credential-store';

function fakeEnvironment(initial: any[] = []) {
  const logins = [...initial];
  const environment: CloudCredentialEnvironment = {
    search: async () => [...logins],
    add: async login => { logins.push(login); },
    modify: async (oldLogin, newLogin) => {
      const index = logins.indexOf(oldLogin);
      logins[index] = newLogin;
    },
    remove: async login => { logins.splice(logins.indexOf(login), 1); },
    makeLogin: (username, password) => ({ username, password }),
    encrypt: async value => `encrypted:${value}`,
    decrypt: async value => value.slice('encrypted:'.length),
    isEncrypted: value => value.startsWith('encrypted:'),
  };
  return { environment, logins };
}

describe('cloud credential store', () => {
  test('uses the public Zotero OSKeyStore wrapper when available', async () => {
    const exposed = {
      encrypt: async (value: string) => `public:${value}`,
      decrypt: async (value: string) => value.slice('public:'.length),
      isEncrypted: (value: string) => value.startsWith('public:'),
    };
    assert.equal(resolveCloudOSKeyStore({ OSKeyStore: exposed }, {}).isEncrypted('public:key'), true);
  });

  test('uses Zotero 9 bundled OSKeyStore with a ZotSeek ciphertext marker', async () => {
    const compat = resolveCloudOSKeyStore({}, {
      importESModule: (path: string) => {
        assert.equal(path, 'resource://gre/modules/OSKeyStore.sys.mjs');
        return { OSKeyStore: {
          encrypt: async (value: string) => `native:${value}`,
          decrypt: async (value: string) => value.slice('native:'.length),
        } };
      },
    });
    const encrypted = await compat.encrypt('secret');
    assert.equal(encrypted.startsWith('zotseek-oskeystore-v1:'), true);
    assert.equal(compat.isEncrypted(encrypted), true);
    assert.equal(await compat.decrypt(encrypted), 'secret');
    await assert.rejects(() => compat.decrypt('plaintext'), /not protected/);
  });

  test('masks only the first and last five characters', () => {
    assert.equal(maskCloudApiKey('abcde123456789vwxyz'), 'abcde*****vwxyz');
    assert.equal(maskCloudApiKey('short'), '*****');
  });

  test('derives the login username from the provider id', () => {
    assert.equal(cloudCredentialUsername('alibaba-bailian'), 'alibaba-bailian');
    assert.equal(cloudCredentialUsername('openai'), 'openai');
    assert.equal(cloudCredentialUsername('custom-openai-compatible'), 'custom-openai-compatible');
  });

  test('stores, reads, replaces, and removes only encrypted values', async () => {
    const fake = fakeEnvironment();
    const store = new CloudCredentialStore(fake.environment);
    await store.set(' first-secret ', 'alibaba-bailian');
    assert.equal(fake.logins[0].username, 'alibaba-bailian');
    assert.equal(fake.logins[0].password, 'encrypted:first-secret');
    assert.equal(await store.get('alibaba-bailian'), 'first-secret');
    await store.set('second-secret', 'alibaba-bailian');
    assert.equal(fake.logins.length, 1);
    assert.equal(await store.get('alibaba-bailian'), 'second-secret');
    await store.clear('alibaba-bailian');
    assert.equal(await store.get('alibaba-bailian'), null);
  });

  test('keeps one independent encrypted slot per provider', async () => {
    const fake = fakeEnvironment();
    const store = new CloudCredentialStore(fake.environment);
    await store.set('bailian-key', 'alibaba-bailian');
    await store.set('openai-key', 'openai');
    await store.set('gemini-key', 'google-gemini-api');
    await store.set('custom-key', 'custom-openai-compatible');
    assert.equal(fake.logins.length, 4);
    assert.equal(await store.get('alibaba-bailian'), 'bailian-key');
    assert.equal(await store.get('openai'), 'openai-key');
    assert.equal(await store.get('google-gemini-api'), 'gemini-key');
    assert.equal(await store.get('custom-openai-compatible'), 'custom-key');
    // Switching providers never overwrites another provider's credential.
    await store.set('replaced-openai-key', 'openai');
    assert.equal(fake.logins.length, 4);
    assert.equal(await store.get('alibaba-bailian'), 'bailian-key');
    assert.equal(await store.get('openai'), 'replaced-openai-key');
    await store.clear('openai');
    assert.equal(fake.logins.length, 3);
    assert.equal(await store.get('google-gemini-api'), 'gemini-key');
  });

  test('refuses a plaintext credential and an encryption downgrade', async () => {
    const plaintext = fakeEnvironment([{ username: 'alibaba-bailian', password: 'plain' }]);
    await assert.rejects(
      () => new CloudCredentialStore(plaintext.environment).get('alibaba-bailian'),
      /not protected/,
    );

    const failed = fakeEnvironment();
    failed.environment.encrypt = async value => value;
    await assert.rejects(
      () => new CloudCredentialStore(failed.environment).set('secret', 'openai'),
      /did not return an encrypted/,
    );
    assert.equal(failed.logins.length, 0);
  });

  test('does not echo credential-backend errors that may contain the key', async () => {
    const fake = fakeEnvironment();
    fake.environment.encrypt = async () => {
      throw new Error('backend echoed super-secret-value');
    };
    await assert.rejects(
      () => new CloudCredentialStore(fake.environment).set('super-secret-value', 'openai'),
      (error: any) => !error.message.includes('super-secret-value'),
    );
  });

  test('bumps isolated revisions and invalidates the brief only for Bailian', async () => {
    const previousZotero = (globalThis as any).Zotero;
    const values = new Map<string, unknown>([
      ['zotseek.cloud.brief.connectionVerified', true],
    ]);
    (globalThis as any).Zotero = {
      Prefs: {
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => values.set(key, value),
      },
    };
    try {
      const fake = fakeEnvironment();
      const store = new CloudCredentialStore(fake.environment);

      await store.set('openai-key', 'openai');
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 1);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified'), true);

      await store.set('bailian-key', 'alibaba-bailian');
      assert.equal(values.get('zotseek.cloud.credentialRevision.alibaba-bailian'), 1);
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 1);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified'), false);

      await store.clear('openai');
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 2);
      assert.equal(values.get('zotseek.cloud.credentialRevision.alibaba-bailian'), 1);
    } finally {
      if (previousZotero === undefined) delete (globalThis as any).Zotero;
      else (globalThis as any).Zotero = previousZotero;
    }
  });
});
