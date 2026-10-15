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

export const FEATURE_LABEL: Record<string, string> = {
  tutor: 'AI tutor answers',
  tutor_premium: 'Step-by-step answers',
  query_embed: 'Tutor search',
  generation: 'Studio generation',
  ingest_ocr: 'Reading scanned pages',
  ingest_embed: 'Indexing notes',
};

export const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;

export async function monthUsage(db: Db, institute: string) {
  const { data, error } = await db.rpc('usage_summary', { inst: institute });
  if (error) throw error;
  const rows = (data ?? []) as UsageRow[];
  return { rows, spent: rows.reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0) };
}

// Highest alert level reached (AI_PIPELINE budget alerts 50/80/100 %); 0 = below half. A zero budget is used up.
export const budgetLevel = (spent: number, budget: number) =>
  ([100, 80, 50] as const).find((p) => spent * 100 >= p * budget) ?? 0;
