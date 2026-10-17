import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STUDIO_KIND } from '@/lib/studio';
import { isUuid, opensBatch, requireMember } from '@/lib/tenant';
import { addSubtopic, deleteSubtopic, renameSubtopic } from '../../actions';
import { Flash, type Search } from '../../flash';
import { DOCUMENT_STATUS, VERSION_STATUS } from '../../documents/status';
import { Upload } from '../../documents/upload';
import { generate } from '../../studio/actions';
import { Tutor, type ChatMessage } from '../../subjects/[id]/tutor';
import { Tabs } from './tabs';

type Doc = { id: string; title: string; status: string; subtopic_id: string };
type Artifact = { id: string; owner_scope: string; kind: string; status: string };
type Subtopic = { id: string; name: string; position: number };

// The topic page (ADR-038): Subtopics (notes, uploaded inside a subtopic) | Smart Study (AI over the whole topic).
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
      .select('id, title, status, subtopic_id')
      .eq('institute_id', institute.id)
      .eq('chapter_id', id)
      .is('deleted_at', null)
      .order('title'),
    // RLS: a chat is readable by its owner only.
    db
      .from('conversations')
      .select('id, messages(id, role, content, citations, answer_labels, feedback, created_at)')
      .eq('institute_id', institute.id)
      .eq('chapter_id', id)
      .eq('user_id', member.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // RLS: students see their own artifacts and those published to their batches; staff see institute artifacts.
    db
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
              {!student && a.status !== 'published' && (
                <span className={`badge ${a.status === 'draft' ? 'warn' : 'bad'}`}>
                  {a.status === 'draft' ? 'Draft' : 'Withdrawn'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </>
    );

  const docItem = (d: Doc) => {
    if (student)
      return (
        <li key={d.id}>
          <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener">
            {d.title}
          </a>
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
          <p className="muted">{subtopics.length} subtopics</p>
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      <Tabs
        subtopics={
          <div className="stack">
            {subtopics.length === 0 && (
              <p className="empty card">
                {student ? 'Your teachers have not added notes for this topic yet.' : 'Add a subtopic to upload notes.'}
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
                          <button type="submit" className="link" aria-label={`Delete ${s.name}`}>
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
        }
        study={
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
              {student ? (
                <>
                  {artifactList(
                    'From your teachers',
                    artifacts.filter((a) => a.owner_scope === 'institute'),
                  )}
                  {artifactList(
                    'Made by you',
                    artifacts.filter((a) => a.owner_scope === 'student'),
                  )}
                </>
              ) : (
                artifactList('Study material', artifacts)
              )}
              <form action={generate} className="stack" aria-label="Make study material">
                <input type="hidden" name="subject_id" value={topic.subject_id} />
                <input type="hidden" name="chapter_id" value={topic.id} />
                <label className="stack small">
                  Make
                  <select name="kind">
                    {Object.entries(STUDIO_KIND).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Generate</button>
              </form>
              <p className="small muted">
                {student
                  ? "Made by AI from your teachers' notes for this topic, just for you. Practice quizzes never affect your rank."
                  : 'Made by AI from the published notes of this topic. Students see it only after you approve and publish it.'}
              </p>
            </section>
          </div>
        }
      />
    </>
  );
}
