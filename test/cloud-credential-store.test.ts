import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CloudCredentialEnvironment,
  CloudCredentialStore,
  cloudCredentialUsername,
  createCloudCredentialEnvironment,
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

/** Model the real platform boundary, including synchronous ESR methods. */
function runtimeFixture(publicWrapper: boolean, asyncMethods: boolean) {
  const logins: any[] = [];
  const calls = { add: 0, modify: 0, remove: 0 };
  const raw = {
    encrypt: async (value: string) => Buffer.from(value, 'utf8').toString('base64'),
    decrypt: async (value: string) => Buffer.from(value, 'base64').toString('latin1'),
  };
  const zotero = publicWrapper ? { OSKeyStore: {
    encrypt: async (value: string) => `oskv1:${await raw.encrypt(value)}`,
    decrypt: async (value: string) => Buffer.from(value.slice(6), 'base64').toString('utf8'),
    isEncrypted: (value: string) => value.startsWith('oskv1:'),
  } } : {};
  const manager: any = {
    searchLoginsAsync: async ({ origin, httpRealm }: any) =>
      logins.filter(login => login.origin === origin && login.httpRealm === httpRealm),
    addLoginAsync: async (login: any) => { calls.add++; logins.push(login); },
    [asyncMethods ? 'modifyLoginAsync' : 'modifyLogin']: (oldLogin: any, newLogin: any) => {
      assert.equal(manager, services.logins, 'Methods must keep their platform receiver');
      calls.modify++;
      logins[logins.indexOf(oldLogin)] = newLogin;
      return asyncMethods ? Promise.resolve() : undefined;
    },
    [asyncMethods ? 'removeLoginAsync' : 'removeLogin']: (login: any) => {
      calls.remove++;
      logins.splice(logins.indexOf(login), 1);
      return asyncMethods ? Promise.resolve() : undefined;
    },
  };
  const services = { logins: manager };
  const components = {
    interfaces: { nsILoginInfo: {} },
    Constructor: function () {
      return function (this: any, origin: string, _: any, httpRealm: string, username: string, password: string) {
        Object.assign(this, { origin, httpRealm, username, password });
      };
    },
  };
  const environment = createCloudCredentialEnvironment(
    zotero, { importESModule: () => ({ OSKeyStore: raw }) }, services, components,
  );
  return { logins, calls, manager, environment };
}

