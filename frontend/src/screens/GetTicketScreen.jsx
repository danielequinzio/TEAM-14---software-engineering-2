import { useCallback, useEffect, useState } from 'react';
import { createTicket, getTicket } from '../api.js';
import ServiceList from '../components/ServiceList.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import TicketView from '../components/TicketView.jsx';
import { describeError } from '../errors.js';
import { formatTime, statusLabel } from '../format.js';
import { useServices } from '../hooks/useServices.js';
import { readStored, TICKET_ID_KEY, writeStored } from '../storage.js';

// The customer screen: pick a service, confirm, get the ticket.
// onModalChange(true|false) tells the page when the confirm dialog is open, so
// the rest of the page can be made inert while it is.
// reloadSignal: when it grows, the service list is loaded again (used by test mode).
export default function GetTicketScreen({ onModalChange, reloadSignal = 0 }) {
  const { status, services, error, reload } = useServices();

  const [ticket, setTicket] = useState(null);
  const [restoring, setRestoring] = useState(() => readStored(TICKET_ID_KEY) !== null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (reloadSignal > 0) reload();
  }, [reloadSignal, reload]);

  useEffect(() => {
    onModalChange?.(selected !== null);
  }, [selected, onModalChange]);

  useEffect(() => () => onModalChange?.(false), [onModalChange]);

  // Restore the ticket of this tab after a reload.
  useEffect(() => {
    const id = readStored(TICKET_ID_KEY);
    if (id === null) return undefined;

    const controller = new AbortController();
    getTicket(id, { signal: controller.signal })
      .then((restored) => setTicket(restored))
      .catch((restoreError) => {
        if (restoreError?.name === 'AbortError') return;
        if (restoreError?.kind === 'not-found') writeStored(TICKET_ID_KEY, null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRestoring(false);
      });

    return () => controller.abort();
  }, []);

  const handleSelect = useCallback((service) => {
    setCreateError('');
    setSelected(service);
  }, []);

  const handleCancel = useCallback(() => {
    if (!creating) setSelected(null);
  }, [creating]);

  const handleConfirm = async () => {
    if (!selected || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await createTicket(selected.id);
      writeStored(TICKET_ID_KEY, created.id);
      setTicket(created);
      setNotice('');
      setSelected(null);
    } catch (failure) {
      setCreateError(describeError(failure, 'create'));
      // The service may have been removed: show the current list again.
      if (failure?.kind === 'not-found') reload();
    } finally {
      setCreating(false);
    }
  };

  const handleRefresh = async () => {
    if (!ticket || refreshing) return;
    setRefreshing(true);
    try {
      const fresh = await getTicket(ticket.id);
      setTicket(fresh);
      setNotice(
        `Checked at ${formatTime(new Date().toISOString())}. Status: ${statusLabel(fresh.status)}.`,
      );
    } catch (failure) {
      setNotice(describeError(failure, 'ticket'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleNewTicket = () => {
    writeStored(TICKET_ID_KEY, null);
    setTicket(null);
    setNotice('');
  };

  const ticketService = ticket ? services.find((item) => item.id === ticket.service_id) : null;

  let panel;
  if (restoring) {
    panel = (
      <p className="restoring" role="status">
        Looking for your ticket…
      </p>
    );
  } else if (ticket) {
    panel = (
      <TicketView
        ticket={ticket}
        serviceName={ticketService?.name ?? `Service ${ticket.service_id}`}
        serviceTime={ticketService?.service_time}
        notice={notice}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onNewTicket={handleNewTicket}
      />
    );
  } else {
    panel = (
      <ServiceList
        status={status}
        services={services}
        error={error}
        onSelect={handleSelect}
        onRetry={reload}
      />
    );
  }

  return (
    <>
      <div className="layout">
        <section className="intro">
          <h1 id="page-title" className="intro-title" tabIndex={-1}>
            Pick a service, get your number
          </h1>
          <p className="intro-lead">
            Tell us what you need. You'll get a ticket and be called to the right counter.
          </p>
          <ol className="steps">
            <li>Choose a service.</li>
            <li>Take your number.</li>
            <li>Wait for it to appear on the main display.</li>
          </ol>
        </section>

        <div className="dispenser">
          <div className="dispenser-slot" aria-hidden="true" />
          <div className="dispenser-out">{panel}</div>
        </div>
      </div>

      {selected && (
        <ConfirmDialog
          service={selected}
          busy={creating}
          error={createError}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
