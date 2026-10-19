import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STUDIO_KIND } from '@/lib/studio';
import { isUuid, opensBatch, requireMember } from '@/lib/tenant';
import { addSubtopic, deleteSubtopic, renameSubtopic } from '../../actions';
import { Flash, type Search } from '../../flash';
import { writeAiNotes } from '../../documents/actions';
import { DOCUMENT_STATUS, VERSION_STATUS } from '../../documents/status';
import { Upload } from '../../documents/upload';
import { generate } from '../../studio/actions';
import { Tutor, type ChatMessage } from '../../subjects/[id]/tutor';
import { Tabs } from './tabs';

type Doc = { id: string; title: string; status: string; subtopic_id: string; kind: string };
type Artifact = { id: string; owner_scope: string; kind: string; status: string };
type Subtopic = { id: string; name: string; position: number };
// Smart Study tile icons (24×24 outline paths), NotebookLM Studio style (ADR-043).
const ICON: Record<string, string> = {
  summary: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  flashcards: 'M4 7h12v12H4zM8 7V4h12v12h-4',
  mind_map:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4h2v2H4zM18 4h2v2h-2zM4 18h2v2H4zM18 18h2v2h-2zM6 6l4 4M18 6l-4 4M6 18l4-4M18 18l-4-4',
  quiz: 'M4 4h16v16H4zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01',
  audio_overview: 'M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2',
  video_overview: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
};

