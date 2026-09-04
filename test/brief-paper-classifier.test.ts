import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS,
  BriefPaperClassificationError,
  classifyBriefPapers,
  type BriefClassifierGenerationClient,
  type BriefPaperClassificationInput,
} from '../src/core/brief-paper-classifier';

const inputs: BriefPaperClassificationInput[] = [
  {
    key: 'library:item-a',
    title: 'A systematic review of synchrony',
    abstract: 'We synthesize prior research.',
  },
  {
    key: 'library:item-b',
    title: 'An experiment on synchrony',
    abstract: 'Participants completed a task and we report results.',
  },
];

function fakeClient(contents: string[]) {
  const calls: Array<{ messages: any[]; options: any }> = [];
  const client: BriefClassifierGenerationClient = {
    generate: async (messages, options) => {
      calls.push({ messages, options });
      const content = contents.shift();
      if (content === undefined) throw new Error('unexpected call');
      return { content };
    },
  };
  return { client, calls };
}

describe('brief paper classifier', () => {
  test('routes titles and abstracts with forced binary machine values', async () => {
    const fake = fakeClient([
      '{"items":[{"id":1,"type":"review"},{"id":2,"type":"standard"}]}',
    ]);
    assert.deepEqual(await classifyBriefPapers(inputs, fake.client), [
      { key: 'library:item-a', kind: 'review' },
      { key: 'library:item-b', kind: 'standard' },
    ]);
    const system = fake.calls[0].messages[0].content;
    const user = fake.calls[0].messages[1].content;
    assert.match(system, /Never output "uncertain"/);
    assert.match(system, /ambiguous.*choose "standard"/s);
    assert.equal(user.includes('library:item-a'), false);
    assert.deepEqual(JSON.parse(user), {
      articles: [
        { id: 1, title: inputs[0].title, abstract: inputs[0].abstract },
        { id: 2, title: inputs[1].title, abstract: inputs[1].abstract },
      ],
    });
    assert.deepEqual(fake.calls[0].options, {
      retries: 3,
      maxCompletionTokens: BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS,
    });
  });

  test('retries one invalid protocol response without echoing it back', async () => {
    const invalid = 'not-json PRIVATE_PROVIDER_OUTPUT';
    const fake = fakeClient([
      invalid,
      '{"items":[{"id":1,"type":"review"},{"id":2,"type":"standard"}]}',
    ]);
    const result = await classifyBriefPapers(inputs, fake.client);
    assert.equal(result[0].kind, 'review');
    assert.equal(fake.calls.length, 2);
    assert.match(fake.calls[1].messages[1].content, /previous response violated/i);
    assert.equal(fake.calls[1].messages[1].content.includes(invalid), false);
  });

  test('rejects a second invalid protocol response', async () => {
    const fake = fakeClient([
      '{"items":[{"id":1,"type":"uncertain"}]}',
      '{"items":[{"id":1,"type":"review"}]}',
    ]);
    await assert.rejects(
      () => classifyBriefPapers(inputs, fake.client),
      BriefPaperClassificationError,
    );
    assert.equal(fake.calls.length, 2);
  });

  test('requires JSON-only output with no extra schema fields', async () => {
    const fake = fakeClient([
      'Here is the result: {"items":[{"id":1,"type":"review"},{"id":2,"type":"standard"}]}',
      '{"items":[{"id":1,"type":"review","reason":"title"},{"id":2,"type":"standard"}]}',
    ]);
    await assert.rejects(
      () => classifyBriefPapers(inputs, fake.client),
      BriefPaperClassificationError,
    );
  });

  test('does not convert transport failures into a paper type', async () => {
    let attempts = 0;
    const client: BriefClassifierGenerationClient = {
      generate: async () => {
        attempts++;
        throw new Error('transport failed');
      },
    };
    await assert.rejects(() => classifyBriefPapers(inputs, client), /transport failed/);
    assert.equal(attempts, 1);
  });

  test('rejects duplicate keys and batches larger than three', async () => {
    const fake = fakeClient([]);
    await assert.rejects(
      () => classifyBriefPapers([inputs[0], inputs[0]], fake.client),
      /keys must be unique/,
    );
    await assert.rejects(
      () => classifyBriefPapers([
        inputs[0],
        inputs[1],
        { key: 'c', title: '', abstract: '' },
        { key: 'd', title: '', abstract: '' },
      ], fake.client),
      /1-3 articles/,
    );
  });
});
