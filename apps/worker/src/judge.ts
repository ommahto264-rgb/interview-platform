import { isDeepStrictEqual } from 'node:util';
import type { ExecutionJob, ExecutionResult, Verdict } from '../../../packages/execution/types';

export interface SandboxResult {
  verdict: 'OK' | Exclude<Verdict, 'ACCEPTED' | 'WRONG_ANSWER'>;
  value?: unknown;
  duration_ms: number;
}
export type Sandbox = (source: string, input: unknown[], position: number) => Promise<SandboxResult>;

export async function judge(job: ExecutionJob, sandbox: Sandbox): Promise<ExecutionResult> {
  const results: ExecutionResult['results'] = [];
  for (const test of job.test_cases) {
    // Expected answers never cross the sandbox boundary.
    const actual = await sandbox(job.source_code, test.input, test.position);
    const verdict = actual.verdict === 'OK'
      ? (isDeepStrictEqual(actual.value, test.expected_output) ? 'ACCEPTED' : 'WRONG_ANSWER')
      : actual.verdict;
    results.push({ position: test.position, is_hidden: test.is_hidden, verdict, duration_ms: actual.duration_ms });
  }
  return {
    verdict: results.find((result) => result.verdict !== 'ACCEPTED')?.verdict ?? 'ACCEPTED',
    passed_tests: results.filter((result) => result.verdict === 'ACCEPTED').length,
    results,
  };
}
