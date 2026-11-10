import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { judge } from '../apps/worker/src/judge';
import type { ExecutionJob } from '../packages/execution/types';

function job(expected: unknown): ExecutionJob {
  return { id: randomUUID(), lease_token: randomUUID(), attempts: 1, source_code: 'candidate code',
    test_cases: [{ position: 1, input: [2, 3], expected_output: expected, is_hidden: true }] };
}

test('trusted judge compares values; expected answer is never passed to sandbox', async () => {
  const result = await judge(job({ a: 1, b: [2, 3] }), async (...args) => {
    assert.deepEqual(args, ['candidate code', [2, 3], 1]);
    return { verdict: 'OK', value: { b: [2, 3], a: 1 }, duration_ms: 12 };
  });
  assert.equal(result.verdict, 'ACCEPTED');
  assert.equal(result.passed_tests, 1);
  assert.equal(JSON.stringify(result).includes('expected_output'), false);
});

test('array order and JSON types matter', async () => {
  for (const value of [[3, 2], '2', null]) {
    const result = await judge(job([2, 3]), async () => ({ verdict: 'OK', value, duration_ms: 1 }));
    assert.equal(result.verdict, 'WRONG_ANSWER');
  }
});

test('all cases are evaluated and failures are preserved', async () => {
  const execution = job(5);
  execution.test_cases.push({ position: 2, input: [0, 0], expected_output: 0, is_hidden: false });
  const result = await judge(execution, async (_code, _input, position) => position === 1
    ? { verdict: 'TIME_LIMIT_EXCEEDED', duration_ms: 5000 }
    : { verdict: 'OK', value: 0, duration_ms: 15 });
  assert.equal(result.verdict, 'TIME_LIMIT_EXCEEDED');
  assert.equal(result.passed_tests, 1);
  assert.equal(result.results.length, 2);
});

test('infrastructure failures abort job instead of scoring candidate', async () => {
  await assert.rejects(judge(job(5), async () => { throw new Error('Docker unavailable'); }));
});
