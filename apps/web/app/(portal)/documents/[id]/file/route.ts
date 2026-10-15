import { supabase } from '@/lib/supabase';
import { currentInstitute, currentMember, isUuid } from '@/lib/tenant';

const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'private, no-store' } });

// Opens the current file of a document through a 5-minute signed URL (TH-07). The URL is minted with the user's own
// session, so the storage policy decides: staff of the institute, or students the notes are published to.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [institute, member] = await Promise.all([currentInstitute(), currentMember()]);
  if (!institute || institute.status === 'suspended' || !member?.role || !isUuid(id)) return notFound();
  const db = await supabase();
  const { data: doc } = await db
    .from('documents')
    .select('current_version_id')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc?.current_version_id) return notFound();
  const { data, error } = await db.storage
    .from('documents')
    .createSignedUrl(`${institute.id}/${id}/${doc.current_version_id}`, 300);
  if (error) return notFound();
  return new Response(null, {
    status: 303,
    headers: { location: data.signedUrl, 'cache-control': 'private, no-store' },
  });
}
