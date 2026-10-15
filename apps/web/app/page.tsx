import { notFound, redirect } from 'next/navigation';
import { currentHost, currentInstitute, currentMember, isRootHost } from '@/lib/tenant';
import { signOut } from './actions';
import { SignIn } from './sign-in';

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const institute = await currentInstitute();
  if (!institute) {
    if (!isRootHost(await currentHost())) notFound();
    return (
      <main className="center">
        <h1>ExamEdge AI</h1>
        <p className="reading">AI learning platform for coaching institutes.</p>
      </main>
    );
  }
  if (institute.status === 'suspended') {
    return (
      <main className="center">
        <h1>{institute.name}</h1>
        <p>This institute is currently suspended.</p>
      </main>
    );
  }
  const member = await currentMember();
  if (member?.role) redirect(member.role === 'student' ? '/home' : '/dashboard');
  return (
    <main className="center">
      <h1>{institute.name}</h1>
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
