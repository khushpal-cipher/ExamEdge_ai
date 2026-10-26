import Link from 'next/link';
import { LEGAL_DOCS } from './legal/docs';
import { ThemeToggle } from './theme-toggle';

// Header and footer of the public pages (home and legal), shown on the root host only.
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-head">
        <Link href="/" className="site-brand">
          ExamEdge AI
        </Link>
        <a href="mailto:support@examedgeai.in?subject=Book%20a%20demo">Book a demo</a>
        <ThemeToggle />
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-foot">
        <nav aria-label="Legal">
          {Object.entries(LEGAL_DOCS).map(([slug, d]) => (
            <Link key={slug} href={`/legal/${slug}`}>
              {d.title}
            </Link>
          ))}
        </nav>
        <p className="small muted">© ExamEdge AI</p>
      </footer>
    </>
  );
}
