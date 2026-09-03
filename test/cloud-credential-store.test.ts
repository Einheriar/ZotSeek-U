import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CloudCredentialEnvironment,
  CloudCredentialStore,
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
    makeLogin: password => ({ username: 'alibaba-bailian', password }),
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

  test('stores, reads, replaces, and removes only encrypted values', async () => {
    const fake = fakeEnvironment();
    const store = new CloudCredentialStore(fake.environment);
    await store.set(' first-secret ');
    assert.equal(fake.logins[0].password, 'encrypted:first-secret');
    assert.equal(await store.get(), 'first-secret');
    await store.set('second-secret');
    assert.equal(fake.logins.length, 1);
    assert.equal(await store.get(), 'second-secret');
    await store.clear();
    assert.equal(await store.get(), null);
  });

  test('refuses a plaintext credential and an encryption downgrade', async () => {
    const plaintext = fakeEnvironment([{ username: 'alibaba-bailian', password: 'plain' }]);
    await assert.rejects(() => new CloudCredentialStore(plaintext.environment).get(), /not protected/);

    const failed = fakeEnvironment();
    failed.environment.encrypt = async value => value;
    await assert.rejects(() => new CloudCredentialStore(failed.environment).set('secret'), /did not return an encrypted/);
    assert.equal(failed.logins.length, 0);
  });

  test('does not echo credential-backend errors that may contain the key', async () => {
    const fake = fakeEnvironment();
    fake.environment.encrypt = async () => {
      throw new Error('backend echoed super-secret-value');
    };
    await assert.rejects(
      () => new CloudCredentialStore(fake.environment).set('super-secret-value'),
      (error: any) => !error.message.includes('super-secret-value'),
    );
  });
});
