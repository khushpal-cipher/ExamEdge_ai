import { describe, expect, it, vi } from 'vitest';
import { log, scrub } from './log';

describe('scrub', () => {
  it('drops sensitive keys and masks emails anywhere', () => {
    expect(
      scrub({ request_id: 'r1', email: 'a@b.com', nested: { full_name: 'Riya', note: 'mail x.y@school.in now' } }),
    ).toEqual({ request_id: 'r1', email: '[redacted]', nested: { full_name: '[redacted]', note: 'mail [email] now' } });
  });

  it('serialises errors without stack traces', () => {
    expect(scrub(new Error('bad a@b.co'))).toEqual({ error: 'Error', message: 'bad [email]' });
  });
});

describe('log', () => {
  it('writes one JSON line with request_id and no prompt text', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('tutor.answer', { request_id: 'abc', prompt: 'secret question' });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ level: 'info', msg: 'tutor.answer', request_id: 'abc', prompt: '[redacted]' });
    spy.mockRestore();
  });
});
