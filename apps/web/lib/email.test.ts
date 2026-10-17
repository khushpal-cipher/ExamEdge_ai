import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteEmail, sendInvites } from './email';

const inv = { email: 'riya@example.com', link: 'http://a.localhost:3000/invite/abc', role: 'student' };

describe('invitation email', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('escapes the institute name in HTML and names the role', () => {
    const m = inviteEmail('<b>X</b> & Co', { ...inv, role: 'admin' });
    expect(m.html).toContain('&#60;b&#62;X&#60;/b&#62; &#38; Co');
    expect(m.html).not.toContain('<b>X</b>');
    expect(m.text).toContain('as an admin');
    expect(m.to).toEqual(['riya@example.com']);
  });

  it('sends nothing without an API key', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await sendInvites('X', [inv])).size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('batches by 100 and reports only the chunks Resend accepted', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('', { status: 422 }));
    vi.stubGlobal('fetch', fetchSpy);
    const many = Array.from({ length: 150 }, (_, i) => ({ ...inv, email: `s${i}@x.test` }));
    const sent = await sendInvites('X', many);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchSpy.mock.calls[0]![1].body)).toHaveLength(100);
    expect(sent.size).toBe(100);
    expect(sent.has('s0@x.test') && !sent.has('s120@x.test')).toBe(true);
  });
});
