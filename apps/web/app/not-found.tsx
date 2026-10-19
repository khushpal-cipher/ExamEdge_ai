import Link from 'next/link';

// Own 404 so it uses the app's fonts and colours instead of Next's default white page.
export default function NotFound() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p className="muted">This page does not exist, or you do not have access to it.</p>
      <p>
        <Link href="/">Go to the start page</Link>
      </p>
    </div>
  );
}