// The topic page (ADR-038): Subtopics (notes, uploaded or written with AI inside a subtopic) | Smart Study (students:
// the AI over the whole topic). Staff make tests on the Tests page (ADR-042).
export default async function TopicPage(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const m = await requireMember();
  const { institute, member, db } = m;
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  // RLS: a topic is visible only if its subject is (students: subjects of their current or past batches).
  const { data: topic } = await db
    .from('chapters')
    .select('id, name, subject_id, subjects(name, batch_id), subtopics(id, name, position)')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  const subject = topic?.subjects as unknown as { name: string; batch_id: string } | undefined;
  if (!topic || !subject || !(await opensBatch(m, subject.batch_id))) notFound();
  const subtopics = [...(topic.subtopics as Subtopic[])].sort((a, b) => a.position - b.position);
  const student = member.role === 'student';

  // RLS: staff see every document; students only notes published to their batches.
  const [{ data: docRows }, { data: chat }, { data: artifactRows }] = await Promise.all([
    db
      .from('documents')
      .select('id, title, status, subtopic_id, kind')
      .eq('institute_id', institute.id)
      .eq('chapter_id', id)
      .is('deleted_at', null)
      .order('title'),
    // RLS: a chat is readable by its owner only. Staff have no Smart Study (ADR-039).
    !student
      ? Promise.resolve({ data: null })
      : db
          .from('conversations')
          .select('id, messages(id, role, content, citations, answer_labels, feedback, created_at)')
          .eq('institute_id', institute.id)
          .eq('chapter_id', id)
          .eq('user_id', member.userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
    // RLS: students see their own artifacts and those published to their batches.
    !student
      ? Promise.resolve({ data: null })
      : db
          .from('generated_artifacts')
          .select('id, owner_scope, kind, status')
          .eq('institute_id', institute.id)
          .eq('chapter_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
  ]);
  const docs = (docRows ?? []) as Doc[];
  // Staff also see the latest file's processing state.
  const latest = new Map<string, string>();
  if (!student && docs.length) {
    const { data: versions } = await db
      .from('document_versions')
      .select('document_id, version, processing_status')
      .eq('institute_id', institute.id)
      .in(
        'document_id',
        docs.map((d) => d.id),
      )
      .order('version');
    for (const v of versions ?? []) latest.set(v.document_id as string, v.processing_status as string);
  }
  const messages = ((chat?.messages ?? []) as (ChatMessage & { created_at: string })[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const artifacts = (artifactRows ?? []) as Artifact[];
  const artifactList = (label: string, list: Artifact[]) =>
    list.length > 0 && (
      <>
        <h3>{label}</h3>
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={label}>
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/studio/${a.id}`}>
                {STUDIO_KIND[a.kind]}: {topic.name}
              </Link>
            </li>
          ))}
        </ul>
      </>
    );

  const docItem = (d: Doc) => {
    if (student)
      return (
        <li key={d.id}>
          {d.kind === 'ai_notes' ? (
            <Link href={`/notes/${d.id}`}>{d.title}</Link>
          ) : (
            <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener">
              {d.title}
            </a>
          )}
        </li>
      );
    const processing = latest.get(d.id);
    const [label, tone] =
      processing && processing !== 'ready' ? VERSION_STATUS[processing]! : DOCUMENT_STATUS[d.status]!;
    return (
      <li key={d.id}>
        <Link href={`/documents/${d.id}`}>{d.title}</Link> <span className={`badge ${tone}`}>{label}</span>
      </li>
    );
  };

  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/subjects/${topic.subject_id}`}>{subject.name}</Link>
          </p>
          <h1>{topic.name}</h1>
          <p className="muted">
            {subtopics.length} subtopic{subtopics.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      <Tabs
        tabs={[
          {
            key: 'subtopics',
            label: 'Subtopics',
            content: (
              <div className="stack">
                {subtopics.length === 0 && (
                  <p className="empty card">
                    {student
                      ? 'Your teachers have not added notes for this topic yet.'
                      : 'Add a subtopic to upload notes.'}
                  </p>
                )}
                {subtopics.map((s) => {
                  const notes = docs.filter((d) => d.subtopic_id === s.id);
                  return (
                    <section key={s.id} className="card stack" aria-labelledby={`st-${s.id}`}>
                      <h2 id={`st-${s.id}`}>{s.name}</h2>
                      {notes.length === 0 ? (
                        <p className="empty small">{student ? 'No notes yet.' : 'No notes uploaded yet.'}</p>
                      ) : (
                        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Notes">
                          {notes.map(docItem)}
                        </ul>
                      )}
                      {!student && (
                        <>
                          <details>
                            <summary className="button primary">Upload notes</summary>
                            <Upload subjectId={topic.subject_id} chapterId={topic.id} subtopicId={s.id} />
                          </details>
                          <details>
                            <summary className="button">Write notes with AI</summary>
                            <form action={writeAiNotes} className="stack" aria-label={`Write notes with AI: ${s.name}`}>
                              <input type="hidden" name="chapter_id" value={topic.id} />
                              <input type="hidden" name="subtopic_id" value={s.id} />
                              <label className="stack">
                                Title
                                <input name="title" required maxLength={200} defaultValue={`AI notes: ${s.name}`} />
                              </label>
                              <label className="stack">
                                Explain this subtopic in your own words
                                <textarea name="explanation" required maxLength={5000} rows={6} />
                              </label>
                              <button type="submit" className="primary">
                                Write notes
                              </button>
                              <p className="small muted">
                                The AI writes detailed notes from your explanation. They stay a draft: you read and edit
                                them, then publish them to the batch like uploaded notes.
                              </p>
                            </form>
                          </details>
                          <div className="row small">
                            <form action={renameSubtopic} className="row">
                              <input type="hidden" name="chapter_id" value={topic.id} />
                              <input type="hidden" name="subtopic_id" value={s.id} />
                              <label className="sr-only" htmlFor={`s-${s.id}`}>
                                Subtopic name
                              </label>
                              <input id={`s-${s.id}`} name="name" defaultValue={s.name} required maxLength={200} />
                              <button type="submit">Rename</button>
                            </form>
                            <form action={deleteSubtopic}>
                              <input type="hidden" name="chapter_id" value={topic.id} />
                              <input type="hidden" name="subtopic_id" value={s.id} />
                              <button type="submit" className="link danger" aria-label={`Delete ${s.name}`}>
                                Delete
                              </button>
                            </form>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })}
                {!student && (
                  <form action={addSubtopic} className="inline card">
                    <input type="hidden" name="subject_id" value={topic.subject_id} />
                    <input type="hidden" name="chapter_id" value={topic.id} />
                    <label>
                      New subtopic
                      <input name="name" required maxLength={200} placeholder="Bayes theorem" />
                    </label>
                    <button type="submit">Add subtopic</button>
                  </form>
                )}
              </div>
            ),
          },
          // Students: Smart Study. Staff make tests on the Tests page (ADR-042).
          ...(student
            ? [
                {
                  key: 'study',
                  label: 'Smart Study',
                  content: (
                    <div className="study">
                      <section className="card stack">
                        <Tutor
                          key={chat?.id ?? 'new'}
                          subjectId={topic.subject_id}
                          topicId={topic.id}
                          topicName={topic.name}
                          conversationId={chat?.id ?? null}
                          messages={messages}
                        />
                      </section>
                      <section className="card stack" aria-labelledby="tools">
                        <h2 id="tools">Study tools</h2>
                        <form action={generate} className="tiles" aria-label="Make study material">
                          <input type="hidden" name="subject_id" value={topic.subject_id} />
                          <input type="hidden" name="chapter_id" value={topic.id} />
                          {Object.entries(STUDIO_KIND).map(([k, label]) => (
                            <button key={k} type="submit" name="kind" value={k} className="tile">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d={ICON[k]} />
                              </svg>
                              {label}
                            </button>
                          ))}
                        </form>
                        {artifactList(
                          'Made by you',
                          artifacts.filter((a) => a.owner_scope === 'student'),
                        )}
                        {artifactList(
                          'From your teachers',
                          artifacts.filter((a) => a.owner_scope === 'institute'),
                        )}
                        <p className="small muted">
                          Made by AI from your teachers&apos; notes for this topic, just for you; if there are no notes
                          yet, from general knowledge of the topic. Overviews are read aloud by your device&apos;s
                          voice. Practice quizzes never affect your rank.
                        </p>
                      </section>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
