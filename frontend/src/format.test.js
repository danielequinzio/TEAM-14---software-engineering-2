import { describe, expect, it } from 'vitest';
import { formatMinutes, parseApiDate, statusLabel } from './format.js';

describe('parseApiDate', () => {
  it('reads a timestamp without a timezone as UTC', () => {
    expect(parseApiDate('2026-10-10T09:15:30.123456').toISOString()).toBe('2026-10-10T09:15:30.123Z');
  });

  it('keeps an explicit timezone', () => {
    expect(parseApiDate('2026-10-10T09:15:30Z').toISOString()).toBe('2026-10-10T09:15:30.000Z');
    expect(parseApiDate('2026-10-10T11:15:30+02:00').toISOString()).toBe('2026-10-10T09:15:30.000Z');
  });

  it('returns null for missing or invalid values', () => {
    expect(parseApiDate(undefined)).toBeNull();
    expect(parseApiDate('not a date')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('formats numbers and ignores invalid input', () => {
    expect(formatMinutes(5)).toBe('5 min');
    expect(formatMinutes('10')).toBe('10 min');
    expect(formatMinutes(undefined)).toBe('');
  });
});

describe('statusLabel', () => {
  it('maps the backend statuses and passes unknown ones through', () => {
    expect(statusLabel('waiting')).toBe('Waiting');
    expect(statusLabel('serving')).toBe('Being served');
    expect(statusLabel('done')).toBe('Done');
    expect(statusLabel('paused')).toBe('paused');
  });
});
