export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertLiveAi } = await import('@examedge/core/demo');
  assertLiveAi(process.env);
}
