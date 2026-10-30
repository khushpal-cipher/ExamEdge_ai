// Signed-in load test on the THROWAWAY Supabase project (seed: scripts/load/seed-loadtest.sql). Every virtual student signs in,
// starts the open test, saves 10 answers and submits, straight against PostgREST (the same RPCs the web app calls).
// Run: SUPABASE_URL=https://<ref>.supabase.co KEY=<publishable key> TEST_ID=<uuid> STUDENTS=1000 k6 run scripts/load/students.js
// shortcut: bypasses the Next.js pages (Vercel), so it measures sign-in + database only.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.KEY;
const TEST_ID = __ENV.TEST_ID;
const N = Number(__ENV.STUDENTS || 100);
const start = new Trend('step_start_attempt', true);
const save = new Trend('step_save_answer', true);
const submit = new Trend('step_submit', true);

export const options = {
  setupTimeout: '20m',
  scenarios: { all: { executor: 'per-vu-iterations', vus: N, iterations: 1, maxDuration: '10m' } },
  thresholds: { http_req_failed: ['rate<0.01'], step_start_attempt: ['p(95)<2000'], step_save_answer: ['p(95)<2000'] },
};

const call = (path, body, token, trend) => {
  const r = http.post(`${URL}${path}`, JSON.stringify(body), {
    headers: { apikey: KEY, authorization: `Bearer ${token || KEY}`, 'content-type': 'application/json' },
  });
  trend.add(r.timings.duration);
  return r;
};

// Sign-ins are paced here (the auth service of a small project cannot take 1,000 password logins at once); the measured
// burst below is every student starting, answering and submitting at the same moment.
export function setup() {
  const tokens = [];
  const CHUNK = Number(__ENV.LOGIN_CONCURRENCY || 5);
  for (let i = 1; i <= N; i += CHUNK) {
    const reqs = [];
    for (let j = i; j < Math.min(i + CHUNK, N + 1); j++) {
      reqs.push([
        'POST',
        `${URL}/auth/v1/token?grant_type=password`,
        JSON.stringify({ email: `load${j}@loadtest.test`, password: 'LoadTest-2026' }),
        { headers: { apikey: KEY, 'content-type': 'application/json' } },
      ]);
    }
    for (const r of http.batch(reqs)) tokens.push(r.status === 200 ? r.json('access_token') : null);
  }
  return tokens;
}

export default function (tokens) {
  const token = tokens[__VU - 1];
  if (!check(token, { 'has token': (t) => !!t })) return;
  const a = call('/rest/v1/rpc/start_attempt', { t: TEST_ID }, token, start);
  if (!check(a, { 'attempt started': (r) => r.status === 200 })) return;
  const attempt = a.json();
  const row = http.get(`${URL}/rest/v1/test_attempts?select=question_order&id=eq.${attempt}`, {
    headers: { apikey: KEY, authorization: `Bearer ${token}` },
  });
  for (const q of row.json()[0].question_order) {
    const r = call('/rest/v1/rpc/save_answer', { a: attempt, q, response: ['a'] }, token, save);
    check(r, { 'answer saved': (x) => x.status === 204 || x.status === 200 });
  }
  const f = call('/rest/v1/rpc/submit_attempt', { a: attempt }, token, submit);
  check(f, { submitted: (x) => x.status === 204 || x.status === 200 });
}