describe('cloud credential store', () => {
  test('uses the public Zotero OSKeyStore wrapper when available', async () => {
    const exposed = {
      encrypt: async (value: string) => `oskv1:${value}`,
      decrypt: async (value: string) => value.slice('oskv1:'.length),
      isEncrypted: (value: string) => value.startsWith('oskv1:'),
    };
    const store = resolveCloudOSKeyStore({ OSKeyStore: exposed }, {});
    assert.equal(store.isEncrypted('oskv1:key'), true);
    assert.equal(await store.decrypt(await store.encrypt('key')), 'key');
  });

  test('reads Zotero 9 ciphertext after the public wrapper appears without rewriting it', async () => {
    let imports = 0;
    const plaintext = 'synthetic-old-key';
    const publicStore = {
      encrypt: async () => { throw new Error('Read must not encrypt'); },
      // Zotero 10 intentionally returns unknown values unchanged.
      decrypt: async (value: string) => value,
      isEncrypted: (value: string) => value.startsWith('oskv1:'),
    };
    const compat = resolveCloudOSKeyStore({ OSKeyStore: publicStore }, {
      importESModule: () => {
        imports++;
        return { OSKeyStore: { encrypt: async () => 'cipher', decrypt: async () => plaintext } };
      },
    });
    assert.equal(imports, 0, 'The legacy module must be loaded only when needed');
    const fake = fakeEnvironment([
      { username: 'openai', password: 'zotseek-oskeystore-v1:old-cipher' },
    ]);
    Object.assign(fake.environment, compat);
    fake.environment.modify = async () => { throw new Error('Read must not modify'); };
    const store = new CloudCredentialStore(fake.environment);
    assert.equal(await store.get('openai'), plaintext);
    assert.equal(await store.has('openai'), true);
    assert.equal(fake.logins[0].password, 'zotseek-oskeystore-v1:old-cipher');
    assert.equal(imports, 1);
  });

  test('decodes both ciphertext formats as UTF-8 in a Zotero 9 runtime', async () => {
    const key = 'synthetic-密钥-é-🔑';
    const binary = Buffer.from(key, 'utf8').toString('latin1');
    const raw = { encrypt: async () => 'cipher', decrypt: async () => binary };
    const store = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) });
    for (const prefix of ['zotseek-oskeystore-v1:', 'oskv1:']) {
      assert.equal(await store.decrypt(`${prefix}cipher`), key);
    }
    assert.equal(await store.decrypt(await store.encrypt(key)), key);
  });

  test('does not decode public-wrapper plaintext twice or import the legacy module', async () => {
    const key = 'synthetic-密钥-é-🔑';
    const store = resolveCloudOSKeyStore({ OSKeyStore: {
      encrypt: async () => 'oskv1:cipher', decrypt: async () => key,
      isEncrypted: (value: string) => value.startsWith('oskv1:'),
    } }, { importESModule: () => { throw new Error('Legacy module must not load'); } });
    assert.equal(await store.decrypt(await store.encrypt(key)), key);
  });

  test('reads an existing Zotero 9 system secret after the Zotero 10 label change without generating secrets', async () => {
    const labels: string[] = [];
    const key = 'synthetic-旧仓库-🔑';
    const raw = {
      STORE_LABEL: 'Zotero Encrypted Storage',
      encrypt: async () => 'cipher',
      decrypt: async () => { throw new Error('Raw decrypt must not generate a missing secret'); },
    };
    const native = {
      asyncSecretAvailable: async (label: string) => { labels.push(`available:${label}`); return true; },
      asyncDecryptBytes: async (label: string, cipher: string) => {
        labels.push(`decrypt:${label}`);
        assert.equal(cipher, 'old-cipher');
        if (label === 'Zotero Encrypted Storage') throw new Error('Different encryption key');
        return Uint8Array.from(Buffer.from(key, 'utf8'));
      },
    };
    const store = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) }, () => native);
    assert.equal(await store.decrypt('zotseek-oskeystore-v1:old-cipher'), key);
    assert.equal(raw.STORE_LABEL, 'Zotero Encrypted Storage');
    assert.deepEqual(labels, [
      'available:Zotero Encrypted Storage', 'decrypt:Zotero Encrypted Storage',
      'available:Firefox Encrypted Storage', 'decrypt:Firefox Encrypted Storage',
    ]);
  });

  test('skips missing system secrets and never guesses historical labels for current-format values', async () => {
    const labels: string[] = [];
    const raw = {
      STORE_LABEL: 'Zotero Encrypted Storage', encrypt: async () => 'cipher',
      decrypt: async () => { throw new Error('current-format decryption failed'); },
    };
    const native = {
      asyncSecretAvailable: async (label: string) => { labels.push(label); return false; },
      asyncDecryptBytes: async () => { throw new Error('Missing secrets must not be read'); },
    };
    const store = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) }, () => native);
    await assert.rejects(() => store.decrypt('zotseek-oskeystore-v1:cipher'), /Could not read/);
    assert.deepEqual(labels, ['Zotero Encrypted Storage', 'Firefox Encrypted Storage']);
    labels.length = 0;
    await assert.rejects(() => store.decrypt('oskv1:cipher'), /current-format/);
    assert.equal(labels.length, 0);
  });

  test('uses an existing legacy secret when the current secret is absent', async () => {
    const raw = {
      STORE_LABEL: 'Zotero Encrypted Storage', encrypt: async () => 'cipher',
      decrypt: async () => { throw new Error('Do not generate a current secret'); },
    };
    const native = {
      asyncSecretAvailable: async (label: string) => label === 'Firefox Encrypted Storage',
      asyncDecryptBytes: async (label: string) => {
        assert.equal(label, 'Firefox Encrypted Storage');
        return Uint8Array.from(Buffer.from('legacy-key'));
      },
    };
    const store = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) }, () => native);
    assert.equal(await store.decrypt('zotseek-oskeystore-v1:cipher'), 'legacy-key');
  });

  test('honors cancellation and rejects damaged historical ciphertext without exposing platform errors', async () => {
    const raw = { STORE_LABEL: 'Zotero Encrypted Storage', encrypt: async () => 'cipher', decrypt: async () => '' };
    for (const cancelled of [true, false]) {
      const labels: string[] = [];
      const native = {
        asyncSecretAvailable: async () => true,
        asyncDecryptBytes: async (label: string) => {
          labels.push(label);
          if (cancelled) throw Object.assign(new Error('secret cancelled'), { result: 0x80004004 });
          throw new Error('backend echoed private-secret');
        },
      };
      const keyStore = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) }, () => native);
      const fake = fakeEnvironment([{ username: 'openai', password: 'zotseek-oskeystore-v1:cipher' }]);
      Object.assign(fake.environment, keyStore);
      await assert.rejects(() => new CloudCredentialStore(fake.environment).get('openai'), (error: any) =>
        /Could not read/.test(error.message) && !error.message.includes('secret'));
      assert.deepEqual(labels, cancelled ? ['Zotero Encrypted Storage'] : ['Zotero Encrypted Storage', 'Firefox Encrypted Storage']);
      assert.equal(fake.logins[0].password, 'zotseek-oskeystore-v1:cipher');
    }
  });

  test('Zotero 9 reads its own label without invoking the newer native compatibility path', async () => {
    const raw = { STORE_LABEL: 'Firefox Encrypted Storage', encrypt: async () => 'cipher', decrypt: async () => 'legacy-key' };
    const store = resolveCloudOSKeyStore({}, { importESModule: () => ({ OSKeyStore: raw }) }, () => {
      throw new Error('Native label compatibility is unnecessary in Zotero 9');
    });
    assert.equal(await store.decrypt('zotseek-oskeystore-v1:cipher'), 'legacy-key');
  });

  test('rejects plaintext, unknown versions and empty ciphertext even with a permissive wrapper', async () => {
    let decrypts = 0;
    const store = resolveCloudOSKeyStore({ OSKeyStore: {
      encrypt: async (value: string) => value,
      decrypt: async (value: string) => { decrypts++; return value; },
      isEncrypted: () => true,
    } }, {});
    for (const value of ['plain', 'oskv2:cipher', 'zotseek-oskeystore-v2:cipher', 'oskv1:', 'zotseek-oskeystore-v1:', '']) {
      assert.equal(store.isEncrypted(value), false);
      await assert.rejects(() => store.decrypt(value), /not protected/);
    }
    assert.equal(decrypts, 0);
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

  for (const publicWrapper of [false, true]) {
    for (const asyncMethods of [false, true]) {
      test(`${publicWrapper ? 'Zotero 10' : 'Zotero 9'} runtime adapter supports ${asyncMethods ? 'async' : 'sync'} replacement and removal`, async () => {
        const fixture = runtimeFixture(publicWrapper, asyncMethods);
        const store = new CloudCredentialStore(fixture.environment);
        await store.set('first-密钥', 'openai');
        await store.set('other-key', 'google-gemini-api');
        assert.equal(await store.get('openai'), 'first-密钥');
        const first = fixture.logins[0];
        // A damaged old value must not be decrypted to replace it.
        first.password = 'zotseek-oskeystore-v1:damaged';
        fixture.logins.push({ ...first });
        await store.set('replacement-🔑', 'openai');
        assert.equal(await store.get('openai'), 'replacement-🔑');
        assert.equal(fixture.logins.length, 2);
        assert.equal(fixture.calls.modify, 1);
        assert.equal(fixture.calls.remove, 1, 'Only the stale duplicate should be removed');
        assert.equal(await store.get('google-gemini-api'), 'other-key');
        await store.clear('openai');
        assert.equal(await store.has('openai'), false);
        assert.equal(fixture.calls.remove, 2);
        assert.equal(await store.get('google-gemini-api'), 'other-key');
      });
    }
  }

  test('synchronous platform errors are sanitized and preserve existing entries', async () => {
    const fixture = runtimeFixture(true, false);
    const store = new CloudCredentialStore(fixture.environment);
    await store.set('original-key', 'openai');
    const original = fixture.logins[0];
    fixture.manager.modifyLogin = () => { throw new Error('platform echoed secret-value'); };
    await assert.rejects(() => store.set('secret-value', 'openai'), (error: any) =>
      /Could not save/.test(error.message) && !error.message.includes('secret-value'));
    assert.equal(fixture.logins[0], original);
    fixture.manager.removeLogin = () => { throw new Error('platform echoed original-key'); };
    await assert.rejects(() => store.clear('openai'), (error: any) =>
      /Could not remove/.test(error.message) && !error.message.includes('original-key'));
    assert.equal(await store.get('openai'), 'original-key');
  });

  test('failed encryption or replacement leaves duplicates and revision untouched', async () => {
    const previousZotero = (globalThis as any).Zotero;
    const values = new Map<string, unknown>();
    (globalThis as any).Zotero = { Prefs: {
      get: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, value),
    } };
    try {
      const fake = fakeEnvironment([
        { username: 'openai', password: 'encrypted:original' },
        { username: 'openai', password: 'encrypted:duplicate' },
      ]);
      const before = [...fake.logins];
      const encrypt = fake.environment.encrypt;
      const store = new CloudCredentialStore(fake.environment);
      fake.environment.encrypt = async () => { throw new Error('cannot encrypt secret'); };
      await assert.rejects(() => store.set('secret', 'openai'), /Could not save/);
      assert.deepEqual(fake.logins, before);
      fake.environment.encrypt = encrypt;
      fake.environment.modify = async () => { throw new Error('cannot modify secret'); };
      await assert.rejects(() => store.set('secret', 'openai'), /Could not save/);
      assert.deepEqual(fake.logins, before);
      assert.equal(values.size, 0);
      assert.equal(await store.get('openai'), 'original');
      assert.equal(await store.has('openai'), true);
      assert.equal(values.size, 0, 'Reads must not change revision or verification');
    } finally {
      if (previousZotero === undefined) delete (globalThis as any).Zotero;
      else (globalThis as any).Zotero = previousZotero;
    }
  });

  test('invalidates verification before duplicate cleanup can fail after replacement', async () => {
    const previousZotero = (globalThis as any).Zotero;
    const values = new Map<string, unknown>([['zotseek.cloud.brief.connectionVerified.openai', true]]);
    (globalThis as any).Zotero = { Prefs: {
      get: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, value),
    } };
    try {
      const fake = fakeEnvironment([
        { username: 'openai', password: 'encrypted:original' },
        { username: 'openai', password: 'encrypted:duplicate' },
      ]);
      fake.environment.remove = async () => { throw new Error('cleanup failed'); };
      const store = new CloudCredentialStore(fake.environment);
      await assert.rejects(() => store.set('replacement', 'openai'), /Could not save/);
      assert.equal(await store.get('openai'), 'replacement');
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 1);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified.openai'), false);
    } finally {
      if (previousZotero === undefined) delete (globalThis as any).Zotero;
      else (globalThis as any).Zotero = previousZotero;
    }
  });

  test('damaged ciphertext errors are sanitized and do not overwrite the login', async () => {
    const fake = fakeEnvironment([{ username: 'openai', password: 'encrypted:damaged' }]);
    fake.environment.decrypt = async () => { throw new Error('backend echoed damaged-secret'); };
    const store = new CloudCredentialStore(fake.environment);
    await assert.rejects(() => store.get('openai'), (error: any) =>
      /Could not read/.test(error.message) && !error.message.includes('damaged-secret'));
    assert.equal(fake.logins[0].password, 'encrypted:damaged');
  });

  test('bumps isolated revisions and invalidates only the matching brief provider', async () => {
    const previousZotero = (globalThis as any).Zotero;
    const values = new Map<string, unknown>([
      ['zotseek.cloud.brief.connectionVerified', true],
      ['zotseek.cloud.brief.connectionVerified.openai', true],
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
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified.openai'), false);

      values.set('zotseek.cloud.brief.connectionVerified.openai', true);
      await store.set('bailian-key', 'alibaba-bailian');
      assert.equal(values.get('zotseek.cloud.credentialRevision.alibaba-bailian'), 1);
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 1);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified'), false);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified.openai'), true);

      await store.clear('openai');
      assert.equal(values.get('zotseek.cloud.credentialRevision.openai'), 2);
      assert.equal(values.get('zotseek.cloud.credentialRevision.alibaba-bailian'), 1);
      assert.equal(values.get('zotseek.cloud.brief.connectionVerified.openai'), false);
    } finally {
      if (previousZotero === undefined) delete (globalThis as any).Zotero;
      else (globalThis as any).Zotero = previousZotero;
    }
  });
});
