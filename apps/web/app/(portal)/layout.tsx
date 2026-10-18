import { brandStyle, logoUrl } from '@/lib/brand';
import { studentBatches } from '@/lib/student';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { signOut } from '../actions';
import { BatchSwitcher } from './batch-switcher';
import { NavLink } from '../nav-link';

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
  const { data: me } = await db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle();
  const branding = institute.branding as { color?: string; logo?: string };
  const logo = logoUrl(branding.logo);
  const batches = member.role === 'student' ? await studentBatches() : null;
  const nav =
    member.role === 'student'
      ? STUDENT_NAV
      : MANAGERS.includes(member.role)
        ? [...STAFF_NAV, ['/reviews', 'Reviews'], ['/usage', 'Bill']]
        : STAFF_NAV;
  return (
    <div className="shell">
      <aside className="side">
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
        <nav className="nav" aria-label="Main">
          {nav.map(([href, label]) => (
            <NavLink key={href} href={href!}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <b>{me?.full_name ?? 'Signed in'}</b>
          <span className="role">{member.role}</span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
