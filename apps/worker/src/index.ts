import { PgBoss } from 'pg-boss';
import pg from 'pg';
import { log } from '@examedge/core/log';

const connectionString = process.env.WORKER_DATABASE_URL;
if (!connectionString) throw new Error('WORKER_DATABASE_URL is required');

export const pool = new pg.Pool({ connectionString, max: 5 });
const boss = new PgBoss({ connectionString, schema: 'pgboss', createSchema: false });
boss.on('error', (err) => log.error('pgboss.error', { err }));

async function heartbeat() {
  await pool.query('insert into private.worker_heartbeats default values');
  log.info('worker.heartbeat');
}

await boss.start();
await boss.createQueue('heartbeat');
await boss.schedule('heartbeat', '* * * * *');
await boss.work('heartbeat', heartbeat);
await heartbeat();
log.info('worker.started');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
}
