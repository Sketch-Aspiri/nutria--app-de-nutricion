import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = __ENV.LOAD_TEST_URL || 'http://localhost:3000';
const SESSION_COOKIE = __ENV.LOAD_TEST_SESSION_COOKIE || '';
const REMOTE_ALLOWED = __ENV.LOAD_TEST_ALLOW_REMOTE === 'true';
const parsed = new URL(BASE_URL);
const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);

if (!local && !REMOTE_ALLOWED) {
  fail('Destino remoto bloqueado. Define LOAD_TEST_ALLOW_REMOTE=true deliberadamente.');
}
if (!local && parsed.protocol !== 'https:') {
  fail('Los destinos remotos de carga deben usar HTTPS.');
}

export const options = {
  scenarios: {
    health: {
      executor: 'constant-vus',
      exec: 'health',
      vus: Number(__ENV.LOAD_HEALTH_VUS || 20),
      duration: __ENV.LOAD_DURATION || '1m',
    },
    panel: {
      executor: 'constant-vus',
      exec: 'panel',
      vus: SESSION_COOKIE ? Number(__ENV.LOAD_PANEL_VUS || 10) : 0,
      duration: __ENV.LOAD_DURATION || '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:health}': ['p(95)<500'],
    'http_req_duration{scenario:panel}': ['p(95)<1000'],
  },
};

export function health() {
  const response = http.get(`${BASE_URL}/api/v1/health`, {
    tags: { endpoint: 'health' },
  });
  check(response, { 'health 200': (result) => result.status === 200 });
  sleep(1);
}

export function panel() {
  const response = http.get(`${BASE_URL}/api/v1/patients`, {
    headers: { Cookie: SESSION_COOKIE },
    tags: { endpoint: 'patients-list' },
  });
  check(response, { 'patients 200': (result) => result.status === 200 });
  sleep(1);
}
