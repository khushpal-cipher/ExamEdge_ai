// Whether Google sign-in is switched on in Supabase Auth (cached for 5 minutes). Off → the button stays disabled.
export async function googleEnabled() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 300 },
    });
    return res.ok && (await res.json()).external?.google === true;
  } catch {
    return false;
  }
}
