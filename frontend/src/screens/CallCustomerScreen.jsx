import { useEffect } from 'react';
import { getDisplay } from '../api.js';
import ErrorNotice from '../components/ErrorNotice.jsx';
import ScreenHead from '../components/ScreenHead.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { readStored, TICKET_ID_KEY } from '../storage.js';

export const REFRESH_MS = 5000;

// The waiting-room display: which ticket each counter is serving and how many
// people wait for each service. It refreshes itself; "Refresh now" does it on demand.
export default function CallCustomerScreen({ reloadSignal = 0 }) {
  const display = useLoad(getDisplay, reloadSignal);
  const { reload } = display;

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const myTicket = Number(readStored(TICKET_ID_KEY));
  const counters = display.data?.counters ?? [];
  const queues = display.data?.queues ?? [];
  const myCounter = Number.isInteger(myTicket)
    ? counters.find((counter) => counter.current_ticket?.id === myTicket)
    : null;

  return (
    <div className="screen">
      <ScreenHead title="Now calling">
        See which ticket each counter is serving. This page refreshes every few seconds.
      </ScreenHead>

      {display.status === 'loading' && !display.data && (
        <p className="screen-status" role="status">
          Loading the display…
        </p>
      )}
      {display.status === 'error' && (
        <ErrorNotice error={display.error} context="display" onRetry={reload} />
      )}

      {myCounter && (
        <p className="banner" role="status">
          Ticket {myTicket} — it's your turn at {myCounter.name}.
        </p>
      )}

      {display.data && (
        <div className="display-grid">
          <section aria-labelledby="counters-title">
            <h2 id="counters-title" className="card-title">
              Counters
            </h2>
            {counters.length === 0 ? (
              <p className="notice">No counters are open.</p>
            ) : (
              <ul className="board">
                {counters.map((counter) => {
                  const current = counter.current_ticket;
                  const mine = current && current.id === myTicket;
                  return (
                    <li key={counter.id} className={`board-row${mine ? ' board-row-mine' : ''}`}>
                      <span className="board-counter">{counter.name}</span>
                      {current ? (
                        <span className="board-ticket">
                          <span className="visually-hidden">Serving ticket </span>
                          {current.id}
                          {mine && <span className="board-you"> (you)</span>}
                        </span>
                      ) : (
                        <span className="board-idle">Free</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="queues-title">
            <h2 id="queues-title" className="card-title">
              Waiting
            </h2>
            {queues.length === 0 ? (
              <p className="notice">No services yet.</p>
            ) : (
              <ul className="board">
                {queues.map((queue) => (
                  <li key={queue.service_id} className="board-row">
                    <span className="board-counter">{queue.name}</span>
                    <span className="board-count">
                      {queue.waiting} {queue.waiting === 1 ? 'person' : 'people'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="screen-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={reload}
          disabled={display.status === 'loading'}
        >
          {display.status === 'loading' && display.data ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
    </div>
  );
}
