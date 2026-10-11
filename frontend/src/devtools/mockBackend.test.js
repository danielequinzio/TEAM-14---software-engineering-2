import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTicket, getServices, getTicket } from '../api.js';
import {
  MOCK_SERVICES,
  advanceMockTicketStatus,
  disableMockBackend,
  enableMockBackend,
  isMockEnabled,
  setMockLatency,
  setMockScenario,
} from './mockBackend.js';

beforeEach(() => {
  setMockLatency(0);
  setMockScenario('ok');
});

afterEach(() => {
  vi.useRealTimers();
  disableMockBackend();
  setMockLatency(300);
});

describe('mock backend', () => {
  it('replaces fetch while enabled and restores it when disabled', () => {
    const original = globalThis.fetch;

    enableMockBackend();
    expect(isMockEnabled()).toBe(true);
    expect(globalThis.fetch).not.toBe(original);

    disableMockBackend();
    expect(isMockEnabled()).toBe(false);
    expect(globalThis.fetch).toBe(original);
  });

  it('answers GET /services through the real api.js', async () => {
    enableMockBackend();

    await expect(getServices()).resolves.toEqual(MOCK_SERVICES);
  });

  it('issues tickets with increasing ids and returns them by id', async () => {
    enableMockBackend();

    const first = await createTicket(1);
    const second = await createTicket(2);

    expect(first).toMatchObject({ id: 1, service_id: 1, status: 'waiting' });
    expect(second).toMatchObject({ id: 2, service_id: 2, status: 'waiting' });
    expect(first.created_at).not.toMatch(/Z$/); // like the real backend
    await expect(getTicket(2)).resolves.toEqual(second);
  });

  it('answers like the real backend for unknown services and bad ids', async () => {
    enableMockBackend();

    await expect(createTicket(99)).rejects.toMatchObject({ kind: 'not-found', message: 'Service not found' });
    await expect(getTicket(5)).rejects.toMatchObject({ kind: 'not-found', message: 'Ticket not found' });
    await expect(getTicket('abc')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('simulates an unreachable server', async () => {
    enableMockBackend();
    setMockScenario('offline');

    await expect(getServices()).rejects.toMatchObject({ kind: 'network' });
    await expect(createTicket(1)).rejects.toMatchObject({ kind: 'network' });
  });

  it('simulates an empty service list', async () => {
    enableMockBackend();
    setMockScenario('empty');

    await expect(getServices()).resolves.toEqual([]);
  });

  it('simulates failing ticket requests', async () => {
    enableMockBackend();

    setMockScenario('create-404');
    await expect(createTicket(1)).rejects.toMatchObject({ kind: 'not-found', status: 404 });

    setMockScenario('create-500');
    await expect(createTicket(1)).rejects.toMatchObject({ kind: 'server', status: 500 });

    setMockScenario('ok');
    await expect(createTicket(1)).resolves.toMatchObject({ status: 'waiting' });
  });

  it('simulates a slow network', async () => {
    vi.useFakeTimers();
    enableMockBackend();
    setMockScenario('slow');

    const done = vi.fn();
    const request = getServices().then(done);

    await vi.advanceTimersByTimeAsync(2400);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    await request;
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('honours an aborted request', async () => {
    enableMockBackend();
    const controller = new AbortController();

    const request = getServices({ signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('moves the latest ticket through waiting, serving and done', async () => {
    enableMockBackend();
    expect(advanceMockTicketStatus()).toBeNull();

    const ticket = await createTicket(1);

    expect(advanceMockTicketStatus()).toBe('serving');
    await expect(getTicket(ticket.id)).resolves.toMatchObject({ status: 'serving' });
    expect(advanceMockTicketStatus()).toBe('done');
    expect(advanceMockTicketStatus()).toBe('waiting');
  });

  it('lets requests that are not the queue API through to the real fetch', async () => {
    const realFetch = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', realFetch);
    enableMockBackend();

    await fetch('/assets/logo.svg');

    expect(realFetch).toHaveBeenCalledWith('/assets/logo.svg', {});
  });
});
