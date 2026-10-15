import { notFound } from 'next/navigation';
import { currentHost, currentInstitute, currentMember, isRootHost } from '@/lib/tenant';
import { signOut } from './actions';
import { SignIn } from './sign-in';

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const institute = await currentInstitute();
  if (!institute) {
    if (!isRootHost(await currentHost())) notFound();
    return (
      <main>
        <h1>ExamEdge AI</h1>
        <p>AI learning platform for coaching institutes.</p>
      </main>
    );
  }
  if (institute.status === 'suspended') {
    return (
      <main>
        <h1>{institute.name}</h1>
        <p>This institute is currently suspended.</p>
      </main>
    );
  }
  const member = await currentMember();
  return (
    <main>
      <h1>{institute.name}</h1>
      {!member && <SignIn failed={(await searchParams).error === 'signin'} />}
      {member && !member.role && <p>You are not a member of this institute.</p>}
      {member?.role && <p>Signed in as {member.role}.</p>}
      {member && (
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      )}
    </main>
  );
}
