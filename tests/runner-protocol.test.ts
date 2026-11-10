import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// These are fixed, trusted test fixtures only. Never use this host invocation for candidate code.
function fixture(source: string, input: unknown[] = []) {
  return spawnSync(process.execPath, ['apps/worker/runner/execute.cjs'], {
    input: JSON.stringify({ source, input }), encoding: 'utf8', timeout: 2000, maxBuffer: 65536,
  });
}

test('runner protocol returns JSON and redirects console output', () => {
  const result = fixture('function solve(a,b) { console.log("debug"); return a+b; }', [2, 3]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { value: 5 });
  assert.match(result.stderr, /debug/);
});

test('async JSON values and Unicode round-trip correctly', () => {
  const result = fixture('async function solve() { return {text:"हैलो 👋", items:[false,null,2]}; }');
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout).value, { text: 'हैलो 👋', items: [false, null, 2] });
});

test('invalid return values, syntax errors and missing solve fail without output', () => {
  for (const code of [
    'function solve() {}', 'function solve() { return NaN; }', 'function solve() { return 1n; }',
    'function solve() { return { bad: undefined }; }', 'function solve(', 'const answer=5;',
  ]) {
    const result = fixture(code);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});
