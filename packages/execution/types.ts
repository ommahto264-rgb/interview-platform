export type Verdict =
  | 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED' | 'RUNTIME_ERROR';

export interface TestCase {
  position: number;
  input: unknown[];
  expected_output: unknown;
  is_hidden: boolean;
}

export interface CaseResult {
  position: number;
  is_hidden: boolean;
  verdict: Verdict;
  duration_ms: number;
}

export interface ExecutionJob {
  id: string;
  lease_token: string;
  source_code: string;
  test_cases: TestCase[];
  attempts: number;
}

export interface ExecutionResult {
  verdict: Verdict;
  passed_tests: number;
  results: CaseResult[];
}
