import { brandStyle, logoUrl } from '@/lib/brand';
import { studentBatches } from '@/lib/student';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { signOut } from '../actions';
import { chooseBatch } from './actions';
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
        ? [...STAFF_NAV, ['/usage', 'AI usage']]
        : STAFF_NAV;
  return (
    <div className="shell" style={brandStyle(branding.color)}>
      <aside className="side">
        <a className="brand" href={nav[0]![0]}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny public logo, not worth image optimisation config
            <img className="logo" src={logo} alt="" width={38} height={38} />
          ) : (
            <span className="logo" aria-hidden="true">
              {initials(institute.name)}
            </span>
          )}
          <span>
            <b>{institute.name}</b>
            <small>{member.role === 'student' ? 'Student portal' : 'Staff portal'}</small>
          </span>
        </a>
        {batches && batches.list.length > 1 && (
          <form action={chooseBatch} className="switcher">
            <label>
              Batch
              <select name="batch" defaultValue={batches.selected!.id} key={batches.selected!.id}>
                {batches.list.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.leftAt ? ' (past)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Show</button>
          </form>
        )}
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
