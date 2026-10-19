import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Content, SourceRef } from '@examedge/core/ai/studio';
import { formatTime } from '@/lib/assess';
import { Markdown, MathText } from '@/lib/markdown';
import { BETA_KINDS, fieldLabel, STUDIO_KIND, textFields } from '@/lib/studio';
import { isUuid, requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { deleteArtifact, editArtifact, publishArtifact, withdrawArtifact } from '../actions';
import { Quiz } from './quiz';
import { Speaker } from './speaker';

type Row = {
  id: string;
  owner_scope: 'institute' | 'student';
  kind: keyof typeof STUDIO_KIND;
  subject_id: string;
  chapter_id: string;
  source_refs: SourceRef[];
  content: unknown;
  status: string;
  created_at: string;
  chapters: { name: string; subjects: { name: string } };
};

const STATUS: Record<string, [string, string]> = {
  draft: ['Draft — students cannot see it', 'warn'],
  published: ['Published', 'good'],
  withdrawn: ['Withdrawn', 'bad'],
};

// Where a part came from: chips to the cited note pages (one per document page).
function Cites({ refs, cites }: { refs: SourceRef[]; cites: number[] }) {
  const seen = new Set<string>();
  return (
    <p className="small answer-part">
      {cites.flatMap((i) => {
        const r = refs[i];
        const key = r && `${r.document_id}#${r.page_start}`;
        if (!r || seen.has(key!)) return [];
        seen.add(key!);
        return [
          <a
            key={key}
            className="badge good"
            href={`/documents/${r.document_id}/file#page=${r.page_start}`}
            target="_blank"
            rel="noopener"
          >
            From your institute&apos;s notes: {r.title}, p.{r.page_start}
          </a>,
        ];
      })}
    </p>
  );
}

export default async function StudioArtifact(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { institute, member, db } = await requireMember();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  // RLS: the student who made it, staff (institute artifacts), or students of a batch it is published to.
  const { data } = await db
    .from('generated_artifacts')
    .select(
      'id, owner_scope, kind, subject_id, chapter_id, source_refs, content, status, created_at, chapters(name, subjects(name))',
    )
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as unknown as Row;
  const student = member.role === 'student';
  const staff = !student && a.owner_scope === 'institute';
  const refs = a.source_refs;

  let batches: { id: string; name: string }[] = [];
  let chosen = new Set<string>();
  if (staff) {
    const [{ data: audience }, { data: studying }, { data: mine }] = await Promise.all([
      db.from('artifact_audience').select('batch_id').eq('institute_id', institute.id).eq('artifact_id', id),
      // Published to the subject's own batch only (ADR-038; a trigger enforces it).
      db
        .from('subjects')
        .select('batches(id, name, archived_at)')
        .eq('institute_id', institute.id)
        .eq('id', a.subject_id),
      // Teachers may publish only to batches they teach (the database enforces it too).
      member.role === 'teacher'
        ? db.from('batch_members').select('batch_id').eq('membership_id', member.id).eq('batch_role', 'teacher')
        : Promise.resolve({ data: null }),
    ]);
    const taught = mine ? new Set(mine.map((r) => r.batch_id as string)) : null;
    batches = (studying ?? [])
      .map((r) => r.batches as unknown as { id: string; name: string; archived_at: string | null })
      .filter((b) => b && !b.archived_at && (!taught || taught.has(b.id)))
      .sort((x, y) => x.name.localeCompare(y.name));
    chosen = new Set((audience ?? []).map((r) => r.batch_id as string));
  }
  const { data: tries } =
    student && a.kind === 'quiz'
      ? await db
          .from('practice_attempts')
          .select('id, score, max_score, completed_at')
          .eq('institute_id', institute.id)
          .eq('artifact_id', id)
          .order('completed_at', { ascending: false })
          .limit(10)
      : { data: [] };

  const title = `${STUDIO_KIND[a.kind]}: ${a.chapters.name}`;
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/topics/${a.chapter_id}`}>
              {a.chapters.subjects.name} · {a.chapters.name}
            </Link>
          </p>
          <h1>
            {title}
            {BETA_KINDS.has(a.kind) && <span className="badge"> Beta</span>}
          </h1>
          {BETA_KINDS.has(a.kind) && (
            <p className="small muted">Beta: read aloud by your device&apos;s voice, so it may sound robotic.</p>
          )}
          <p className="muted small">
            {refs.length
              ? "Made by AI from your institute's notes"
              : 'Made by AI from general knowledge (this topic had no notes yet)'}{' '}
            on {formatTime(a.created_at)}.{' '}
            {a.owner_scope === 'student'
              ? 'Only you can see it.'
              : student
                ? 'Checked and shared by your teachers.'
                : 'Check it before publishing.'}
          </p>
          {staff && <span className={`badge ${STATUS[a.status]![1]}`}>{STATUS[a.status]![0]}</span>}
          {!refs.length && (
            <span className="badge warn">General explanation, not from your institute&apos;s notes</span>
          )}{' '}
          {a.kind === 'quiz' && a.owner_scope === 'student' && (
            <span className="badge warn">AI practice, unverified</span>
          )}
        </div>
      </div>
      <Flash searchParams={props.searchParams} />

      <section className="card stack" aria-label={title}>
        {a.kind === 'summary' &&
          (a.content as Content<'summary'>).sections.map((s, i) => (
            <div key={i} className="stack">
              <h2>{s.heading}</h2>
              <Markdown text={s.body} />
              <Cites refs={refs} cites={s.cites} />
            </div>
          ))}
        {a.kind === 'flashcards' && (
          <>
            <p className="small muted">Tap a card to see the answer.</p>
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Flashcards">
              {(a.content as Content<'flashcards'>).cards.map((c, i) => (
                <li key={i}>
                  <details className="card">
                    <summary>{c.front}</summary>
                    <Markdown text={c.back} />
                    <Cites refs={refs} cites={c.cites} />
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
        {a.kind === 'audio_overview' && (
          <>
            <Speaker
              label="Audio overview player"
              parts={(a.content as Content<'audio_overview'>).parts.map((p) => `${p.heading}. ${p.script}`)}
            />
            <p className="small muted">Read aloud by your device&apos;s voice. The script is below.</p>
            {(a.content as Content<'audio_overview'>).parts.map((p, i) => (
              <div key={i} id={`part-${i}`} className="stack part">
                <h2>{p.heading}</h2>
                <Markdown text={p.script} />
                <Cites refs={refs} cites={p.cites} />
              </div>
            ))}
          </>
        )}
        {a.kind === 'video_overview' && (
          <>
            <Speaker
              label="Video overview player"
              parts={(a.content as Content<'video_overview'>).slides.map((p) => `${p.title}. ${p.narration}`)}
            />
            <p className="small muted">Each slide is read aloud by your device&apos;s voice.</p>
            <ol className="slides">
              {(a.content as Content<'video_overview'>).slides.map((p, i) => (
                <li key={i} id={`part-${i}`} className="slide part">
                  <span className="small muted">
                    Slide {i + 1} of {(a.content as Content<'video_overview'>).slides.length}
                  </span>
                  <h2>{p.title}</h2>
                  {p.points.length > 0 && (
                    <ul>
                      {p.points.map((t, j) => (
                        <li key={j}>
                          <Markdown text={t} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <details>
                    <summary className="small">Narration</summary>
                    <Markdown text={p.narration} />
                  </details>
                  <Cites refs={refs} cites={p.cites} />
                </li>
              ))}
            </ol>
          </>
        )}
        {a.kind === 'mind_map' && <MindMap map={a.content as Content<'mind_map'>} refs={refs} />}
        {a.kind === 'quiz' &&
          (student ? (
            <Quiz
              artifactId={a.id}
              questions={(a.content as Content<'quiz'>).questions.map((q) => ({
                id: q.id,
                stem: q.stem,
                options: q.options,
              }))}
            />
          ) : (
            <ol className="stack">
              {(a.content as Content<'quiz'>).questions.map((q) => (
                <li key={q.id} className="stack">
                  <Markdown text={q.stem} />
                  <ul>
                    {q.options.map((o) => (
                      <li key={o.id}>
                        <MathText text={o.text} /> {o.id === q.answer && <span className="badge good">Correct</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="small muted">{q.explanation}</p>
                  <Cites refs={refs} cites={q.cites} />
                </li>
              ))}
            </ol>
          ))}
      </section>

      {student && a.kind === 'quiz' && (tries ?? []).length > 0 && (
        <section className="card stack" aria-labelledby="tries">
          <h2 id="tries">Your tries</h2>
          <ul>
            {tries!.map((t) => (
              <li key={t.id}>
                {t.score}/{t.max_score} on {formatTime(t.completed_at)}
              </li>
            ))}
          </ul>
          <p className="small muted">Practice quizzes never affect your rank.</p>
        </section>
      )}

      {staff && (
        <>
          <section className="card stack" aria-labelledby="publish">
            <h2 id="publish">Approve and publish</h2>
            {batches.length === 0 ? (
              <p className="empty">No batch you can publish to studies this subject.</p>
            ) : (
              <form action={publishArtifact} className="stack">
                <input type="hidden" name="artifact_id" value={a.id} />
                <fieldset>
                  <legend>Batches that see it</legend>
                  {batches.map((b) => (
                    <label key={b.id} className="small" style={{ display: 'block' }}>
                      <input type="checkbox" name="batch_id" value={b.id} defaultChecked={chosen.has(b.id)} /> {b.name}
                    </label>
                  ))}
                </fieldset>
                <button type="submit">{a.status === 'published' ? 'Update batches' : 'Approve and publish'}</button>
              </form>
            )}
            {a.status === 'published' && (
              <form action={withdrawArtifact}>
                <input type="hidden" name="artifact_id" value={a.id} />
                <button type="submit" className="danger">
                  Withdraw
                </button>
              </form>
            )}
          </section>
          <details className="card">
            <summary>Edit text</summary>
            <form action={editArtifact} className="stack">
              <input type="hidden" name="artifact_id" value={a.id} />
              {textFields(a.content).map(([path, value]) => (
                <label key={path} className="stack small">
                  {fieldLabel(path)}
                  <textarea name={path} defaultValue={value} rows={Math.min(6, Math.ceil(value.length / 70))} />
                </label>
              ))}
              <p className="small muted">Saving an edit makes it a draft again until you publish it.</p>
              <button type="submit">Save changes</button>
            </form>
          </details>
        </>
      )}
      {(staff || a.owner_scope === 'student') && (
        <form action={deleteArtifact}>
          <input type="hidden" name="artifact_id" value={a.id} />
          <button type="submit" className="link danger">
            Delete
          </button>
        </form>
      )}
    </>
  );
}

// Nested tree (no mind-map library: depth ≤ 4, ≤ 60 nodes).
function MindMap({ map, refs }: { map: Content<'mind_map'>; refs: SourceRef[] }) {
  return (
    <div className="mindmap">
      <p>
        <b>{map.root}</b>
      </p>
      <ul>
        {map.branches.map((b, i) => (
          <li key={i}>
            <b>{b.label}</b>
            <Cites refs={refs} cites={b.cites} />
            <ul>
              {b.children.map((c, j) => (
                <li key={j}>
                  {c.label}
                  {c.children.length > 0 && (
                    <ul>
                      {c.children.map((l, k) => (
                        <li key={k} className="small muted">
                          {l.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
