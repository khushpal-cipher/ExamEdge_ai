import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { rootHost } from '@/lib/tenant';
import { signOut } from '../actions';
import { setGlobalAi } from './actions';
import { SignIn } from '../sign-in';
import { CreateInstitute } from './create-form';
import { Mfa } from './mfa';

export default async function Platform({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const db = await supabase();
  const { data: claims } = await db.auth.getClaims();
  const { error } = await searchParams;
  if (!claims?.claims.sub)
    return (
      <div className="center">
        <h1>ExamEdge platform admin</h1>
        <SignIn failed={error === 'signin'} />
      </div>
    );

  if (claims.claims.aal !== 'aal2') {
    const { data: factors } = await db.auth.mfa.listFactors();
    return (
      <div className="center">
        <h1>Two-factor sign-in</h1>
        {error === 'code' && (
          <p role="alert" className="alert">
            That code did not work. Try the next one.
          </p>
        )}
        <section className="card">
          <Mfa factorId={factors?.totp[0]?.id ?? null} />
        </section>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    );
  }

  // RLS: rows appear only for platform admins with an aal2 session.
  const [{ data: institutes }, { data: aiOn }] = await Promise.all([
    db.from('institutes').select('id, slug, name, status, created_at').order('created_at', { ascending: false }),
    db.rpc('ai_enabled'),
  ]);
  return (
    <>
      <div className="top">
        <div>
          <h1>Institutes</h1>
          <p className="muted">Platform admins see institutes and quotas only — never students&apos; data.</p>
        </div>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
      {error === 'ai' && (
        <p role="alert" className="alert">
          Could not change the AI switch. Sign in again and retry.
        </p>
      )}
      <p>
        <Link href="/library">ExamEdge library</Link>{' '}
        <span className="small muted">— write, review and publish shared content</span>
      </p>
      <section className="card stack" aria-labelledby="ai">
        <h2 id="ai">AI for all institutes</h2>
        <form action={setGlobalAi} className="row">
          <span className={`badge ${aiOn ? 'good' : 'bad'}`}>{aiOn ? 'AI is on' : 'AI is off everywhere'}</span>
          <input type="hidden" name="enabled" value={aiOn ? 'false' : 'true'} />
          <button type="submit" className={aiOn ? '' : 'primary'}>
            {aiOn ? 'Turn AI off for everyone' : 'Turn AI back on'}
          </button>
        </form>
        <p className="small muted">Emergency switch: blocks every AI call of every institute from the next request.</p>
      </section>
      <section className="card stack" aria-labelledby="new">
        <h2 id="new">New institute</h2>
        <CreateInstitute root={rootHost()} />
      </section>
      <section className="card" aria-labelledby="list">
        <h2 id="list">All institutes ({institutes?.length ?? 0})</h2>
        {!institutes?.length ? (
          <p className="empty">No institutes visible. Only platform admins see institutes here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institute</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {institutes.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/institutes/${i.id}`}>{i.name}</Link>
                    </td>
                    <td>
                      {i.slug}.{rootHost()}
                    </td>
                    <td>
                      <span className={`badge ${i.status === 'suspended' ? 'bad' : 'good'}`}>{i.status}</span>
                    </td>
                    <td>{new Date(i.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
