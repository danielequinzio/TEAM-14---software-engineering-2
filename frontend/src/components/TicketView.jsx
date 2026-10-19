import { useEffect, useRef } from 'react';
import { formatMinutes, formatTime, statusLabel } from '../format.js';

export default function TicketView({
  ticket,
  serviceName,
  serviceTime,
  notice,
  refreshing,
  onRefresh,
  onNewTicket,
}) {
  const headingRef = useRef(null);

  // The list the customer clicked in is gone, so move focus to the new ticket.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const issuedAt = formatTime(ticket.created_at);
  const time = formatMinutes(serviceTime);

  return (
    <section className="ticket" aria-labelledby="ticket-title">
      <div className="ticket-main">
        <h2 id="ticket-title" className="ticket-heading" tabIndex={-1} ref={headingRef}>
          Your ticket
        </h2>
        <p className="ticket-number-label">Ticket number</p>
        <p className="ticket-number">{ticket.code}</p>
        <p className="ticket-service">{serviceName}</p>
        <p className="ticket-status">
          <span className={`status status-${ticket.status}`}>{statusLabel(ticket.status)}</span>
          {issuedAt && <span className="ticket-time">Issued at {issuedAt}</span>}
        </p>
      </div>

      <div className="perforation" aria-hidden="true" />

      <div className="ticket-stub">
        <p>Keep this number and watch the main display. A counter will call it when it's your turn.</p>
        {time && (
          <p className="ticket-note">
            Average time per customer for {serviceName}: {time}.
          </p>
        )}

        <div className="ticket-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Checking…' : 'Refresh status'}
          </button>
          <button type="button" className="button button-primary" onClick={onNewTicket}>
            Take another ticket
          </button>
        </div>

        <p className="ticket-notice" role="status">
          {notice}
        </p>
      </div>
    </section>
  );
}
