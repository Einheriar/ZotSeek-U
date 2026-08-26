import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorkerInput } from '../src/core/worker-input';

const config = {
  queryPrefix: 'query: ',
  docPrefix: 'passage: ',
};

describe('worker input preparation', () => {
  test('preserves long input and only adds the document prefix', () => {
    const raw = 'x'.repeat(20_000);
    assert.equal(prepareWorkerInput(raw, 'doc', config), `passage: ${raw}`);
  });

  test('uses the task-specific prefix exactly once', () => {
    assert.equal(prepareWorkerInput('cats', 'query', config), 'query: cats');
    assert.equal(prepareWorkerInput('cats', 'doc', config), 'passage: cats');
  });

  test('leaves text unchanged when the model has no prefix', () => {
    const raw = '测试文本'.repeat(3000);
    assert.equal(prepareWorkerInput(raw, 'query', { queryPrefix: '', docPrefix: '' }), raw);
  });
});
