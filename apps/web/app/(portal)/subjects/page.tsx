import Link from 'next/link';
import { MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { addChapter, createSubject, deleteChapter, moveChapter, renameChapter, setSubjectLibrary } from '../actions';
import { Flash, type Search } from '../flash';

type Chapter = { id: string; name: string; position: number };

export default async function Subjects({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const manager = MANAGERS.includes(member.role);
  const [{ data: subjects }, { data: library }] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, library_subject_id, chapters(id, name, position)')
      .eq('institute_id', institute.id)
      .order('name'),
    db.from('library_subjects').select('id, name, exams(name)').order('name'),
  ]);
  const libraryName = new Map(
    (library ?? []).map((l) => [l.id as string, `${(l.exams as unknown as { name: string }).name} · ${l.name}`]),
  );
  return (
    <>
      <div className="top">
        <div>
          <h1>Subjects</h1>
          <p className="muted">Subjects and their chapters. Assign subjects to batches on each batch page.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {manager && (
        <section className="card stack" aria-labelledby="new-subject">
          <h2 id="new-subject">New subject</h2>
          <form action={createSubject} className="inline">
            <label>
              Name
              <input name="name" required maxLength={120} placeholder="Physics" />
            </label>
            <button type="submit" className="primary">
              Create subject
            </button>
          </form>
        </section>
      )}
      {!subjects?.length && <p className="empty">No subjects yet.</p>}
      {(subjects ?? []).map((s) => {
        const chapters = [...((s.chapters ?? []) as Chapter[])].sort((a, b) => a.position - b.position);
        return (
          <section key={s.id} className="card stack" aria-labelledby={`s-${s.id}`}>
            <div className="top">
              <h2 id={`s-${s.id}`}>{s.name}</h2>
              <Link href={`/subjects/${s.id}`}>Open subject</Link>
            </div>
            {manager ? (
              <form action={setSubjectLibrary} className="inline">
                <input type="hidden" name="subject_id" value={s.id} />
                <label>
                  ExamEdge library
                  <select name="library_subject_id" defaultValue={s.library_subject_id ?? ''}>
                    <option value="">None</option>
                    {[...libraryName].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Save</button>
              </form>
            ) : (
              <p className="small muted">
                ExamEdge library: {s.library_subject_id ? libraryName.get(s.library_subject_id) : 'none'}
              </p>
            )}
            {chapters.length === 0 ? (
              <p className="empty">No chapters yet.</p>
            ) : (
              <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
                {chapters.map((c, i) => (
                  <li key={c.id}>
                    <div className="row">
                      <form action={renameChapter} className="row">
                        <input type="hidden" name="chapter_id" value={c.id} />
                        <label className="sr-only" htmlFor={`c-${c.id}`}>
                          Chapter name
                        </label>
                        <input id={`c-${c.id}`} name="name" defaultValue={c.name} required maxLength={200} />
                        <button type="submit">Rename</button>
                      </form>
                      <form action={moveChapter}>
                        <input type="hidden" name="chapter_id" value={c.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button type="submit" disabled={i === 0} aria-label={`Move ${c.name} up`}>
                          ↑
                        </button>
                      </form>
                      <form action={moveChapter}>
                        <input type="hidden" name="chapter_id" value={c.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button type="submit" disabled={i === chapters.length - 1} aria-label={`Move ${c.name} down`}>
                          ↓
                        </button>
                      </form>
                      <form action={deleteChapter}>
                        <input type="hidden" name="chapter_id" value={c.id} />
                        <button type="submit" className="link" aria-label={`Delete ${c.name}`}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <form action={addChapter} className="inline">
              <input type="hidden" name="subject_id" value={s.id} />
              <label>
                New chapter
                <input name="name" required maxLength={200} placeholder="Rotational Motion" />
              </label>
              <button type="submit">Add chapter</button>
            </form>
          </section>
        );
      })}
    </>
  );
}
