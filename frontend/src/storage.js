// What the screens remember for the browser tab (not across tabs or visits).
// Storage can be unavailable (private mode), so every access is wrapped and the
// app works without it.

export const TICKET_ID_KEY = 'oqm.ticketId'; // the customer's ticket
export const COUNTER_ID_KEY = 'oqm.counterId'; // the counter an officer works at

export function readStored(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    // nothing to do: the page works without persistence
  }
}

export function clearScreenMemory() {
  writeStored(TICKET_ID_KEY, null);
  writeStored(COUNTER_ID_KEY, null);
}
