import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isUuid, rootHost } from '@/lib/tenant';
import { logoUrl } from '@/lib/brand';
import { monthUsage, usd } from '@/lib/usage';
import { deleteInstitute, updateInstitute, updateQuotas, uploadLogo } from '../../actions';
import { ReinviteOwner } from './reinvite-form';

const MB = 1024 * 1024;
const ERRORS: Record<string, string> = {
  logo: 'Choose a PNG, JPG or WebP logo up to 500 KB.',
  confirm_mismatch: 'Not deleted: the typed address did not match.',
  has_members: 'Not deleted: people have already joined. Suspend it instead, then follow the offboarding runbook.',
};

export default async function InstituteAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const db = await supabase();
  // getClaims verifies the JWT; the database re-checks aal2 in every policy anyway.
  const { data: claims } = await db.auth.getClaims();
  if (claims?.claims.aal !== 'aal2') redirect('/');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data: inst }, { data: q }, { spent }] = await Promise.all([
    db.from('institutes').select('id, slug, name, status, branding').eq('id', id).maybeSingle(),
    db.from('institute_quotas').select('*').eq('institute_id', id).maybeSingle(),
    monthUsage(db, id),
  ]);
  if (!inst || !q) notFound();
  const { ok, error } = await searchParams;
  const branding = inst.branding as { color?: string; logo?: string };
  const color = branding.color ?? '#d97757';
  const logo = logoUrl(branding.logo);
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
          {ERRORS[error] ?? 'Please check the values and try again.'}
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
        <p className="small muted">Suspending blocks every member immediately.</p>
        <form action={uploadLogo} className="inline" aria-label="Logo">
          <input type="hidden" name="institute_id" value={inst.id} />
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny public logo, not worth image optimisation config */}
          {logo && <img src={logo} alt={`${inst.name} logo`} width={48} height={48} className="logo" />}
          <label>
            Logo (PNG, JPG or WebP, up to 500 KB)
            <input name="logo" type="file" required accept="image/png,image/jpeg,image/webp" />
          </label>
          <button type="submit">Upload logo</button>
        </form>
      </section>
      <section className="card stack" aria-labelledby="quotas">
        <h2 id="quotas">Usage limits</h2>
        <p>
          AI spent this month: <b>{usd(spent)}</b> of {usd(q.monthly_ai_budget_micro_usd)}
        </p>
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
            <label className="row" style={{ display: 'flex' }}>
              <input name="ai_enabled" type="checkbox" defaultChecked={q.ai_enabled} />
              AI enabled
            </label>
          </div>
          <div>
            <button type="submit" className="primary">
              Save limits
            </button>
          </div>
        </form>
        <p className="small muted">The AI gateway checks these limits before every AI call.</p>
      </section>
      <section className="card stack" aria-labelledby="owner">
        <h2 id="owner">Owner invitation</h2>
        <p className="small muted">
          Wrong owner email, or the link was lost or expired? Send a new one. Earlier owner links stop working. Not
          needed once the owner has joined.
        </p>
        <ReinviteOwner instituteId={inst.id} />
      </section>
      <section className="card stack" aria-labelledby="delete">
        <h2 id="delete">Delete institute</h2>
        <p className="small muted">
          For an institute created by mistake (wrong owner email or address). Works only while nobody has joined; it
          cannot be undone.
        </p>
        <form action={deleteInstitute} className="inline">
          <input type="hidden" name="institute_id" value={inst.id} />
          <label>
            Type {inst.slug} to confirm
            <input name="confirm_slug" required autoComplete="off" />
          </label>
          <button type="submit">Delete institute</button>
        </form>
      </section>
    </>
  );
}
