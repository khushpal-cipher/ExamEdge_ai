import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteShell } from '../../site-shell';
import { LEGAL_DOCS } from '../docs';

export const generateStaticParams = () => Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));

export async function generateMetadata(props: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const d = LEGAL_DOCS[(await props.params).doc];
  return d ? { title: d.title, description: d.description, robots: { index: true, follow: true } } : {};
}

export default async function LegalPage(props: { params: Promise<{ doc: string }> }) {
  const d = LEGAL_DOCS[(await props.params).doc];
  if (!d) notFound();
  return (
    <SiteShell>
      <article className="stack">
        <h1>{d.title}</h1>
        {d.sections.map(([heading, paragraphs]) => (
          <section key={heading} className="stack">
            <h2>{heading}</h2>
            {paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </SiteShell>
  );
}
