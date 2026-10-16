// Real tutor provider: Claude through the official SDK (ADR-008). Used only when AI_PROVIDER=anthropic and
// ANTHROPIC_API_KEY is set — BLOCKED until the founder creates a key; tested against a recorded stream (claude.test.ts).
// Passages go in as search_result blocks with citations on, so every citation names the passage it came from.
import Anthropic from '@anthropic-ai/sdk';
import type { Generation, TutorInput, TutorProvider } from './tutor';

type ClaudeModel = 'claude-haiku-5-5' | 'claude-sonnet-5-5';

export function claudeTutor(model: ClaudeModel, client = new Anthropic({ maxRetries: 1 })): TutorProvider {
  const premium = model === 'claude-sonnet-5-5';
  const maxOutput = premium ? 8_192 : 4_096;
  return {
    model,
    maxOutput,
    async generate({ system, question, history, passages }: TutorInput, onText): Promise<Generation> {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: maxOutput,
        system,
        output_config: { effort: premium ? 'medium' : 'low' },
        // Sonnet can hand a declined request to its server-defined fallback; Haiku has none (AI_PIPELINE §1).
        ...(premium ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        messages: [
          ...history.map((t) => ({ role: t.role, content: t.content })),
          {
            role: 'user',
            content: [
              ...passages.map((p) => ({
                type: 'search_result' as const,
                source: `inst:${p.document_id}#p${p.page_start}`,
                title: `Your notes: ${p.title}, p.${p.page_start}`,
                content: [{ type: 'text' as const, text: p.content }],
                citations: { enabled: true },
              })),
              { type: 'text' as const, text: question },
            ],
          },
        ],
      });
      stream.on('text', onText);
      const msg = await stream.finalMessage();
      return {
        refused: msg.stop_reason === 'refusal',
        model: msg.model,
        usage: {
          input_tokens: msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens,
          cache_read_tokens: msg.usage.cache_read_input_tokens ?? 0,
          cache_write_tokens: msg.usage.cache_creation_input_tokens ?? 0,
        },
        segments: msg.content.flatMap((b) =>
          b.type === 'text'
            ? [
                {
                  text: b.text,
                  cites: (b.citations ?? []).flatMap((c) =>
                    c.type === 'search_result_location'
                      ? [{ passage: c.search_result_index, cited_text: c.cited_text }]
                      : [],
                  ),
                },
              ]
            : [],
        ),
      };
    },
  };
}
