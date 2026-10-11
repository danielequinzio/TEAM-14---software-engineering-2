import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_SERVICES } from './mockBackend.js';
import { addMockWaitingCustomers, handleMockQueueRoute, isMockQueueRoute, resetMockQueue } from './mockQueue.js';

async function call(method, path, body) {
  const url = new URL(path, 'http://mock.local');
  const response = handleMockQueueRoute(url, method, body === undefined ? undefined : JSON.stringify(body), MOCK_SERVICES);
  return { status: response.status, body: await response.json() };
}

function putTickets(tickets) {
  sessionStorage.setItem('oqm.testTickets', JSON.stringify(tickets));
}

const waiting = (id, service_id) => ({ id, service_id, status: 'waiting', created_at: '2026-10-11T08:00:00' });

beforeEach(() => resetMockQueue());

describe('route detection', () => {
  it('knows the queue endpoints and ignores the others', () => {
    ['/api/counters', '/api/counters/3', '/api/counters/3/next', '/api/display', '/api/stats'].forEach((path) =>
      expect(isMockQueueRoute(path)).toBe(true),
    );
    ['/api/services', '/api/ticket', '/api/counters/abc'].forEach((path) =>
      expect(isMockQueueRoute(path)).toBe(false),
    );
  });
});

describe('counters', () => {
  it('starts with three counters and returns the services of one', async () => {
    expect((await call('GET', '/api/counters')).body).toEqual([
      { id: 1, name: 'Counter 1' },
      { id: 2, name: 'Counter 2' },
      { id: 3, name: 'Counter 3' },
    ]);
    const one = await call('GET', '/api/counters/1');
    expect(one.body.services.map((service) => service.name)).toEqual(['Shipping', 'Accounts']);
  });

  it('creates a counter, rejects duplicates, empty names and unknown services like the backend', async () => {
    expect(await call('POST', '/api/counters?name=Counter%204', [1])).toMatchObject({ status: 201, body: { id: 4, name: 'Counter 4' } });
    expect(await call('POST', '/api/counters?name=Counter%204', [1])).toMatchObject({ status: 409, body: { detail: 'Counter name already exists' } });
    expect(await call('POST', '/api/counters?name=Other', [99])).toMatchObject({ status: 422, body: { detail: 'Unknown service id in service_ids' } });
    expect((await call('POST', '/api/counters?name=', [])).status).toBe(422);
  });

  it('replaces the services of a counter and answers 404 for an unknown one', async () => {
    await call('PUT', '/api/counters/3', [1, 2, 3]);
    expect((await call('GET', '/api/counters/3')).body.services).toHaveLength(3);
    expect(await call('PUT', '/api/counters/9', [1])).toMatchObject({ status: 404, body: { detail: 'Counter not found' } });
  });
});

describe('next customer', () => {
  it('does nothing when no one is waiting', async () => {
    expect((await call('POST', '/api/counters/1/next')).body).toEqual({ ticket: null });
  });

  it('takes the first ticket of the longest queue among the counter services', async () => {
    putTickets([waiting(1, 2), waiting(2, 1), waiting(3, 1), waiting(4, 3)]);
    const { body } = await call('POST', '/api/counters/1/next'); // Shipping 2 waiting, Accounts 1
    expect(body.ticket).toMatchObject({ id: 2, service_id: 1, status: 'serving' });
  });

  it('breaks a tie with the shorter service time', async () => {
    putTickets([waiting(1, 2), waiting(2, 1)]); // one each; Shipping 5 min < Accounts 10 min
    expect((await call('POST', '/api/counters/1/next')).body.ticket.id).toBe(2);
  });

  it('ignores tickets of services the counter does not serve', async () => {
    putTickets([waiting(1, 4)]);
    expect((await call('POST', '/api/counters/1/next')).body).toEqual({ ticket: null });
  });

  it('finishes the previous customer of the counter', async () => {
    putTickets([waiting(1, 1), waiting(2, 1)]);
    await call('POST', '/api/counters/1/next');
    await call('POST', '/api/counters/1/next');
    const tickets = JSON.parse(sessionStorage.getItem('oqm.testTickets'));
    expect(tickets.map((ticket) => ticket.status)).toEqual(['done', 'serving']);
  });

  it('answers 404 for an unknown counter', async () => {
    expect((await call('POST', '/api/counters/9/next')).status).toBe(404);
  });
});

describe('display and stats', () => {
  it('shows who is served where and the queue lengths', async () => {
    putTickets([waiting(1, 1), waiting(2, 1), waiting(3, 2)]);
    await call('POST', '/api/counters/1/next');
    const { body } = await call('GET', '/api/display');
    expect(body.counters[0]).toEqual({ id: 1, name: 'Counter 1', current_ticket: { id: 1, service_id: 1 } });
    expect(body.counters[1].current_ticket).toBeNull();
    expect(body.queues.find((queue) => queue.service_id === 1).waiting).toBe(1);
    expect(body.queues.find((queue) => queue.service_id === 2).waiting).toBe(1);
  });

  it('counts customers called today and keeps the history for other days', async () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayText = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    putTickets([waiting(1, 1), waiting(2, 2)]);
    await call('POST', '/api/counters/1/next');

    const day = (await call('GET', `/api/stats?period=day&date=${todayText}`)).body;
    expect(day).toMatchObject({ from: todayText, to: todayText, total: 1 });
    expect(day.by_service).toEqual([{ service_id: 1, name: 'Shipping', count: 1 }]);

    const month = (await call('GET', `/api/stats?period=month&date=${todayText}`)).body;
    expect(month.total).toBeGreaterThanOrEqual(1);
    expect(month.from.endsWith('-01')).toBe(true);
    expect(month.by_service.map((row) => row.count)).toEqual([...month.by_service.map((row) => row.count)].sort((a, b) => b - a));
  });

  it('gives the same history every time and a Monday to Sunday week', async () => {
    const first = (await call('GET', '/api/stats?period=week&date=2026-09-10')).body;
    const second = (await call('GET', '/api/stats?period=week&date=2026-09-10')).body;
    expect(second).toEqual(first);
    expect([first.from, first.to]).toEqual(['2026-09-07', '2026-09-13']);
  });

  it('rejects a bad period or date', async () => {
    expect((await call('GET', '/api/stats?period=year&date=2026-09-10')).status).toBe(422);
    expect((await call('GET', '/api/stats?period=day&date=nope')).status).toBe(422);
  });
});

describe('sample customers', () => {
  it('adds seven waiting tickets after the existing ones', () => {
    putTickets([waiting(5, 1)]);
    expect(addMockWaitingCustomers(MOCK_SERVICES)).toBe(12);
    expect(JSON.parse(sessionStorage.getItem('oqm.testTickets'))).toHaveLength(8);
  });
});
