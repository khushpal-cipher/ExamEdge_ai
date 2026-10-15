import { demoLoginAllowed } from '@examedge/core/demo';
import { signInDemo } from './actions';

export function SignIn({ next = '/', failed = false }: { next?: string; failed?: boolean }) {
  return (
    <section aria-labelledby="sign-in" className="card stack">
      <h2 id="sign-in">Sign in</h2>
      <button type="button" disabled>
        Continue with Google (not configured yet)
      </button>
      {demoLoginAllowed(process.env) && (
        <form action={signInDemo} className="stack">
          <input type="hidden" name="next" value={next} />
          <label>
            Demo user email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button type="submit" className="primary">
            Sign in as demo user
          </button>
        </form>
      )}
      {failed && (
        <p role="alert" className="alert">
          Sign-in failed. Check the email address.
        </p>
      )}
    </section>
  );
}
