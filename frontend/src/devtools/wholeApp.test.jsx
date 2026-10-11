import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { disableMockBackend, setMockLatency, setMockScenario } from './mockBackend.js';
import { resetMockQueue } from './mockQueue.js';

// The whole app with the backend down and test mode on: every screen has to
// work from the sample data, and the screens have to agree with each other.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
  setMockLatency(0);
  setMockScenario('ok');
});

afterEach(() => {
  disableMockBackend();
  resetMockQueue();
  setMockLatency(300);
});

async function turnOnMockData(user) {
  await user.click(await screen.findByRole('button', { name: 'Test mode: off' }));
  await user.click(screen.getByRole('button', { name: 'Use mock data (no backend)' }));
}

async function openScreen(user, name) {
  await user.click(screen.getByRole('link', { name }));
}

describe('whole app in test mode', () => {
  it('shows an error with the test mode hint on every new screen while the backend is down', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const name of ['Next customer', 'Call customer', 'Stats', 'Config counters']) {
      await openScreen(user, name);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("We can't reach the queue system");
      expect(alert).toHaveTextContent('Open Test mode');
    }
  });

  it('follows one customer through all five screens', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);

    // 1. Get ticket: the customer takes a ticket for Shipping.
    await user.click(await screen.findByRole('button', { name: 'Get ticket for Shipping' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Get ticket' }));
    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();

    // 2. Call customer: one person waits for Shipping, nobody is served.
    await openScreen(user, 'Call customer');
    const queues = within(await screen.findByRole('region', { name: 'Waiting' }));
    expect(await queues.findByText('1 person')).toBeInTheDocument();
    expect(screen.getAllByText('Free')).toHaveLength(3);

    // 3. Next customer: the officer at Counter 1 calls that ticket.
    await openScreen(user, 'Next customer');
    await user.selectOptions(await screen.findByLabelText('Counter'), 'Counter 1');
    await user.click(await screen.findByRole('button', { name: 'Call next customer' }));
    const called = (await screen.findByText('Now serving')).closest('.called');
    expect(called).toHaveTextContent('1');
    expect(called).toHaveTextContent('Shipping');

    // 4. Call customer again: the customer is told it is their turn.
    await openScreen(user, 'Call customer');
    expect(await screen.findByText("Ticket 1 — it's your turn at Counter 1.")).toBeInTheDocument();

    // 5. Stats: today's number counts the call.
    await openScreen(user, 'Stats');
    await waitFor(() =>
      expect(document.querySelector('.stats-total')).toHaveTextContent('1 customer served'),
    );

    // Back on the ticket the status moved on.
    await openScreen(user, 'Get ticket');
    await user.click(await screen.findByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText(/Status: Being served\./)).toBeInTheDocument();
  });

  it('calls the longest queue first using the sample customers', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);

    await user.click(screen.getByRole('button', { name: 'Add sample customers' }));

    await openScreen(user, 'Next customer');
    await user.selectOptions(await screen.findByLabelText('Counter'), 'Counter 2'); // Accounts + Payments
    await user.click(await screen.findByRole('button', { name: 'Call next customer' }));

    // Accounts has 2 waiting, Payments 1: the first Accounts ticket (id 4) is called.
    const called = (await screen.findByText('Now serving')).closest('.called');
    expect(called).toHaveTextContent('4');
    expect(called).toHaveTextContent('Accounts');
  });

  it('adds a counter and a service assignment that the other screens see', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);

    await openScreen(user, 'Config counters');
    await user.type(await screen.findByLabelText('Name'), 'Counter 4');
    await user.click(screen.getByRole('checkbox', { name: /Payments/ }));
    await user.click(screen.getByRole('button', { name: 'Add counter' }));
    expect(await screen.findByRole('heading', { name: 'Counter 4' })).toBeInTheDocument();

    await openScreen(user, 'Call customer');
    expect(await screen.findByText('Counter 4')).toBeInTheDocument();

    await openScreen(user, 'Next customer');
    expect(within(await screen.findByLabelText('Counter')).getByRole('option', { name: 'Counter 4' })).toBeInTheDocument();
  });

  it('goes back to the error state when mock data is turned off', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);
    await openScreen(user, 'Stats');
    await waitFor(() => expect(document.querySelector('.stats-total')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Turn off mock data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
  });
});
