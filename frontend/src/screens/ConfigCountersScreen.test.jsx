import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockFetch, SERVICES } from '../test/helpers.js';
import ConfigCountersScreen from './ConfigCountersScreen.jsx';

const COUNTERS = [
  { id: 1, name: 'Counter 1' },
  { id: 2, name: 'Counter 2' },
];
const COUNTER_1 = { id: 1, name: 'Counter 1', services: [SERVICES[0], SERVICES[1]] };
const COUNTER_2 = { id: 2, name: 'Counter 2', services: [SERVICES[1]] };

function lastCall(stub, key) {
  return stub.mock.calls.filter(([url, options = {}]) => `${options.method ?? 'GET'} ${url}` === key).at(-1);
}

describe('Config counters', () => {
  const base = () => ({
    'GET /api/services': jsonResponse(SERVICES),
    'GET /api/counters': jsonResponse(COUNTERS),
    'GET /api/counters/1': jsonResponse(COUNTER_1),
    'GET /api/counters/2': jsonResponse(COUNTER_2),
  });

  it('shows a retryable error when the counters cannot be loaded', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockFetch({
      ...base(),
      'GET /api/counters': () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(COUNTERS);
      },
    });
    render(<ConfigCountersScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Counter 1' })).toBeInTheDocument();
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
