import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { ExecutionJob } from '../../../packages/execution/types';
import { leaseIsActive } from '../../../packages/execution/queue';
import type { SandboxResult } from './judge';

const namespace = process.env.WORKER_NAMESPACE ?? 'interview-platform-local';
if (!/^[a-z0-9-]{1,32}$/.test(namespace)) throw new Error('Invalid WORKER_NAMESPACE.');
const label = 'interview-platform.execution';
const ownerLabel = 'interview-platform.namespace';
const tokenLabel = 'interview-platform.lease';
const runtime = process.env.RUNNER_RUNTIME;

interface CommandResult { code: number | null; stdout: string; timedOut: boolean; overflow: boolean }

// execFile/spawn arguments only; never interpolate candidate code into a shell command.
function docker(args: string[], options: { input?: string; timeout?: number; signal?: AbortSignal } = {}) {
  return new Promise<CommandResult>((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('Worker interrupted.'));
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    let overflow = false;
    const abort = () => child.kill('SIGKILL');
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort(); }, options.timeout ?? 10_000);
    const collect = (chunk: Buffer, output: boolean) => {
      size += chunk.length;
      if (size > 65536) { overflow = true; abort(); return; }
      if (output) stdout.push(chunk);
    };
    child.stdout.on('data', (data: Buffer) => collect(data, true));
    child.stderr.on('data', (data: Buffer) => collect(data, false));
    child.stdin.on('error', () => {}); // EPIPE if candidate exits before consuming input.
    const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    child.on('error', () => { cleanup(); reject(new Error('Docker command unavailable.')); });
    child.on('close', (code) => {
      cleanup();
      if (options.signal?.aborted) reject(new Error('Worker interrupted.'));
      else resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), timedOut, overflow });
    });
    child.stdin.end(options.input ?? '');
  });
}

export async function getRunnerImage() {
  const result = await docker(['image', 'inspect', process.env.RUNNER_IMAGE ?? 'interview-runner:v1', '--format', '{{.Id}}']);
  if (result.code !== 0 || !/^sha256:[a-f0-9]{64}$/.test(result.stdout.trim())) {
    throw new Error('Runner image unavailable. Run npm run runner:build with Docker Desktop running.');
  }
  return result.stdout.trim(); // Resolve a mutable tag once; every case uses the same image ID.
}

export async function runCase(job: ExecutionJob, image: string, source: string, input: unknown[], position: number, signal: AbortSignal): Promise<SandboxResult> {
  const name = `ip-run-${namespace}-${job.id}-${job.lease_token}-${position}`;
  let created = false;
  try {
    const create = await docker([
      'create', '--name', name, '-i', '--init', '--pull', 'never',
      '--label', `${ownerLabel}=${namespace}`, '--label', `${label}=${job.id}`,
      '--label', `${tokenLabel}=${job.lease_token}`,
      '--network', 'none', '--memory', '128m', '--memory-swap', '128m',
      '--cpus', '0.5', '--pids-limit', '32', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--user', '1000:1000',
      '--ulimit', 'nofile=64:64', '--ulimit', 'core=0:0', '--shm-size', '1m',
      '--log-driver', 'none', '--restart', 'no',
      ...(runtime ? ['--runtime', runtime] : []), image,
    ], { signal });
    if (create.code !== 0 || create.timedOut || create.overflow) throw new Error('Container creation failed.');
    created = true;
    const start = performance.now();
    const result = await docker(['start', '-a', '-i', name], {
      input: JSON.stringify({ source, input }), timeout: 5000, signal,
    });
    const duration_ms = Math.round(performance.now() - start);
    if (result.overflow) return { verdict: 'OUTPUT_LIMIT_EXCEEDED', duration_ms };
    if (result.timedOut) return { verdict: 'TIME_LIMIT_EXCEEDED', duration_ms };
    const inspect = await docker(['inspect', '--format', '{{json .State}}', name], { signal });
    if (inspect.code !== 0) throw new Error('Container state unavailable.');
    const state = JSON.parse(inspect.stdout);
    if (state.Running || state.Error) throw new Error('Container failed to finish.');
    if (state.OOMKilled || state.ExitCode !== 0) return { verdict: 'RUNTIME_ERROR', duration_ms };
    if (result.code !== 0) throw new Error('Docker attach failed.');
    try {
      const output = JSON.parse(result.stdout);
      if (!output || typeof output !== 'object' || !Object.hasOwn(output, 'value')) throw new Error();
      return { verdict: 'OK', value: output.value, duration_ms };
    } catch { return { verdict: 'RUNTIME_ERROR', duration_ms }; }
  } finally {
    // Killing the docker client does NOT stop the container; remove it explicitly.
    const removed = await docker(['rm', '-f', name]);
    if (created && removed.code !== 0) throw new Error('Container cleanup failed.');
  }
}

export async function cleanOrphanContainers() {
  const listed = await docker(['ps', '-aq', '--filter', `label=${ownerLabel}=${namespace}`]);
  if (listed.code !== 0 || listed.overflow || listed.timedOut) throw new Error('Docker unavailable.');
  for (const id of listed.stdout.trim().split(/\s+/).filter(Boolean)) {
    const info = await docker(['inspect', '--format', '{{json .Config.Labels}}', id]);
    if (info.code !== 0) continue; // Another worker may have removed it already.
    const labels = JSON.parse(info.stdout);
    const execution = labels[label];
    const token = labels[tokenLabel];
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!uuid.test(execution ?? '') || !uuid.test(token ?? '')) continue;
    // If the DB is unreachable, this throws instead of deleting another worker's live container.
    if (!(await leaseIsActive(execution, token))) {
      const removed = await docker(['rm', '-f', id]);
      if (removed.code !== 0) throw new Error('Orphan cleanup failed.');
    }
  }
}
