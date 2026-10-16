// The only path to AI providers (ADR-009, AI_PIPELINE §2): reserve the worst-case cost (the database checks the kill
// switches, the institute budget and the student's daily limit atomically) → call the provider → settle the real cost.
import { cost, MODELS, type Model, type Usage } from './routing';

export type Outcome = 'ok' | 'error' | 'refused';

// Backed by ai_reserve/ai_settle (web, user's session) or ai_reserve_job/ai_settle_job (worker, job tenant context).
export interface Meter {
  reserve(
    feature: string,
    provider: string,
    model: string,
    microUsd: number,
  ): Promise<{ id: string; blocked: string | null }>;
  settle(id: string, usage: Usage, microUsd: number, outcome: Outcome): Promise<void>;
}

// reason: 'quota' (student daily limit) | 'budget' (institute month) | 'ai_disabled' (a kill switch).
export class AiBlocked extends Error {
  constructor(readonly reason: string) {
    super(`ai_blocked: ${reason}`);
  }
}

export async function metered<T>(
  meter: Meter,
  call: { feature: string; model: Model; worstCase: Usage },
  run: (recordId: string) => Promise<{ value: T; usage: Usage; outcome?: Outcome }>,
) {
  const { provider } = MODELS[call.model];
  const r = await meter.reserve(call.feature, provider, call.model, cost(call.model, call.worstCase));
  if (r.blocked) throw new AiBlocked(r.blocked);
  let out;
  try {
    out = await run(r.id);
  } catch (e) {
    await meter.settle(r.id, {}, 0, 'error');
    throw e;
  }
  await meter.settle(r.id, out.usage, cost(call.model, out.usage), out.outcome ?? 'ok');
  return out.value;
}
