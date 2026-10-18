// This month's AI usage of one institute (India month). RLS decides who sees it: owner/admin and platform admins.
import type { supabase } from './supabase';

type Db = Awaited<ReturnType<typeof supabase>>;
export type UsageRow = {
  feature: string;
  calls: number;
  blocked: number;
  input_tokens: number;
  output_tokens: number;
  cost_micro_usd: number;
};

export const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;

export async function monthUsage(db: Db, institute: string) {
  const { data, error } = await db.rpc('usage_summary', { inst: institute });
  if (error) throw error;
  const rows = (data ?? []) as UsageRow[];
  return { rows, spent: rows.reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0) };
}
