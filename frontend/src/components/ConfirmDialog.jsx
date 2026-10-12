import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatMinutes } from '../format.js';

// Asks the customer to confirm before a ticket is issued.
// Keyboard: focus starts on the confirm button, Tab stays inside the dialog,
// Escape cancels (unless a ticket is being issued), and focus returns to the
// button that opened it.
export default function ConfirmDialog({ service, busy, error, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    confirmRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // After a failed attempt the buttons are enabled again: put focus back on retry.
  useEffect(() => {
    if (error) confirmRef.current?.focus();
  }, [error]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [cancelRef.current, confirmRef.current].filter(
        (element) => element && !element.disabled,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!focusable.includes(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  const time = formatMinutes(service.service_time);

  // Rendered on document.body, outside the page, which is made inert while open.
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-text"
      >
        <h2 id="dialog-title" className="dialog-title">
          Get a ticket for {service.name}?
        </h2>
        <p id="dialog-text" className="dialog-text">
          You'll get a number and wait until a counter calls it.
          {time ? ` Average time per customer: ${time}.` : ''}
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p className="visually-hidden" role="status">
            Getting your ticket…
          </p>
        )}

        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="button button-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Getting your ticket…' : 'Get ticket'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
