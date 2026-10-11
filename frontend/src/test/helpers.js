import { vi } from 'vitest';

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Replaces fetch with a stub that answers by "METHOD url". A handler can be a
// Response, or a function returning a Response (or throwing, to simulate a
// network failure). Any request without a handler fails the test.
export function mockFetch(handlers) {
  const stub = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return typeof handler === 'function' ? handler() : handler.clone();
  });
  vi.stubGlobal('fetch', stub);
  return stub;
}

export const SERVICES = [
  { id: 1, name: 'Shipping', service_time: 5 },
  { id: 2, name: 'Accounts', service_time: 10 },
];

export const TICKET = {
  id: 12,
  service_id: 1,
  status: 'waiting',
  created_at: '2026-10-10T09:15:30.123456',
};
