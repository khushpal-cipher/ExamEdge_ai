import { ThemeToggle } from '../theme-toggle';
import { brandStyle, logoUrl } from '@/lib/brand';
import { paidState, pilotState } from '@/lib/pilot';
import { studentBatches } from '@/lib/student';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { signOut } from '../actions';
import { BatchSwitcher } from './batch-switcher';
import { MainNav } from './main-nav';

const STAFF_NAV = [
  ['/dashboard', 'Dashboard'],
  ['/batches', 'Batches'],
  ['/subjects', 'Subjects'],
  ['/tests', 'Tests'],
  ['/questions', 'Question bank'],
  ['/people', 'People'],
];
const STUDENT_NAV = [
  ['/home', 'Home'],
  ['/contests', 'Contest'],
  ['/progress', 'My progress'],
  ['/reviews', 'Review'],
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { institute, member, db } = await requireMember();
  const [{ data: me }, { data: inst }] = await Promise.all([
    db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle(),
    db.from('institutes').select('status, pilot_end, paid_until').eq('id', institute.id).maybeSingle(),
  ]);
  const pilot = inst && pilotState(inst.status, inst.pilot_end);
  const paid = inst && paidState(inst.status, inst.paid_until);
  const manager = MANAGERS.includes(member.role);
  // Step 9: warn owner/admin at 80% of the AI budget (billing_status is for owner/admin only).
  const bs = manager
    ? (
        await db
          .rpc('billing_status', { inst: institute.id })
          .maybeSingle<{ ai_used_micro: number; ai_budget_micro: number }>()
      ).data
    : null;
  const aiPct =
    bs && Number(bs.ai_budget_micro) > 0
      ? Math.round((Number(bs.ai_used_micro) / Number(bs.ai_budget_micro)) * 100)
      : 0;
  const branding = institute.branding as { color?: string; logo?: string };
  const logo = logoUrl(branding.logo);
  const batches = member.role === 'student' ? await studentBatches() : null;
  const nav =
    member.role === 'student'
      ? STUDENT_NAV
      : manager
        ? [...STAFF_NAV, ['/reviews', 'Reviews'], ['/usage', 'Bill']]
        : STAFF_NAV;
  return (
    // Staff get the black-and-white look; students the same layout as a retro desktop window (r16-mono).
    <div className="shell" data-look={member.role === 'student' ? 'retro' : undefined}>
      {member.role === 'student' && (
        <div className="titlebar" aria-hidden="true">
          <span>{institute.name}</span>
        </div>
      )}
      <header className="side">
        <a className="brand" href={nav[0]![0]}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny public logo, not worth image optimisation config
            <img className="logo" src={logo} alt="" width={38} height={38} />
          ) : (
            // The institute's brand colour tints its own mark; the interface keeps the ExamEdge palette (ADR-049).
            <span className="logo" aria-hidden="true" style={brandStyle(branding.color)}>
              {initials(institute.name)}
            </span>
          )}
          <span>
            <b>{institute.name}</b>
            <small>{member.role === 'student' ? 'Student portal' : 'Staff portal'}</small>
          </span>
        </a>
        {batches && batches.list.length > 1 && <BatchSwitcher list={batches.list} selected={batches.selected!.id} />}
        <MainNav items={nav} />
        <div className="me">
          <span>
            <b>{me?.full_name ?? 'Signed in'}</b> · <span className="role">{member.role}</span>
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="main">
        {pilot?.ended || paid?.ended ? (
          <p role="alert" className="alert">
            {pilot?.ended ? 'Your free pilot has ended.' : 'Your plan has ended.'} Everything can still be read, but
            nothing can be changed and AI is off.
            {manager && ' Pay on the Bill page to continue.'}
          </p>
        ) : (
          manager &&
          (pilot || paid) && (
            <p
              role="status"
              className={(pilot ?? paid)!.daysLeft <= 3 ? 'alert' : 'notice'}
              hidden={!!paid && paid.daysLeft > 3}
            >
              {pilot ? 'Free pilot' : 'Your plan'}: {(pilot ?? paid)!.daysLeft}{' '}
              {(pilot ?? paid)!.daysLeft === 1 ? 'day' : 'days'} left.
              {(pilot ?? paid)!.daysLeft <= 3 && ' After that the app becomes read-only and AI stops.'}
              {paid && ' Renew on the Bill page.'}
            </p>
          )
        )}
        {manager && aiPct >= 80 && (
          <p role="alert" className="alert">
            {aiPct}% of the AI budget is used. <a href="/usage">Open the Bill page</a>
            {inst?.status === 'active' && ' to buy a top-up'}.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
