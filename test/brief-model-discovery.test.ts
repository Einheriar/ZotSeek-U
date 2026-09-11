import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BriefModelDiscoveryClient,
  filterBriefModelSuggestions,
} from '../src/core/brief-model-discovery';

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

describe('brief model discovery', () => {
  test('lists OpenAI-visible model ids without claiming generation capability', async () => {
    let request: any;
    const client = new BriefModelDiscoveryClient({
      provider: 'openai',
      baseUrl: '',
      apiKey: 'openai-secret',
    }, {
      fetch: async (url, init) => {
        request = { url, init };
        return response({ data: [{ id: 'gpt-luna' }, { id: 'text-embedding-test' }] });
      },
    });
    const models = await client.discover();
    assert.equal(request.url, 'https://api.openai.com/v1/models');
    assert.equal(request.init.headers.Authorization, 'Bearer openai-secret');
    assert.deepEqual(models.map(model => model.id), ['gpt-luna', 'text-embedding-test']);
    assert.equal(models[0].verifiedCapability, false);
  });

  test('filters Gemini models to generateContent and strips the models prefix', async () => {
    const client = new BriefModelDiscoveryClient({
      provider: 'google-gemini-api',
      baseUrl: '',
      apiKey: 'gemini-secret',
    }, {
      fetch: async () => response({
        models: [
          {
            name: 'models/gemini-luna',
            displayName: 'Gemini Luna',
            supportedGenerationMethods: ['generateContent'],
            inputTokenLimit: 1000,
            outputTokenLimit: 500,
          },
          { name: 'models/embed-only', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    });
    const models = await client.discover();
    assert.deepEqual(models, [{
      id: 'gemini-luna',
      displayName: 'Gemini Luna',
      inputTokenLimit: 1000,
      outputTokenLimit: 500,
      verifiedCapability: true,
    }]);
  });

  test('uses the Bailian generation-model endpoint', async () => {
    let url = '';
    const client = new BriefModelDiscoveryClient({
      provider: 'alibaba-bailian',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'bailian-secret',
    }, {
      fetch: async input => {
        url = input;
        return response({ output: { models: [{ name: 'qwen-luna' }] } });
      },
    });
    assert.equal((await client.discover())[0].id, 'qwen-luna');
    assert.match(url, /^https:\/\/dashscope\.aliyuncs\.com\/api\/v1\/models\?/u);
    assert.match(url, /capabilities=TG/u);
  });

  test('uses the configured Custom models endpoint without claiming capability', async () => {
    let request: any;
    const client = new BriefModelDiscoveryClient({
      provider: 'custom-openai-compatible',
      baseUrl: 'https://gateway.example.test/v1/',
      apiKey: 'custom-secret',
    }, {
      fetch: async (url, init) => {
        request = { url, init };
        return response({ data: [{ id: 'vendor-luna-chat' }] });
      },
    });
    const models = await client.discover();
    assert.equal(request.url, 'https://gateway.example.test/v1/models');
    assert.equal(request.init.headers.Authorization, 'Bearer custom-secret');
    assert.deepEqual(models, [{ id: 'vendor-luna-chat', verifiedCapability: false }]);
  });

  test('filters autocomplete locally and keeps prefix matches first', () => {
    const values = [
      { id: 'other-luna', verifiedCapability: false },
      { id: 'luna-chat', verifiedCapability: false },
      { id: 'unrelated', verifiedCapability: false },
    ];
    assert.deepEqual(
      filterBriefModelSuggestions(values, 'luna').map(model => model.id),
      ['luna-chat', 'other-luna'],
    );
  });
});
