import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { rootHost } from '@/lib/tenant';
import { signOut } from '../actions';
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

  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
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
  const { data: institutes } = await db
    .from('institutes')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false });
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
