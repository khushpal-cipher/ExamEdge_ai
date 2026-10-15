import { demoLoginAllowed } from '@examedge/core/demo';
import { signInDemo } from './actions';

export function SignIn({ next = '/', failed = false }: { next?: string; failed?: boolean }) {
  return (
    <section aria-labelledby="sign-in">
      <h2 id="sign-in">Sign in</h2>
      <button type="button" disabled>
        Continue with Google (not configured yet)
      </button>
      {demoLoginAllowed(process.env) && (
        <form action={signInDemo}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">Demo user email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <button type="submit">Sign in as demo user</button>
        </form>
      )}
      {failed && <p role="alert">Sign-in failed. Check the email address.</p>}
    </section>
  );
}
