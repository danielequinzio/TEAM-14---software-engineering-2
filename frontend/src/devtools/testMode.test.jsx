import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { disableMockBackend, setMockLatency, setMockScenario } from './mockBackend.js';

// A backend that is down: every request fails, which is the situation test
// mode is meant for.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
  setMockLatency(0);
  setMockScenario('ok');
});

afterEach(() => {
  disableMockBackend();
  setMockLatency(300);
});

async function turnOnMockData(user) {
  await user.click(await screen.findByRole('button', { name: 'Test mode: off' }));
  await user.click(screen.getByRole('button', { name: 'Use mock data (no backend)' }));
}

describe('test mode', () => {
  it('shows the service list from mock data when the backend is down', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");

    await turnOnMockData(user);

    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Residence permits and passport renewals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test mode: on' })).toBeInTheDocument();
  });

  it('lets every screen be reached: list, dialog, ticket and a new status', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);

    await user.click(await screen.findByRole('button', { name: 'Get ticket for Payments' }));
    const dialog = await screen.findByRole('dialog', { name: 'Get a ticket for Payments?' });
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));

    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Advance ticket status' }));
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText('Being served')).toBeInTheDocument();
  });

  it('shows the error and empty states through the scenario list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);
    await screen.findByRole('heading', { name: 'Shipping' });

    await user.selectOptions(screen.getByLabelText('Scenario'), 'empty');
    expect(await screen.findByText(/No services are open right now/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Scenario'), 'offline');
    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");

    await user.selectOptions(screen.getByLabelText('Scenario'), 'ok');
    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
  });

  it('shows a failed ticket request in the dialog', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);
    await screen.findByRole('heading', { name: 'Shipping' });
    await user.selectOptions(screen.getByLabelText('Scenario'), 'create-500');

    await user.click(screen.getByRole('button', { name: 'Get ticket for Shipping' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Get ticket' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't issue your ticket");
  });

  it('goes back to the real backend when turned off', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnMockData(user);
    await screen.findByRole('heading', { name: 'Shipping' });

    await user.click(screen.getByRole('button', { name: 'Turn off mock data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach the queue system");
    expect(screen.getByRole('button', { name: 'Test mode: off' })).toBeInTheDocument();
  });
});
