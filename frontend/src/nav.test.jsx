import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';
import { jsonResponse, mockFetch, SERVICES } from './test/helpers.js';

function backend() {
  return mockFetch({
    'GET /api/services': jsonResponse(SERVICES),
    'GET /api/counters': jsonResponse([]),
  });
}

describe('screen menu', () => {
  it('lists the two screens and marks the open one', async () => {
    backend();
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Screens' });
    const links = within(nav);
    expect(links.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Get ticket',
      'Config counters',
    ]);
    expect(links.getByRole('link', { name: 'Get ticket' })).toHaveAttribute('aria-current', 'page');
    expect(links.getByRole('link', { name: 'Config counters' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
  });

  it('opens a screen from the menu, sets the title and moves focus to the heading', async () => {
    const user = userEvent.setup();
    backend();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Config counters' }));

    const heading = await screen.findByRole('heading', { name: 'Configure counters' });
    expect(window.location.hash).toBe('#/config-counters');
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Configure counters · Office Queue');
    expect(screen.getByRole('link', { name: 'Config counters' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts on the screen named in the address', async () => {
    window.location.hash = '#/config-counters';
    backend();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Configure counters' })).toBeInTheDocument();
  });

  it('falls back to Get ticket for an unknown address', async () => {
    window.location.hash = '#/unknown';
    backend();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Pick a service, get your number' })).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Shipping' });
  });

  it('keeps the ticket when the customer leaves the Get ticket screen and returns', async () => {
    const user = userEvent.setup();
    mockFetch({
      'GET /api/services': jsonResponse(SERVICES),
      'POST /api/ticket?service_id=1': jsonResponse(
        { id: 12, service_id: 1, status: 'waiting', created_at: '2026-10-10T09:15:30' }, 201),
      'GET /api/ticket?ticket_id=12': jsonResponse(
        { id: 12, service_id: 1, status: 'waiting', created_at: '2026-10-10T09:15:30' }),
      });
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Get ticket for Shipping' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Get ticket' }));
    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Config counters' }));
    await screen.findByRole('heading', { name: 'Configure counters' });
    await user.click(screen.getByRole('link', { name: 'Get ticket' }));

    expect(await screen.findByRole('heading', { name: 'Your ticket' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('makes the page inert while the confirm dialog is open', async () => {
    const user = userEvent.setup();
    backend();
    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Get ticket for Shipping' }));
    await screen.findByRole('dialog');
    expect(container.querySelector('.page')).toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    expect(container.querySelector('.page')).not.toHaveAttribute('inert');
  });
});
