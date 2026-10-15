import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { QuestionForm, type QuestionInit } from '../question-form';

export default async function EditQuestion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { institute, db } = await requireMember(STAFF);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data: q }, { data: subjects }] = await Promise.all([
    db
      .from('questions')
      .select(
        'id, subject_id, chapter_id, type, stem, options, explanation, difficulty, question_keys(key), test_questions(test_id)',
      )
      .eq('institute_id', institute.id)
      .eq('id', id)
      .maybeSingle(),
    db.from('subjects').select('id, name, chapters(id, name, position)').eq('institute_id', institute.id).order('name'),
  ]);
  if (!q) notFound();
  const initial = {
    ...q,
    key: (q.question_keys as unknown as { key: QuestionInit['key'] } | null)?.key ?? null,
  } as QuestionInit;
  const used = (q.test_questions as unknown[]).length;
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/questions?subject=${q.subject_id}`}>Question bank</Link>
          </p>
          <h1>Edit question</h1>
          {used > 0 && (
            <p className="muted">
              Used in {used} test{used > 1 ? 's' : ''}. Once a test is scheduled, only the answer key and explanation
              can change; after results are released, use <b>Recalculate results</b> on the test.
            </p>
          )}
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <section className="card">
        <QuestionForm
          subjects={(subjects ?? []).map((s) => ({
            ...s,
            chapters: [...(s.chapters ?? [])].sort((a, b) => a.position - b.position),
          }))}
          initial={initial}
        />
      </section>
    </>
  );
}
