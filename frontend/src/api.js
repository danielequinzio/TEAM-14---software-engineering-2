// Client for the Office Queue backend (FastAPI, backend/API/API.py).
//
// Endpoints used here:
//   GET  /services                  -> [{ id, name, service_time }]
//   POST /ticket?service_id=<id>    -> { id, service_id, status, created_at }  (201)
//   GET  /ticket?ticket_id=<id>     -> { id, service_id, status, created_at }  (200)
//   GET  /counters                  -> [{ id, name }]
//   GET  /counters/<id>             -> { id, name, services: [{ id, name, service_time }] }
//   POST /counters?name=<name>      body: [service ids]  -> { id, name }  (201)
//   PUT  /counters/<id>             body: [service ids]  -> the counter
//
// In development, "/api" is forwarded to the backend by the Vite proxy
// (see vite.config.js). Set VITE_API_URL to call a backend directly instead.

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  // kind: 'network' | 'not-found' | 'conflict' | 'invalid' | 'server'
  constructor(message, { kind = 'server', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

function kindFromStatus(status) {
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 422 || status === 400) return 'invalid';
  return 'server';
}

// FastAPI answers errors as { detail: "text" } or, for validation errors,
// { detail: [{ msg, loc, ... }] }.
async function readDetail(response) {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // body was not JSON: fall through to the status text
  }
  return response.statusText || `Request failed (${response.status})`;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error; // caller cancelled on purpose
    throw new ApiError('Could not reach the server', { kind: 'network' });
  }

  if (!response.ok) {
    throw new ApiError(await readDetail(response), {
      kind: kindFromStatus(response.status),
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('The server sent an unreadable response', {
      kind: 'server',
      status: response.status,
    });
  }
}

export async function getServices({ signal } = {}) {
  const services = await request('/services', { signal });
  if (!Array.isArray(services)) {
    throw new ApiError('Unexpected response for /services', { kind: 'server' });
  }
  return services;
}

export function createTicket(serviceId, { signal } = {}) {
  return request(`/ticket?service_id=${encodeURIComponent(serviceId)}`, {
    method: 'POST',
    signal,
  });
}

export function getTicket(ticketId, { signal } = {}) {
  return request(`/ticket?ticket_id=${encodeURIComponent(ticketId)}`, { signal });
}

// ---------- counters ----------

function expectArray(value, path) {
  if (!Array.isArray(value)) {
    throw new ApiError(`Unexpected response for ${path}`, { kind: 'server' });
  }
  return value;
}

export async function getCounters({ signal } = {}) {
  return expectArray(await request('/counters', { signal }), '/counters');
}

export function getCounter(counterId, { signal } = {}) {
  return request(`/counters/${encodeURIComponent(counterId)}`, { signal });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function createCounter(name, serviceIds, { signal } = {}) {
  return request(`/counters?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(serviceIds),
    signal,
  });
}

export function updateCounterServices(counterId, serviceIds, { signal } = {}) {
  return request(`/counters/${encodeURIComponent(counterId)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(serviceIds),
    signal,
  });
}
