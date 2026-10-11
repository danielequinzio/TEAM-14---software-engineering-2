// TEST MODE (temporary, development only): see mockBackend.js for how to remove it.
import { useState } from 'react';
import './testbar.css';
import {
  SCENARIOS,
  advanceMockTicketStatus,
  disableMockBackend,
  enableMockBackend,
  getMockScenario,
  isMockEnabled,
  setMockScenario,
  MOCK_SERVICES,
} from './mockBackend.js';
import { addMockWaitingCustomers, resetMockQueue } from './mockQueue.js';

// onReload: load the data of the open screen again.
// onReset: forget what the screens remember and start the open screen over.
export default function TestBar({ onReload, onReset }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(isMockEnabled);
  const [scenario, setScenario] = useState(getMockScenario);
  const [message, setMessage] = useState('');

  // Never shown in a production build.
  if (!import.meta.env.DEV) return null;

  const handleToggle = () => {
    if (enabled) {
      disableMockBackend();
      resetMockQueue();
    } else {
      enableMockBackend();
    }
    setEnabled(isMockEnabled());
    setMessage('');
    onReset();
  };

  const handleScenario = (event) => {
    setMockScenario(event.target.value);
    setScenario(event.target.value);
    setMessage('');
    onReload();
  };

  const handleAdvance = () => {
    const next = advanceMockTicketStatus();
    setMessage(
      next
        ? `The ticket is now "${next}". Press "Refresh status" on the ticket.`
        : 'There is no ticket yet. Take one first.',
    );
  };

  const handleCustomers = () => {
    addMockWaitingCustomers(MOCK_SERVICES);
    setMessage('Added 7 waiting customers. Open Next customer to call them.');
    onReload();
  };

  return (
    <aside className="testbar" aria-label="Test mode, development only">
      <button
        type="button"
        className="testbar-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Test mode: {enabled ? 'on' : 'off'}
      </button>

      {open && (
        <div className="testbar-body">
          <p className="testbar-note">Development only. Remove before release.</p>

          <button type="button" className="testbar-button" aria-pressed={enabled} onClick={handleToggle}>
            {enabled ? 'Turn off mock data' : 'Use mock data (no backend)'}
          </button>

          <label className="testbar-field">
            Scenario
            <select value={scenario} onChange={handleScenario} disabled={!enabled}>
              {SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="testbar-button"
            onClick={handleAdvance}
            disabled={!enabled}
          >
            Advance ticket status
          </button>

          <button
            type="button"
            className="testbar-button"
            onClick={handleCustomers}
            disabled={!enabled}
          >
            Add sample customers
          </button>

          <p className="testbar-message" aria-live="polite">
            {message}
          </p>
        </div>
      )}
    </aside>
  );
}
