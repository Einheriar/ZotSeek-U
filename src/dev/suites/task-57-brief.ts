import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import { briefPromptStore } from '../../core/brief-prompt-store';
import { briefService } from '../../core/brief-service';
import { markdownToSafeHtml } from '../../core/brief-markdown';
import { BRIEF_MIN_TEXT_CODE_POINTS } from '../../core/brief-source-builder';

/**
 * Read-only runtime checks for Plan 57. This suite never calls a provider,
 * reads a paper, creates a Note, or changes a preference.
 */
selfTest.register('task-57-brief', async () => {
  return [
    await scenario('packaged and active Brief prompts are readable as a complete pair', async () => {
      const bundled = await briefPromptStore.loadBundledRequired();
      const active = await briefPromptStore.loadRequired();
      assertTrue(bundled.standard.content.trim().length > 0, 'bundled standard prompt missing');
      assertTrue(bundled.review.content.trim().length > 0, 'bundled review prompt missing');
      assertTrue(active.standard.content.trim().length > 0, 'active standard prompt missing');
      assertTrue(active.review.content.trim().length > 0, 'active review prompt missing');
    }),
    await scenario('Brief runtime status exposes no prompt bodies or credentials', async () => {
      const status = await briefService.getStatus();
      const serialized = JSON.stringify(status);
      assertTrue(typeof status.enabled === 'boolean', 'enabled state missing');
      assertTrue(typeof status.hasCredential === 'boolean', 'credential presence missing');
      assertTrue(!serialized.includes('content'), 'prompt body leaked through runtime status');
      assertTrue(!serialized.includes('apiKey'), 'credential field leaked through runtime status');
      assertTrue(!serialized.includes('zotseek-brief-prompts'), 'managed prompt path leaked through runtime status');
    }),
    await scenario('Brief safety constants and sanitizer are active', async () => {
      assertEq(BRIEF_MIN_TEXT_CODE_POINTS, 100);
      const html = markdownToSafeHtml('[safe](https://example.com)<script>bad()</script>');
      assertTrue(!/<script/iu.test(html), 'script element survived sanitization');
      assertTrue(!/javascript:/iu.test(html), 'dangerous URL survived sanitization');
    }),
  ];
});
