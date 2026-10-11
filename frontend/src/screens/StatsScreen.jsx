import { useCallback, useState } from 'react';
import { getStats } from '../api.js';
import ErrorNotice from '../components/ErrorNotice.jsx';
import ScreenHead from '../components/ScreenHead.jsx';
import { useLoad } from '../hooks/useLoad.js';

const PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDay(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function rangeText(stats) {
  if (!stats) return '';
  return stats.from === stats.to
    ? formatDay(stats.from)
    : `${formatDay(stats.from)} to ${formatDay(stats.to)}`;
}

function Bars({ rows, labelKey, idKey }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row[idKey]} className="bars-row">
          <span className="bars-label">{row[labelKey]}</span>
          <span className="bars-track" aria-hidden="true">
            <span className="bars-fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="bars-count">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

// The manager's view: customers served per service and per counter, for a day,
// the week or the month that contains the chosen date.
export default function StatsScreen({ reloadSignal = 0 }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(todayString);

  const loader = useCallback((signal) => getStats(period, date, { signal }), [period, date]);
  const stats = useLoad(loader, reloadSignal);
  const data = stats.data;

  return (
    <div className="screen">
      <ScreenHead title="Statistics">
        How many customers were served, by service and by counter.
      </ScreenHead>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Period">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="segmented-button"
              aria-pressed={period === item.id}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="field field-inline">
          <span className="field-label">Date</span>
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
        </label>
      </div>

      {stats.status === 'error' && (
        <ErrorNotice error={stats.error} context="stats" onRetry={stats.reload} />
      )}
      {stats.status === 'loading' && !data && (
        <p className="screen-status" role="status">
          Loading statistics…
        </p>
      )}

      {data && (
        <section className="card" aria-labelledby="stats-total" aria-busy={stats.status === 'loading'}>
          <p className="stats-range">{rangeText(data)}</p>
          <p className="stats-total">
            <span id="stats-total" className="stats-number">
              {data.total}
            </span>{' '}
            {data.total === 1 ? 'customer served' : 'customers served'}
          </p>

          {data.total === 0 ? (
            <p className="result-empty">Nobody was served in this period.</p>
          ) : (
            <div className="stats-columns">
              <div>
                <h2 className="card-title">By service</h2>
                <Bars rows={data.by_service ?? []} labelKey="name" idKey="service_id" />
              </div>
              <div>
                <h2 className="card-title">By counter</h2>
                <Bars rows={data.by_counter ?? []} labelKey="name" idKey="counter_id" />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
