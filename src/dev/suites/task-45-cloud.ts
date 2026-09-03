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
  maskCloudApiKey,
  resolveCloudOSKeyStore,
} from '../../core/cloud-credential-store';

declare const ChromeUtils: any;
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
      const key = await cloudCredentialStore.get();
      if (key) {
        const masked = maskCloudApiKey(key);
        assertTrue(masked.includes('*****'), 'stored key must have a safe display form');
        assertTrue(masked !== key, 'masked key must not reveal the credential');
      }
    }),
  ];
});
