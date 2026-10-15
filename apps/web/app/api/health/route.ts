export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? 'dev' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
