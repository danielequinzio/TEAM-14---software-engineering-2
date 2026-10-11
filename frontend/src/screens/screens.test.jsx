import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockFetch, SERVICES } from '../test/helpers.js';
import CallCustomerScreen from './CallCustomerScreen.jsx';
import ConfigCountersScreen from './ConfigCountersScreen.jsx';
import NextCustomerScreen from './NextCustomerScreen.jsx';
import StatsScreen, { todayString } from './StatsScreen.jsx';

const COUNTERS = [
  { id: 1, name: 'Counter 1' },
  { id: 2, name: 'Counter 2' },
];
const COUNTER_1 = { id: 1, name: 'Counter 1', services: [SERVICES[0], SERVICES[1]] };
const COUNTER_2 = { id: 2, name: 'Counter 2', services: [SERVICES[1]] };

function lastCall(stub, key) {
  return stub.mock.calls.filter(([url, options = {}]) => `${options.method ?? 'GET'} ${url}` === key).at(-1);
}

describe('Next customer', () => {
  const counterApi = {
    'GET /api/counters': jsonResponse(COUNTERS),
    'GET /api/counters/1': jsonResponse(COUNTER_1),
    'GET /api/counters/2': jsonResponse(COUNTER_2),
  };

  it('calls the next customer for the chosen counter and shows the ticket', async () => {
    const user = userEvent.setup();
    const stub = mockFetch({
      ...counterApi,
      'POST /api/counters/1/next': jsonResponse({
        ticket: { id: 7, service_id: 2, status: 'serving', created_at: '2026-10-10T09:00:00' },
      }),
    });
    render(<NextCustomerScreen />);

    await user.selectOptions(await screen.findByLabelText('Counter'), 'Counter 1');
    expect(await screen.findByText(/Serves: Shipping \(5 min\), Accounts \(10 min\)\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Call next customer' }));

    const result = await screen.findByText('Now serving');
    expect(result.closest('.called')).toHaveTextContent('7');
    expect(result.closest('.called')).toHaveTextContent('Accounts');
    expect(lastCall(stub, 'POST /api/counters/1/next')).toBeDefined();
    expect(sessionStorage.getItem('oqm.counterId')).toBe('1');
  });

  it('remembers the counter after a reload of the screen', async () => {
    sessionStorage.setItem('oqm.counterId', '2');
    mockFetch(counterApi);
    render(<NextCustomerScreen />);

    expect(await screen.findByLabelText('Counter')).toHaveValue('2');
    expect(await screen.findByText(/Serves: Accounts \(10 min\)\./)).toBeInTheDocument();
  });

  it('says so when no one is waiting', async () => {
    const user = userEvent.setup();
    mockFetch({ ...counterApi, 'POST /api/counters/1/next': jsonResponse({ ticket: null }) });
    render(<NextCustomerScreen />);

    await user.selectOptions(await screen.findByLabelText('Counter'), 'Counter 1');
    await user.click(await screen.findByRole('button', { name: 'Call next customer' }));

    expect(await screen.findByText(/No one is waiting/)).toBeInTheDocument();
  });

  it('explains that the server does not offer the call yet', async () => {
    const user = userEvent.setup();
    mockFetch({ ...counterApi, 'POST /api/counters/1/next': jsonResponse({ detail: 'Not Found' }, 404) });
    render(<NextCustomerScreen />);

    await user.selectOptions(await screen.findByLabelText('Counter'), 'Counter 1');
    await user.click(await screen.findByRole('button', { name: 'Call next customer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("doesn't offer this yet");
  });

  it('points to Config counters when there are no counters', async () => {
    mockFetch({ 'GET /api/counters': jsonResponse([]) });
    render(<NextCustomerScreen />);

    expect(await screen.findByText(/No counters are set up yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Config counters' })).toHaveAttribute('href', '#/config-counters');
  });

  it('shows a retryable error when the counters cannot be loaded', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockFetch({
      'GET /api/counters': () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(COUNTERS);
      },
    });
    render(<NextCustomerScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Counter')).toBeInTheDocument();
  });
});

describe('Call customer', () => {
  const display = {
    counters: [
      { id: 1, name: 'Counter 1', current_ticket: { id: 7, service_id: 1 } },
      { id: 2, name: 'Counter 2', current_ticket: null },
    ],
    queues: [
      { service_id: 1, name: 'Shipping', waiting: 3 },
      { service_id: 2, name: 'Accounts', waiting: 1 },
    ],
  };

  it('shows what each counter serves and how many wait per service', async () => {
    mockFetch({ 'GET /api/display': jsonResponse(display) });
    render(<CallCustomerScreen />);

    const counters = within(await screen.findByRole('region', { name: 'Counters' }));
    expect(counters.getByText('Counter 1')).toBeInTheDocument();
    expect(counters.getByText('Free')).toBeInTheDocument();
    const queues = within(screen.getByRole('region', { name: 'Waiting' }));
    expect(queues.getByText('3 people')).toBeInTheDocument();
    expect(queues.getByText('1 person')).toBeInTheDocument();
  });

  it("tells the customer when it's their turn", async () => {
    sessionStorage.setItem('oqm.ticketId', '7');
    mockFetch({ 'GET /api/display': jsonResponse(display) });
    render(<CallCustomerScreen />);

    expect(await screen.findByText("Ticket 7 — it's your turn at Counter 1.")).toBeInTheDocument();
  });

  it('refreshes on demand and keeps the board when a refresh fails', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockFetch({
      'GET /api/display': () => {
        attempts += 1;
        if (attempts === 2) throw new TypeError('Failed to fetch');
        return jsonResponse(display);
      },
    });
    render(<CallCustomerScreen />);

    await screen.findByText('Counter 1');
    await user.click(screen.getByRole('button', { name: 'Refresh now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
    expect(screen.getByText('Counter 1')).toBeInTheDocument();
  });

  it('says the display is not available yet when the server has no such endpoint', async () => {
    mockFetch({ 'GET /api/display': jsonResponse({ detail: 'Not Found' }, 404) });
    render(<CallCustomerScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent("doesn't offer this yet");
  });
});

function totalText() {
  return document.querySelector('.stats-total')?.textContent.replace(/\s+/g, ' ').trim();
}

describe('Stats', () => {
  const day = (total) => ({
    period: 'day',
    from: todayString(),
    to: todayString(),
    total,
    by_service: total ? [{ service_id: 1, name: 'Shipping', count: total }] : [],
    by_counter: total ? [{ counter_id: 1, name: 'Counter 1', count: total }] : [],
  });

  it("loads today's numbers and switches period", async () => {
    const user = userEvent.setup();
    const today = todayString();
    const stub = mockFetch({
      [`GET /api/stats?period=day&date=${today}`]: jsonResponse(day(4)),
      [`GET /api/stats?period=week&date=${today}`]: jsonResponse({ ...day(20), period: 'week' }),
    });
    render(<StatsScreen />);

    await waitFor(() => expect(totalText()).toBe('4 customers served'));
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Counter 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Week' }));
    await waitFor(() => expect(totalText()).toBe('20 customers served'));
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('shows an empty period as such', async () => {
    mockFetch({ [`GET /api/stats?period=day&date=${todayString()}`]: jsonResponse(day(0)) });
    render(<StatsScreen />);

    expect(await screen.findByText('Nobody was served in this period.')).toBeInTheDocument();
  });

  it('asks again for another date', async () => {
    const stub = mockFetch({
      [`GET /api/stats?period=day&date=${todayString()}`]: jsonResponse(day(1)),
      'GET /api/stats?period=day&date=2026-01-05': jsonResponse({ ...day(2), from: '2026-01-05', to: '2026-01-05' }),
    });
    render(<StatsScreen />);
    await waitFor(() => expect(totalText()).toBe('1 customer served'));

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-01-05' } });

    await waitFor(() => expect(totalText()).toBe('2 customers served'));
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('shows an error with a way to retry', async () => {
    mockFetch({ [`GET /api/stats?period=day&date=${todayString()}`]: jsonResponse({ detail: 'oops' }, 500) });
    render(<StatsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The queue system had a problem');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Config counters', () => {
  const base = () => ({
    'GET /api/services': jsonResponse(SERVICES),
    'GET /api/counters': jsonResponse(COUNTERS),
    'GET /api/counters/1': jsonResponse(COUNTER_1),
    'GET /api/counters/2': jsonResponse(COUNTER_2),
  });

  it('lists the counters with their services', async () => {
    mockFetch(base());
    render(<ConfigCountersScreen />);

    expect(await screen.findByRole('heading', { name: 'Counter 1' })).toBeInTheDocument();
    expect(screen.getByText('Shipping, Accounts')).toBeInTheDocument();
  });

  it('adds a counter with the chosen services', async () => {
    const user = userEvent.setup();
    let created = false;
    const stub = mockFetch({
      ...base(),
      'GET /api/counters': () => jsonResponse(created ? [...COUNTERS, { id: 3, name: 'Counter 3' }] : COUNTERS),
      'GET /api/counters/3': jsonResponse({ id: 3, name: 'Counter 3', services: [SERVICES[0]] }),
      'POST /api/counters?name=Counter%203': () => {
        created = true;
        return jsonResponse({ id: 3, name: 'Counter 3' }, 201);
      },
    });
    render(<ConfigCountersScreen />);

    const form = within((await screen.findByRole('heading', { name: 'Add a counter' })).closest('form'));
    await user.type(form.getByLabelText('Name'), '  Counter 3 ');
    await user.click(form.getByRole('checkbox', { name: /Shipping/ }));
    await user.click(form.getByRole('button', { name: 'Add counter' }));

    expect(await screen.findByRole('heading', { name: 'Counter 3' })).toBeInTheDocument();
    expect(screen.getByText('Added Counter 3.')).toBeInTheDocument();
    const [, options] = lastCall(stub, 'POST /api/counters?name=Counter%203');
    expect(JSON.parse(options.body)).toEqual([1]);
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('refuses an empty name without calling the server', async () => {
    const user = userEvent.setup();
    const stub = mockFetch(base());
    render(<ConfigCountersScreen />);

    await user.click(await screen.findByRole('button', { name: 'Add counter' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for the counter.');
    expect(lastCall(stub, 'POST /api/counters?name=')).toBeUndefined();
  });

  it('explains a name that is already taken', async () => {
    const user = userEvent.setup();
    mockFetch({
      ...base(),
      'POST /api/counters?name=Counter%201': jsonResponse({ detail: 'Counter name already exists' }, 409),
    });
    render(<ConfigCountersScreen />);

    await user.type(await screen.findByLabelText('Name'), 'Counter 1');
    await user.click(screen.getByRole('button', { name: 'Add counter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A counter with that name already exists');
  });

  it('changes the services of a counter', async () => {
    const user = userEvent.setup();
    let saved = null;
    const stub = mockFetch({
      ...base(),
      'PUT /api/counters/2': () => {
        saved = true;
        return jsonResponse({ ...COUNTER_2, services: [SERVICES[0], SERVICES[1]] });
      },
    });
    render(<ConfigCountersScreen />);

    await user.click(await screen.findByRole('button', { name: 'Edit services of Counter 2' }));
    const group = within(screen.getByRole('group', { name: 'Services of Counter 2' }));
    expect(group.getByRole('checkbox', { name: /Accounts/ })).toBeChecked();
    await user.click(group.getByRole('checkbox', { name: /Shipping/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved Counter 2.')).toBeInTheDocument();
    expect(saved).toBe(true);
    const [, options] = lastCall(stub, 'PUT /api/counters/2');
    expect(JSON.parse(options.body).sort()).toEqual([1, 2]);
  });

  it('shows an error when saving fails and keeps the editor open', async () => {
    const user = userEvent.setup();
    mockFetch({ ...base(), 'PUT /api/counters/1': jsonResponse({ detail: 'Unknown service id in service_ids' }, 422) });
    render(<ConfigCountersScreen />);

    await user.click(await screen.findByRole('button', { name: 'Edit services of Counter 1' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not available anymore');
    expect(screen.getByRole('group', { name: 'Services of Counter 1' })).toBeInTheDocument();
  });
});
