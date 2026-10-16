// The gateway's meter in the user's own session (ADR-025): ai_reserve/ai_settle check the kill switches, the institute
// budget and the student's daily limit in the database.
import type { Meter } from '@examedge/core/ai/gateway';
import type { supabase } from './supabase';

type Db = Awaited<ReturnType<typeof supabase>>;

export const webMeter = (db: Db, inst: string): Meter => ({
  reserve: async (feat, prov, mdl, reserve) => {
    const { data, error } = await db.rpc('ai_reserve', { inst, feat, prov, mdl, reserve }).single();
    if (error) throw error;
    const r = data as { record_id: string; blocked: string | null };
    return { id: r.record_id, blocked: r.blocked };
  },
  settle: async (rid, usage, cost, result) => {
    const { error } = await db.rpc('ai_settle', { inst, rid, usage, cost, result });
    if (error) throw error;
  },
});
