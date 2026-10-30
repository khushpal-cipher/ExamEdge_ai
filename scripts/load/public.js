// Load test of the public pages on the live site (no sign-in, no test data written). Run: k6 run scripts/load/public.js
// shortcut: one machine and public pages only; signed-in flows (500 students starting a test) need a prod-sized database.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://examedgeai.in';
export const options = {
  stages: [
    { duration: '20s', target: 100 },
    { duration: '40s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'] },
};

export default function () {
  for (const path of ['/', '/api/health', '/legal/privacy']) {
    const res = http.get(`${BASE}${path}`);
    check(res, { [`${path} 200`]: (r) => r.status === 200 });
  }
  sleep(1);
}
