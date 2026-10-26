import { ThemeToggle } from '../../theme-toggle';
import { notFound } from 'next/navigation';
import { currentInstitute, currentMember } from '@/lib/tenant';
import { acceptInvite, signOut } from '../../actions';
import { SignIn } from '../../sign-in';

const MESSAGES: Record<string, string> = {
  invitation_invalid: 'This invitation link is not valid.',
  invitation_not_usable: 'This invitation has expired, was revoked or was already used.',
  email_mismatch: 'You are signed in with a different email address than the one invited.',
  already_member: 'You are already a member of this institute.',
  seats_full: 'This institute has no free seats right now. Ask the person who invited you.',
  read_only: "This institute's free pilot has ended, so nobody new can join. Ask the person who invited you.",
  failed: 'Something went wrong. Please try again.',
};

export default async function Invite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const institute = await currentInstitute();
  if (!institute) notFound();
  const { token } = await params;
  const { error } = await searchParams;
  const member = await currentMember();
  const self = `/invite/${encodeURIComponent(token)}`;
  return (
    <main className="center">
      <ThemeToggle corner />
      <div>
        <h1>Join {institute.name}</h1>
        <p className="lede">Sign in with the email address your institute invited.</p>
      </div>
      <div className="stack">
        {error && MESSAGES[error] && (
          <p role="alert" className="alert">
            {MESSAGES[error]}
          </p>
        )}
        {!member ? (
          <SignIn next={self} failed={error === 'signin'} />
        ) : (
          <>
            <form action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="primary">
                Accept invitation
              </button>
            </form>
            <form action={signOut}>
              <button type="submit">Use a different account</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
