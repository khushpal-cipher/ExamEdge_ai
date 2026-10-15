// Platform ops: create an institute + its host and print the owner's one-time invitation link.
// Usage: npm run create-institute -- <slug> "<Name>" <owner-email> [host]   (host defaults to <slug>.localhost)
import { createHash, randomBytes } from 'node:crypto';
import { localSupabase } from './local-supabase';

const [slug, name, email, host = `${slug}.localhost`] = process.argv.slice(2);
if (!slug || !name || !email) throw new Error('usage: create-institute <slug> "<Name>" <owner-email> [host]');

const { db } = localSupabase();
await db.connect();
try {
  await db.query('begin');
  const { rows } = await db.query('insert into public.institutes (slug, name) values ($1, $2) returning id', [
    slug,
    name,
  ]);
  const id = rows[0].id;
  await db.query('insert into public.institute_domains (hostname, institute_id) values ($1, $2)', [host, id]);
  const token = randomBytes(32).toString('hex');
  await db.query(
    `insert into public.invitations (institute_id, email, role, token_hash) values ($1, lower($2), 'owner', $3)`,
    [id, email, createHash('sha256').update(token).digest()],
  );
  await db.query('commit');
  console.log(`Institute ${slug} created. Owner invitation (shown once): http://${host}:3000/invite/${token}`);
} catch (e) {
  await db.query('rollback');
  throw e;
} finally {
  await db.end();
}
