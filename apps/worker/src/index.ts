import { PgBoss } from 'pg-boss';
import pg from 'pg';
import { log } from '@examedge/core/log';
import { assertLiveAi } from '@examedge/core/demo';
import { ingestVersion, pendingJobs, type Job } from './ingest';
import { purge } from './purge';
import { updateInrRate } from './rate';
import { remindRenewals } from './renewal';
import { workerDownloader, workerStorage } from './storage';

assertLiveAi(process.env);
const connectionString = process.env.WORKER_DATABASE_URL;
if (!connectionString) throw new Error('WORKER_DATABASE_URL is required');

export const pool = new pg.Pool({ connectionString, max: 5 });
const boss = new PgBoss({ connectionString, schema: 'pgboss', createSchema: false });
boss.on('error', (err) => log.error('pgboss.error', { err }));
const download = await workerDownloader();
const storage = await workerStorage();

async function heartbeat() {
  await pool.query('insert into private.worker_heartbeats default values');
  log.info('worker.heartbeat');
}

// The web app never enqueues: it marks a version `queued`. This poll turns waiting versions into jobs (stately queue
// + singleton key = one queued and one active job per version) and also re-sends versions whose worker died.
async function enqueuePending() {
  for (const job of await pendingJobs(pool)) await boss.send('ingest', job, { singletonKey: job.version_id });
}

await boss.start();
await boss.createQueue('heartbeat');
await boss.schedule('heartbeat', '* * * * *');
await boss.work('heartbeat', heartbeat);
// Retention (ADR-029, ADR-031): chats after 12 months, daily counters after 35 days, deleted documents' files after
// 30 days, unused logos. Logs counts only.
await boss.createQueue('purge');
await boss.schedule('purge', '0 3 * * *', null, { tz: 'Asia/Kolkata' });
await boss.work('purge', async () => log.info('purge.done', await purge(pool, storage)));
await boss.createQueue('renewal');
await boss.schedule('renewal', '0 9 * * *', null, { tz: 'Asia/Kolkata' });
await boss.work('renewal', async () => log.info('renewal.done', await remindRenewals(pool)));
await boss.createQueue('rate');
await boss.schedule('rate', '0 8 * * *', null, { tz: 'Asia/Kolkata' });
await boss.work('rate', async () => log.info('rate.done', await updateInrRate(pool)));
await boss.send('rate', null, { singletonKey: 'rate-start' }); // set on the first start, not a day later
await boss.createQueue('ingest', { policy: 'stately' });
await boss.work<Job>('ingest', async ([job]) => {
  if (job) await ingestVersion({ pool, download }, job.data);
});
await heartbeat();
const poll = setInterval(() => enqueuePending().catch((err) => log.error('ingest.poll_failed', { err })), 5_000);
log.info('worker.started');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    clearInterval(poll);
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
}
