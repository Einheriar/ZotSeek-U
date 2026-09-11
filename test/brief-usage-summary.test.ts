import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  summarizeBriefJobUsage,
  type BriefJobResult,
} from '../src/core/brief-service';

describe('brief job usage summary', () => {
  test('aggregates successful and failed jobs while preserving completeness', () => {
    const results: BriefJobResult[] = [
      {
        key: 'success',
        status: 'success',
        result: {
          status: 'success',
          content: 'brief',
          classification: 'standard',
          promptSlot: 'standard',
          promptHash: 'a'.repeat(64),
          evidence: {} as any,
          usage: {
            requestCount: 2,
            reportedRequests: 2,
            unreportedRequests: 0,
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
            reasoningTokens: 5,
            complete: true,
          },
        },
      },
      {
        key: 'failed',
        status: 'failed',
        result: {
          status: 'failed',
          reason: 'generation_failed',
          usage: {
            requestCount: 2,
            reportedRequests: 1,
            unreportedRequests: 1,
            promptTokens: 10,
            completionTokens: 2,
            totalTokens: 12,
            complete: false,
          },
        },
      },
    ];
    assert.deepEqual(summarizeBriefJobUsage(results), {
      requestCount: 4,
      reportedRequests: 3,
      unreportedRequests: 1,
      promptTokens: 110,
      completionTokens: 22,
      totalTokens: 132,
      reasoningTokens: 5,
      complete: false,
    });
  });

  test('omits usage when no provider request started', () => {
    assert.equal(summarizeBriefJobUsage([
      { key: 'skip', status: 'skipped', reason: 'no_main_pdf' },
    ]), undefined);
  });
});
