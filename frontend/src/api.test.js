import { describe, expect, it } from 'vitest';
import { ApiError, createTicket, getServices, getTicket } from './api.js';
import { jsonResponse, mockFetch, SERVICES, TICKET } from './test/helpers.js';

describe('api', () => {
  it('getServices reads GET /services', async () => {
    const fetchStub = mockFetch({ 'GET /api/services': jsonResponse(SERVICES) });

    await expect(getServices()).resolves.toEqual(SERVICES);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('getServices rejects a response that is not a list', async () => {
    mockFetch({ 'GET /api/services': jsonResponse({ detail: 'oops' }) });

    await expect(getServices()).rejects.toMatchObject({ kind: 'server' });
  });

  it('createTicket sends POST /ticket with service_id in the query string', async () => {
    const fetchStub = mockFetch({ 'POST /api/ticket?service_id=1': jsonResponse(TICKET, 201) });

    await expect(createTicket(1)).resolves.toEqual(TICKET);
    const [url, options] = fetchStub.mock.calls[0];
    expect(url).toBe('/api/ticket?service_id=1');
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined();
  });

  it('getTicket sends GET /ticket with ticket_id', async () => {
    mockFetch({ 'GET /api/ticket?ticket_id=12': jsonResponse(TICKET) });

    await expect(getTicket(12)).resolves.toEqual(TICKET);
  });

  it('maps 404 to a not-found error carrying the backend message', async () => {
    mockFetch({
      'POST /api/ticket?service_id=99': jsonResponse({ detail: 'Service not found' }, 404),
    });

    const error = await createTicket(99).catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'not-found', status: 404, message: 'Service not found' });
  });

  it('maps 422 validation errors to an invalid error with the first message', async () => {
    mockFetch({
      'GET /api/ticket?ticket_id=abc': jsonResponse(
        { detail: [{ msg: 'Input should be a valid integer', loc: ['query', 'ticket_id'] }] },
        422,
      ),
    });

    await expect(getTicket('abc')).rejects.toMatchObject({
      kind: 'invalid',
      status: 422,
      message: 'Input should be a valid integer',
    });
  });

  it('maps a failed request to a network error', async () => {
    mockFetch({
      'GET /api/services': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(getServices()).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps a 500 without a JSON body to a server error', async () => {
    mockFetch({
      'GET /api/services': () => new Response('Internal Server Error', { status: 500 }),
    });

    await expect(getServices()).rejects.toMatchObject({ kind: 'server', status: 500 });
  });
});
