// The backend stores timestamps in UTC but SQLite drops the timezone, so a
// ticket can come back as "2026-10-10T09:15:30.123456" (no "Z"). Without a
// designator JavaScript would read it as local time, so UTC is assumed here.
export function parseApiDate(value) {
  if (!value) return null;
  const text = String(value);
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const date = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value) {
  const date = parseApiDate(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return '';
  return `${value} min`;
}

const STATUS_LABELS = {
  waiting: 'Waiting',
  serving: 'Being served',
  done: 'Done',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? String(status ?? '');
}
