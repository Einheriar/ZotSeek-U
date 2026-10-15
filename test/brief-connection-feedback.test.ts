import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BriefConnectionFeedback, briefConnectionContext, renderBriefConnectionStatus,
} from '../src/ui/brief-connection-feedback';

const status = { provider: 'alibaba-bailian', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  config: { fingerprint: 'model-a', revision: 1 } };

describe('brief connection feedback', () => {
  test('keeps a failed test visible across neutral status refreshes and a model-list refresh', () => {
    const feedback = new BriefConnectionFeedback();
    const context = briefConnectionContext(status, 2);
    const attempt = feedback.begin(context, 'Testing connection');
    assert.equal(feedback.read(context, false)?.phase, 'testing');
    feedback.finish(attempt, 'failed', 'Connection test failed: HTTP 404');
    for (let refresh = 0; refresh < 3; refresh++) {
      assert.equal(feedback.read(context, false)?.message, 'Connection test failed: HTTP 404');
    }
    const retry = feedback.begin(context, 'Testing again');
    assert.equal(feedback.read(context, false)?.phase, 'testing');
    feedback.finish(retry, 'verified', 'Connection verified');
    assert.equal(feedback.read(context, true)?.message, 'Connection verified');
  });

  test('does not retain an old result after model, provider, credential or endpoint changes', () => {
    const feedback = new BriefConnectionFeedback();
    const context = briefConnectionContext(status, 2);
    const attempt = feedback.begin(context, 'Testing');
    feedback.finish(attempt, 'failed', 'HTTP 404');
    for (const [next, revision] of [
      [{ ...status, provider: 'custom-openai-compatible' }, 2],
      [{ ...status, baseUrl: 'https://other.example.test/v1' }, 2],
      [{ ...status, config: { ...status.config, fingerprint: 'model-b' } }, 2],
      [{ ...status, config: { ...status.config, revision: 2 } }, 2],
      [status, 3],
    ] as const) assert.equal(feedback.read(briefConnectionContext(next, revision), false), null);
    assert.equal(feedback.read(context, true), null, 'external successful verification replaces the old failure');
  });

  test('ignores late completions and never manufactures verified status', () => {
    const feedback = new BriefConnectionFeedback();
    const context = briefConnectionContext(status, 2);
    const old = feedback.begin(context, 'Old test');
    const current = feedback.begin(context, 'Current test');
    feedback.finish(old, 'failed', 'Old failure');
    assert.equal(feedback.read(context, false)?.message, 'Current test');
    feedback.finish(current, 'verified', 'Verified');
    assert.equal(feedback.read(context, false), null);
    assert.equal(feedback.read(context, true)?.phase, 'verified');
  });

  test('shows persistent error styling and accessible live feedback without duplicating XUL labels', () => {
    const attributes = new Map<string, string>();
    const node = { textContent: '', style: { color: '' }, namespaceURI: '',
      setAttribute: (key: string, value: string) => attributes.set(key, value) };
    renderBriefConnectionStatus(node, '连接测试失败：HTTP 404', 'failed');
    assert.equal(node.textContent, '连接测试失败：HTTP 404');
    assert.match(node.style.color, /#c23b32/);
    assert.equal(attributes.get('role'), 'status');
    assert.equal(attributes.get('aria-live'), 'polite');
    assert.equal(attributes.get('data-connection-state'), 'failed');
    node.namespaceURI = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
    renderBriefConnectionStatus(node, 'Connection verified', 'verified');
    assert.equal(node.textContent, '');
    assert.equal(attributes.get('value'), 'Connection verified');
    assert.equal(attributes.get('data-connection-state'), 'verified');
  });
});
