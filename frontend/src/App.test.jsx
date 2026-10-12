import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';
import { jsonResponse, mockFetch, SERVICES, TICKET } from './test/helpers.js';

const servicesOk = { 'GET /api/services': jsonResponse(SERVICES) };

async function openDialogFor(user, name) {
  await user.click(await screen.findByRole('button', { name: `Get ticket for ${name}` }));
  return screen.findByRole('dialog', { name: `Get a ticket for ${name}?` });
}

describe('landing page', () => {
  it('lists the services returned by the backend', async () => {
    mockFetch(servicesOk);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByText('Average time per customer: 5 min')).toBeInTheDocument();
    expect(screen.getByText('Average time per customer: 10 min')).toBeInTheDocument();
  });

  it('shows a retryable error when the services cannot be loaded', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockFetch({
      'GET /api/services': () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(SERVICES);
      },
    });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an empty state when no service exists', async () => {
    mockFetch({ 'GET /api/services': jsonResponse([]) });
    render(<App />);

    expect(await screen.findByText(/No services are open right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('issues a ticket after confirmation and shows it', async () => {
    const user = userEvent.setup();
    const fetchStub = mockFetch({
      ...servicesOk,
      'POST /api/ticket?service_id=1': jsonResponse(TICKET, 201),
    });
    render(<App />);

    const dialog = await openDialogFor(user, 'Shipping');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));

    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Average time per customer for Shipping: 5 min.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('oqm.ticketId')).toBe('12');

    const posts = fetchStub.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe('/api/ticket?service_id=1');
  });

  it('does not issue a ticket when the customer cancels', async () => {
    const user = userEvent.setup();
    const fetchStub = mockFetch(servicesOk);
    render(<App />);

    const dialog = await openDialogFor(user, 'Accounts');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchStub.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('closes the dialog with Escape and gives focus back to the button', async () => {
    const user = userEvent.setup();
    mockFetch(servicesOk);
    render(<App />);

    await openDialogFor(user, 'Shipping');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get ticket for Shipping' })).toHaveFocus();
  });

  it('explains the problem and refreshes the list when the service is gone (404)', async () => {
    const user = userEvent.setup();
    const fetchStub = mockFetch({
      ...servicesOk,
      'POST /api/ticket?service_id=1': jsonResponse({ detail: 'Service not found' }, 404),
    });
    render(<App />);

    const dialog = await openDialogFor(user, 'Shipping');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "That service isn't available anymore",
    );
    expect(screen.queryByRole('heading', { name: 'Your ticket' })).not.toBeInTheDocument();
    await waitFor(() => {
      const listCalls = fetchStub.mock.calls.filter(([url]) => url === '/api/services');
      expect(listCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('keeps the dialog open with a message when the server is unreachable', async () => {
    const user = userEvent.setup();
    mockFetch({
      ...servicesOk,
      'POST /api/ticket?service_id=2': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);

    const dialog = await openDialogFor(user, 'Accounts');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "We can't reach the queue system",
    );
    expect(within(dialog).getByRole('button', { name: 'Get ticket' })).toBeEnabled();
  });

  it('shows the ticket of this tab again after a reload', async () => {
    sessionStorage.setItem('oqm.ticketId', '7');
    mockFetch({
      ...servicesOk,
      'GET /api/ticket?ticket_id=7': jsonResponse({ ...TICKET, id: 7, service_id: 2 }),
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(await screen.findByText('Accounts')).toBeInTheDocument();
  });

  it('forgets a stored ticket the backend no longer knows', async () => {
    sessionStorage.setItem('oqm.ticketId', '404');
    mockFetch({
      ...servicesOk,
      'GET /api/ticket?ticket_id=404': jsonResponse({ detail: 'Ticket not found' }, 404),
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
    expect(sessionStorage.getItem('oqm.ticketId')).toBeNull();
  });

  it('refreshes the ticket status on request', async () => {
    const user = userEvent.setup();
    let reads = 0;
    mockFetch({
      ...servicesOk,
      'POST /api/ticket?service_id=1': jsonResponse(TICKET, 201),
      'GET /api/ticket?ticket_id=12': () => {
        reads += 1;
        return jsonResponse({ ...TICKET, status: 'serving' });
      },
    });
    render(<App />);

    const dialog = await openDialogFor(user, 'Shipping');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));
    await user.click(await screen.findByRole('button', { name: 'Refresh status' }));

    expect(await screen.findByText('Being served')).toBeInTheDocument();
    expect(screen.getByText(/Status: Being served\./)).toBeInTheDocument();
    expect(reads).toBe(1);
  });

  it('lets the customer take another ticket', async () => {
    const user = userEvent.setup();
    mockFetch({
      ...servicesOk,
      'POST /api/ticket?service_id=1': jsonResponse(TICKET, 201),
    });
    render(<App />);

    const dialog = await openDialogFor(user, 'Shipping');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));
    await user.click(await screen.findByRole('button', { name: 'Take another ticket' }));

    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
    expect(sessionStorage.getItem('oqm.ticketId')).toBeNull();
  });
});
