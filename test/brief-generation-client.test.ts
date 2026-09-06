import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BriefGenerationCancelledError,
  BriefGenerationClient,
  BriefGenerationRequestError,
  BriefGenerationTruncatedError,
  BriefGenerationUnavailableError,
  parseBriefRetryAfter,
} from '../src/core/brief-generation-client';

const config = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  modelName: 'deepseek-v4-flash-0731',
  apiKey: 'secret-key-not-for-logs',
  maxOutputTokens: 1024,
  thinkingEnabled: true,
};

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  };
}

function success(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chatcmpl-probe',
    model: config.modelName,
    choices: [{
      finish_reason: 'stop',
      message: {
        content: 'generated brief',
        reasoning_content: 'private reasoning',
      },
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 40,
      total_tokens: 140,
      completion_tokens_details: { reasoning_tokens: 12 },
    },
    ...overrides,
  };
}

describe('brief generation client', () => {
  test('uses the dedicated Chat Completions contract with thinking enabled', async () => {
    let request: any;
    const client = new BriefGenerationClient(config, {
      abortController: null,
      fetch: async (url, init) => {
        request = { url, init };
        return response(200, success());
      },
    });
    const result = await client.generate([{ role: 'user', content: 'evidence' }], 0);
    const body = JSON.parse(request.init.body);
    assert.equal(request.url, `${config.baseUrl}/chat/completions`);
    assert.equal(body.model, config.modelName);
    assert.equal(body.enable_thinking, true);
    assert.equal(body.max_completion_tokens, config.maxOutputTokens);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.stream, false);
    assert.equal(result.content, 'generated brief');
    assert.equal(result.reasoningContent, 'private reasoning');
    assert.equal(result.usage?.reasoningTokens, 12);
  });

  test('supports a bounded request-level completion budget', async () => {
    let request: any;
    const client = new BriefGenerationClient(config, {
      fetch: async (_url, init) => {
        request = init;
        return response(200, success());
      },
    });
    await client.generate(
      [{ role: 'user', content: 'classify' }],
      { retries: 0, maxCompletionTokens: 512 },
    );
    assert.equal(JSON.parse(request.body).max_completion_tokens, 512);
    await assert.rejects(
      () => client.generate(
        [{ role: 'user', content: 'too large' }],
        { maxCompletionTokens: config.maxOutputTokens + 1 },
      ),
      /within the configured output budget/,
    );
  });

  test('rejects a length finish reason instead of accepting a partial brief', async () => {
    const client = new BriefGenerationClient(config, {
      fetch: async () => response(200, success({
        choices: [{ finish_reason: 'length', message: { content: 'partial' } }],
      })),
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }], 0),
      BriefGenerationTruncatedError,
    );
  });

  test('does not retry deterministic errors and never exposes provider text', async () => {
    let attempts = 0;
    const client = new BriefGenerationClient(config, {
      fetch: async () => {
        attempts++;
        return response(401, {
          error: { code: 'invalid_api_key', message: 'secret-key-not-for-logs' },
        });
      },
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }]),
      (error: any) => error instanceof BriefGenerationRequestError
        && error.message.includes('invalid_api_key')
        && !error.message.includes('secret-key-not-for-logs'),
    );
    assert.equal(attempts, 1);
  });

  test('retries 429 using a bounded Retry-After delay', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = new BriefGenerationClient(config, {
      sleep: async ms => { delays.push(ms); },
      fetch: async () => {
        attempts++;
        return attempts === 1
          ? response(429, { error: { code: 'rate_limit' } }, { 'Retry-After': '2' })
          : response(200, success());
      },
    });
    const result = await client.generate([{ role: 'user', content: 'evidence' }], 1);
    assert.equal(result.content, 'generated brief');
    assert.deepEqual(delays, [2000]);
    assert.equal(parseBriefRetryAfter('999'), 60000);
  });

  test('defaults to three retries after the initial attempt', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = new BriefGenerationClient(config, {
      sleep: async ms => { delays.push(ms); },
      fetch: async () => {
        attempts++;
        return response(503, { error: { code: 'unavailable' } });
      },
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }]),
      BriefGenerationUnavailableError,
    );
    assert.equal(attempts, 4);
    assert.deepEqual(delays, [1000, 3000, 8000]);
  });

  test('cancels retry backoff before another billable request is sent', async () => {
    let attempts = 0;
    let backoffStarted!: () => void;
    const enteredBackoff = new Promise<void>(resolve => { backoffStarted = resolve; });
    const client = new BriefGenerationClient(config, {
      sleep: async () => {
        backoffStarted();
        return await new Promise<void>(() => {});
      },
      fetch: async () => {
        attempts++;
        return attempts === 1
          ? response(503, { error: { code: 'unavailable' } })
          : response(200, success());
      },
    });
    const pending = client.generate([{ role: 'user', content: 'evidence' }]);
    await enteredBackoff;
    client.cancelPending();
    await assert.rejects(pending, BriefGenerationCancelledError);
    assert.equal(attempts, 1);
    assert.equal(
      (await client.generate([{ role: 'user', content: 'later request' }], 0)).content,
      'generated brief',
    );
  });

  test('cancels an in-flight request and allows a later request', async () => {
    let attempts = 0;
    class FakeAbortController {
      private reject: ((error: Error) => void) | null = null;
      signal = {
        setReject: (reject: (error: Error) => void) => { this.reject = reject; },
      };
      abort() {
        const error = new Error('aborted');
        error.name = 'AbortError';
        this.reject?.(error);
      }
    }
    const client = new BriefGenerationClient(config, {
      abortController: FakeAbortController,
      fetch: async (_url, init) => {
        attempts++;
        if (attempts === 1) {
          return await new Promise((_resolve, reject) => init.signal.setReject(reject));
        }
        return response(200, success());
      },
    });
    const pending = client.generate([{ role: 'user', content: 'evidence' }], 0);
    client.cancelPending();
    await assert.rejects(pending, BriefGenerationCancelledError);
    assert.equal(
      (await client.generate([{ role: 'user', content: 'retry' }], 0)).content,
      'generated brief',
    );
  });

  test('classifies a timeout as unavailable and allows a later request', async () => {
    let attempts = 0;
    class FakeAbortController {
      private reject: ((error: Error) => void) | null = null;
      signal = {
        setReject: (reject: (error: Error) => void) => { this.reject = reject; },
      };
      abort() {
        const error = new Error('aborted');
        error.name = 'AbortError';
        this.reject?.(error);
      }
    }
    const client = new BriefGenerationClient({ ...config, requestTimeoutMs: 5 }, {
      abortController: FakeAbortController,
      fetch: async (_url, init) => {
        attempts++;
        if (attempts === 1) {
          return await new Promise((_resolve, reject) => init.signal.setReject(reject));
        }
        return response(200, success());
      },
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'timeout' }], 0),
      BriefGenerationUnavailableError,
    );
    assert.equal(
      (await client.generate([{ role: 'user', content: 'retry' }], 0)).content,
      'generated brief',
    );
  });

  test('rejects empty messages and unexpected response models', async () => {
    const client = new BriefGenerationClient(config, {
      fetch: async () => response(200, success({ model: 'unexpected-model' })),
    });
    await assert.rejects(() => client.generate([], 0), /non-empty text/);
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }], 0),
      /unexpected brief generation model/,
    );
  });

  test('rejects a null response message as a deterministic protocol error', async () => {
    let attempts = 0;
    const client = new BriefGenerationClient(config, {
      fetch: async () => {
        attempts++;
        return response(200, success({ choices: [{ finish_reason: 'stop', message: null }] }));
      },
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }]),
      (error: any) => error instanceof BriefGenerationRequestError
        && error.category === 'protocol'
        && !/TypeError|null/.test(error.message),
    );
    assert.equal(attempts, 1);
  });

  test('does not echo an unapproved provider error code', async () => {
    const client = new BriefGenerationClient(config, {
      fetch: async () => response(400, {
        error: { code: 'secret-key-not-for-logs <script>alert(1)</script>' },
      }),
    });
    await assert.rejects(
      () => client.generate([{ role: 'user', content: 'evidence' }], 0),
      (error: any) => error instanceof BriefGenerationRequestError
        && !error.message.includes('secret-key-not-for-logs')
        && error.category === 'invalid-request',
    );
  });
});
