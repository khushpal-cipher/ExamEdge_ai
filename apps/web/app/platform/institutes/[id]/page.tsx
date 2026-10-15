import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isUuid, rootHost } from '@/lib/tenant';
import { updateInstitute, updateQuotas } from '../../actions';

const MB = 1024 * 1024;

export default async function InstituteAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const db = await supabase();
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data: inst }, { data: q }] = await Promise.all([
    db.from('institutes').select('id, slug, name, status, branding').eq('id', id).maybeSingle(),
    db.from('institute_quotas').select('*').eq('institute_id', id).maybeSingle(),
  ]);
  if (!inst || !q) notFound();
  const { ok, error } = await searchParams;
  const color = (inst.branding as { color?: string }).color ?? '#d97757';
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/">Institutes</Link>
          </p>
          <h1>{inst.name}</h1>
          <p className="muted">
            {inst.slug}.{rootHost()}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="alert">
          Please check the values and try again.
        </p>
      )}
      {ok && (
        <p role="status" className="notice">
          Saved.
        </p>
      )}
      <section className="card stack" aria-labelledby="profile">
        <h2 id="profile">Institute</h2>
        <form action={updateInstitute} className="inline">
          <input type="hidden" name="institute_id" value={inst.id} />
          <label>
            Name
            <input name="name" defaultValue={inst.name} required maxLength={120} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={inst.status}>
              {['pilot', 'active', 'suspended', 'offboarding'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Brand colour
            <input name="color" type="color" defaultValue={color} />
          </label>
          <button type="submit" className="primary">
            Save institute
          </button>
        </form>
        <p className="small muted">
          Suspending blocks every member immediately. Logo upload arrives with file storage.
        </p>
      </section>
      <section className="card stack" aria-labelledby="quotas">
        <h2 id="quotas">Usage limits</h2>
        <form action={updateQuotas} className="stack">
          <input type="hidden" name="institute_id" value={inst.id} />
          <div className="inline">
            <label>
              Monthly AI budget (USD)
              <input
                name="monthly_budget_usd"
                type="number"
                min={0}
                step="0.01"
                defaultValue={q.monthly_ai_budget_micro_usd / 1_000_000}
              />
            </label>
            <label>
              Doubts per student per day
              <input
                name="student_daily_messages"
                type="number"
                min={0}
                max={10000}
                defaultValue={q.student_daily_messages}
              />
            </label>
            <label>
              Step-by-step answers per day
              <input
                name="student_daily_premium_messages"
                type="number"
                min={0}
                max={10000}
                defaultValue={q.student_daily_premium_messages}
              />
            </label>
            <label>
              Generations per student per day
              <input
                name="student_daily_generations"
                type="number"
                min={0}
                max={10000}
                defaultValue={q.student_daily_generations}
              />
            </label>
          </div>
          <div className="inline">
            <label>
              Max upload (MB)
              <input name="max_upload_mb" type="number" min={0} max={500} defaultValue={q.max_upload_bytes / MB} />
            </label>
            <label>
              Storage (GB)
              <input name="max_storage_gb" type="number" min={0} defaultValue={q.max_storage_bytes / (1024 * MB)} />
            </label>
            <label>
              Parallel background jobs
              <input name="max_concurrent_jobs" type="number" min={1} max={50} defaultValue={q.max_concurrent_jobs} />
            </label>
            <label className="row" style={{ display: 'flex' }}>
              <input name="hard_stop" type="checkbox" defaultChecked={q.hard_stop} />
              Stop AI when the budget is used up
            </label>
          </div>
          <div>
            <button type="submit" className="primary">
              Save limits
            </button>
          </div>
        </form>
        <p className="small muted">Limits are enforced by the AI gateway once AI features are switched on.</p>
      </section>
    </>
  );
}
