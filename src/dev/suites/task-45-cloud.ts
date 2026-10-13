import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import {
  assertCloudBaseUrl,
  calculateCloudRecommendedChunkTokens,
  cloudModelId,
  CLOUD_MODEL_DIMENSIONS,
  CLOUD_MODEL_ID,
  CLOUD_MODEL_NAME,
  getCloudModelSettings,
} from '../../core/cloud-model-config';
import {
  cloudCredentialStore,
  CloudCredentialStore,
  createCloudCredentialEnvironment,
  getCloudCredentialRevision,
  maskCloudApiKey,
  resolveCloudOSKeyStore,
} from '../../core/cloud-credential-store';

declare const ChromeUtils: any;
declare const Components: any;
declare const Services: any;
declare const Zotero: any;

selfTest.register('task-45-cloud', async () => {
  return [
    await scenario('Cloud model identity and endpoint contract are stable', async () => {
      const settings = getCloudModelSettings();
      assertEq(CLOUD_MODEL_ID, 'cloud:alibaba-bailian:qwen3.7-text-embedding:1024');
      assertEq(CLOUD_MODEL_NAME, 'qwen3.7-text-embedding');
      assertEq(CLOUD_MODEL_DIMENSIONS, 1024);
      assertTrue(!!assertCloudBaseUrl(settings.baseUrl), 'configured endpoint must remain allowlisted');
      assertTrue(cloudModelId(settings).startsWith('cloud:alibaba-bailian:'), 'configured model id');
      assertEq(
        settings.recommendedChunkTokens,
        calculateCloudRecommendedChunkTokens(settings.maxInputTokens),
      );
    }),
    await scenario('Zotero secure credential services are available', async () => {
      assertTrue(!!Services?.logins, 'Login Manager is unavailable');
      assertTrue(!!resolveCloudOSKeyStore(Zotero, ChromeUtils), 'OSKeyStore is unavailable');
      // Read-only: never create, overwrite, delete, probe, or log a real key.
      const key = await cloudCredentialStore.get('alibaba-bailian');
      if (key) {
        const masked = maskCloudApiKey(key);
        assertTrue(masked.includes('*****'), 'stored key must have a safe display form');
        assertTrue(masked !== key, 'masked key must not reveal the credential');
      }
    }),
    await scenario('isolated secure credentials survive replacement and removal on the real platform', async () => {
      // A unique realm and provider keep both logins and revision prefs away
      // from real BYOK entries. Only this run's synthetic records are removed.
      const provider = `__zotseek_credential_test_${Zotero.Utilities.generateObjectKey()}`;
      const scope = { origin: 'chrome://zotseek-self-test', realm: provider };
      const env = createCloudCredentialEnvironment(Zotero, ChromeUtils, Services, Components, scope);
      const store = new CloudCredentialStore(env);
      const synthetic = 'zotseek-self-test-密钥-é-🔑';
      const prefKeys = [
        `zotseek.cloud.credentialRevision.${provider}`,
        `zotseek.cloud.brief.connectionVerified.${provider}`,
        `zotseek.cloud.brief.connectionVerified.binding.${provider}`,
        `zotseek.cloud.brief.configFingerprint.${provider}`,
      ];
      try {
        await store.set(synthetic, provider);
        assertTrue(await store.get(provider) === synthetic, 'initial credential read failed');
        const revision = getCloudCredentialRevision(provider);
        await store.has(provider);
        assertEq(getCloudCredentialRevision(provider), revision, 'read changed credential revision');

        // Test both stored formats, even when the current runtime exposes only
        // one writing path. No network or real API key is involved.
        const raw = ChromeUtils.importESModule('resource://gre/modules/OSKeyStore.sys.mjs').OSKeyStore;
        const cipher = await raw.encrypt(synthetic);
        for (const prefix of ['zotseek-oskeystore-v1:', 'oskv1:']) {
          const current = (await env.search())[0];
          await env.modify(current, env.makeLogin(provider, `${prefix}${cipher}`));
          assertTrue(await store.get(provider) === synthetic, 'cross-version ciphertext read failed');
        }
        // Re-entering a key must work even if the old ciphertext is damaged.
        await env.modify((await env.search())[0], env.makeLogin(provider, 'zotseek-oskeystore-v1:damaged'));
        await store.set(`${synthetic}-replacement`, provider);
        assertTrue(await store.get(provider) === `${synthetic}-replacement`, 'replacement failed');
        assertEq(getCloudCredentialRevision(provider), revision + 1, 'replacement revision missing');
        assertTrue(Zotero.Prefs.get(`zotseek.cloud.brief.connectionVerified.${provider}`, true) === false,
          'replacement left brief verification active');
        await store.clear(provider);
        assertTrue(!await store.has(provider), 'deleted credential is still present');
        assertEq((await env.search()).length, 0, 'synthetic credential was not removed');
      } finally {
        for (const login of await env.search()) await env.remove(login);
        for (const key of prefKeys) Zotero.Prefs.clear(key, true);
      }
    }),
  ];
});
