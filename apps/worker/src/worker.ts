import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { pool } from '../../../packages/database/client';
import { claimJob, completeJob, renewLease, retryJob } from '../../../packages/execution/queue';
import { cleanOrphanContainers, getRunnerImage, runCase } from './docker';
import { judge } from './judge';

let stopping = false;
let active: AbortController | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { stopping = true; active?.abort(); });
}

async function main() {
  await pool.query('SELECT 1');
  const image = await getRunnerImage();
  console.log('Execution worker ready. One job at a time.');
  let lastSweep = 0;
  while (!stopping) {
    if (Date.now() - lastSweep > 15_000) {
      await cleanOrphanContainers();
      lastSweep = Date.now();
    }
    const job = await claimJob();
    if (!job) { await delay(2000); continue; }
    active = new AbortController();
    const controller = active;
    let renewing: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (renewing) return;
      renewing = (async () => {
        if (!(await renewLease(job))) throw new Error('Execution lease lost.');
        await cleanOrphanContainers();
      })().catch(() => { controller.abort(); }).finally(() => { renewing = undefined; });
    }, 10_000);
    console.log('Execution started:', job.id, 'attempt', job.attempts);
    try {
      const result = await judge(job, (source, input, position) =>
        runCase(job, image, source, input, position, controller.signal));
      if (controller.signal.aborted) throw new Error('Execution interrupted.');
      const saved = await completeJob(job, result, image);
      console.log(saved ? 'Execution completed:' : 'Execution lease lost:', job.id);
    } catch {
      // Do not log candidate source, hidden inputs, stdout, credentials or Docker error text.
      console.error('Execution interrupted; retry scheduled if attempts remain:', job.id);
      await retryJob(job, stopping ? 'WORKER_INTERRUPTED' : 'RUNNER_UNAVAILABLE');
    } finally {
      clearInterval(timer);
      if (renewing) await renewing;
      active = undefined;
    }
  }
}

main().catch(() => {
  console.error('Worker stopped. Check database connectivity, migrations, Docker and runner image.');
  process.exitCode = 1;
}).finally(async () => { await pool.end(); });
