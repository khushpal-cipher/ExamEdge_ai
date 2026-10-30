import { ThemeToggle } from './theme-toggle';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentHost, currentInstitute, currentMember, isRootHost } from '@/lib/tenant';
import { signOut } from './actions';
import { SignIn } from './sign-in';
import { SiteShell } from './site-shell';

const DESCRIPTION =
  'ExamEdge AI gives coaching institutes an AI tutor, AI notes and tests with ranks for every student. Free 7-day pilot, simple per-account pricing in rupees.';

// Only the root host is the public marketing page; institute hosts stay unindexed (layout default).
export async function generateMetadata(): Promise<Metadata> {
  if (!isRootHost(await currentHost())) return {};
  return {
    title: 'AI learning platform for coaching institutes',
    description: DESCRIPTION,
    robots: { index: true, follow: true },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const institute = await currentInstitute();
  if (!institute) {
    if (!isRootHost(await currentHost())) notFound();
    return <Landing />;
  }
  if (institute.status === 'suspended') {
    return (
      <main className="center">
        <div>
          <h1>{institute.name}</h1>
          <p className="lede">This institute is currently suspended.</p>
        </div>
      </main>
    );
  }
  const member = await currentMember();
  if (member?.role) redirect(member.role === 'student' ? '/home' : '/dashboard');
  return (
    <main className="center">
      <ThemeToggle corner />
      <div>
        <h1>{institute.name}</h1>
        <p className="lede">Your notes, tests, results and Smart Study, in one place.</p>
      </div>
      {!member && <SignIn failed={(await searchParams).error === 'signin'} />}
      {member && (
        <div className="card stack">
          <p role="status">You are not a member of this institute.</p>
          <p className="small muted">Ask your institute for an invitation link, then sign in with the invited email.</p>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      )}
    </main>
  );
}

const FEATURES: [string, string][] = [
  [
    'AI tutor for every student',
    'Students ask doubts any time and get answers from your own notes, with the page cited.',
  ],
  [
    'AI notes and tests',
    'Turn a teacher’s explanation into notes, and a topic into a test with an answer key to approve.',
  ],
  [
    'Tests, checking and ranks',
    'MCQ, numerical and written questions, teacher checking, test rank and overall rank per batch.',
  ],
  [
    'Progress you can read',
    'Streaks, topic strength and results for each student, visible to the student and their teachers.',
  ],
];

const PRICES: [string, string][] = [
  ['First 300 accounts', '₹200 per account per month'],
  ['Accounts 301 to 1,000', '₹120 per account per month'],
  ['Above 1,000', '₹89 per account per month'],
];

function Landing() {
  return (
    <SiteShell>
      <div className="stack">
        <h1>AI learning platform for coaching institutes</h1>
        <p className="lede">
          Notes, doubts, tests and ranks in one place, under your coaching’s own address. Start with a free 7-day pilot.
        </p>
        <p>
          <a className="button primary" href="mailto:support@examedgeai.in?subject=Book%20a%20demo">
            Book a demo
          </a>
        </p>
      </div>
      <section className="stack" aria-labelledby="features">
        <h2 id="features">What you get</h2>
        <ul className="stack">
          {FEATURES.map(([t, d]) => (
            <li key={t}>
              <b>{t}.</b> {d}
            </li>
          ))}
        </ul>
      </section>
      <section className="stack" aria-labelledby="prices">
        <h2 id="prices">Pricing</h2>
        <p>
          You pay for every active account (students and teachers; the owner is free), in slabs like income tax. Minimum
          30 accounts. Pay for 11 months, get 12 on a yearly plan (from 50 accounts). GST extra when applicable.
        </p>
        <table>
          <caption className="sr-only">Price per account</caption>
          <tbody>
            {PRICES.map(([a, b]) => (
              <tr key={a}>
                <th scope="row">{a}</th>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">
          Pilot: 7 days free for up to 5 students, then read-only until you subscribe. Write to support@examedgeai.in.
        </p>
      </section>
    </SiteShell>
  );
}
