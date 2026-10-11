// TEST MODE (temporary, development only).
//
// Replaces the browser's fetch with an in-memory fake of the backend, so every
// screen can be tried without the FastAPI server. The app code is untouched:
// it still calls api.js, which still calls fetch, which now answers locally.
//
// To remove the whole feature: delete this folder (src/devtools) and the two
// blocks marked "TEST MODE" in src/App.jsx and src/components/ErrorNotice.jsx.

import { handleMockQueueRoute, isMockQueueRoute } from './mockQueue.js';

const ENABLED_KEY = 'oqm.testMode';
const SCENARIO_KEY = 'oqm.testScenario';
const TICKETS_KEY = 'oqm.testTickets';

export const SCENARIOS = [
  { id: 'ok', label: 'Everything works' },
  { id: 'slow', label: 'Slow network (2.5 s per request)' },
  { id: 'offline', label: 'Server unreachable' },
  { id: 'empty', label: 'No services' },
  { id: 'create-404', label: 'Ticket request fails: service not found (404)' },
  { id: 'create-500', label: 'Ticket request fails: server error (500)' },
];

export const MOCK_SERVICES = [
  { id: 1, name: 'Shipping', service_time: 5 },
  { id: 2, name: 'Accounts', service_time: 10 },
  { id: 3, name: 'Payments', service_time: 7 },
  { id: 4, name: 'Residence permits and passport renewals', service_time: 20 },
];

const STATUS_ORDER = ['waiting', 'serving', 'done'];

const state = {
  enabled: false,
  scenario: 'ok',
  latency: 300, // ms, so the loading placeholders are visible
  realFetch: null,
};

// ---------- storage (kept for the browser tab, like the real ticket id) ----------

function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable: test mode still works, just without persistence
  }
}

function loadTickets() {
  try {
    const tickets = JSON.parse(readStorage(TICKETS_KEY) ?? '[]');
    return Array.isArray(tickets) ? tickets : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  writeStorage(TICKETS_KEY, JSON.stringify(tickets));
}

// ---------- fake backend ----------

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function invalidInteger(name) {
  return json(
    {
      detail: [
        {
          type: 'int_parsing',
          loc: ['query', name],
          msg: 'Input should be a valid integer, unable to parse string as an integer',
        },
      ],
    },
    422,
  );
}

function createTicket(url) {
  if (state.scenario === 'create-404') return json({ detail: 'Service not found' }, 404);
  if (state.scenario === 'create-500') return json({ detail: 'Internal Server Error' }, 500);

  const rawId = url.searchParams.get('service_id');
  const serviceId = Number(rawId);
  if (rawId === null || !Number.isInteger(serviceId)) return invalidInteger('service_id');
  if (!MOCK_SERVICES.some((service) => service.id === serviceId)) {
    return json({ detail: 'Service not found' }, 404);
  }

  const tickets = loadTickets();
  const ticket = {
    id: Math.max(0, ...tickets.map((item) => item.id)) + 1,
    service_id: serviceId,
    status: 'waiting',
    // No "Z", like the real backend after SQLite drops the timezone.
    created_at: new Date().toISOString().replace('Z', ''),
  };
  saveTickets([...tickets, ticket]);
  return json(ticket, 201);
}

function readTicket(url) {
  const rawId = url.searchParams.get('ticket_id');
  const ticketId = Number(rawId);
  if (rawId === null || !Number.isInteger(ticketId)) return invalidInteger('ticket_id');

  const ticket = loadTickets().find((item) => item.id === ticketId);
  return ticket ? json(ticket) : json({ detail: 'Ticket not found' }, 404);
}

async function mockFetch(input, options = {}) {
  const raw = typeof input === 'string' ? input : (input?.url ?? String(input));
  const url = new URL(raw, 'http://mock.local');
  const route = url.pathname.match(/\/(services|ticket)$/)?.[1];
  const isQueueRoute = isMockQueueRoute(url.pathname);

  // Anything that is not the queue API goes to the real fetch.
  if (!route && !isQueueRoute) return state.realFetch.call(globalThis, input, options);

  const method = (options.method ?? 'GET').toUpperCase();
  await wait(state.scenario === 'slow' ? 2500 : state.latency, options.signal);

  if (state.scenario === 'offline') {
    throw new TypeError('Failed to fetch (test mode: server unreachable)');
  }
  if (isQueueRoute) return handleMockQueueRoute(url, method, options.body, MOCK_SERVICES);
  if (route === 'services' && method === 'GET') {
    return json(state.scenario === 'empty' ? [] : MOCK_SERVICES);
  }
  if (route === 'ticket' && method === 'POST') return createTicket(url);
  if (route === 'ticket' && method === 'GET') return readTicket(url);
  return json({ detail: 'Method Not Allowed' }, 405);
}

// ---------- controls used by the test bar ----------

export function isMockEnabled() {
  return state.enabled;
}

export function getMockScenario() {
  return state.scenario;
}

export function enableMockBackend() {
  if (state.enabled) return;
  state.realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  state.enabled = true;
  writeStorage(ENABLED_KEY, '1');
}

export function disableMockBackend() {
  if (!state.enabled) return;
  if (globalThis.fetch === mockFetch) globalThis.fetch = state.realFetch;
  state.realFetch = null;
  state.enabled = false;
  writeStorage(ENABLED_KEY, null);
  writeStorage(TICKETS_KEY, null);
}

export function setMockScenario(id) {
  if (!SCENARIOS.some((scenario) => scenario.id === id)) return;
  state.scenario = id;
  writeStorage(SCENARIO_KEY, id);
}

export function setMockLatency(ms) {
  state.latency = ms;
}

// Moves the most recent ticket to its next status (waiting -> serving -> done
// -> waiting) so "Refresh status" on the ticket screen has something to show.
// Returns the new status, or null when no ticket exists yet.
export function advanceMockTicketStatus() {
  const tickets = loadTickets();
  const last = tickets[tickets.length - 1];
  if (!last) return null;

  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(last.status) + 1) % STATUS_ORDER.length];
  saveTickets(tickets.map((ticket) => (ticket === last ? { ...ticket, status: next } : ticket)));
  return next;
}

// Test mode survives a page reload in the same tab. This runs when the module
// is imported, before the app makes its first request.
if (import.meta.env.DEV && readStorage(ENABLED_KEY) === '1') {
  const savedScenario = readStorage(SCENARIO_KEY);
  if (SCENARIOS.some((scenario) => scenario.id === savedScenario)) state.scenario = savedScenario;
  enableMockBackend();
}
