import { useCallback, useState } from 'react';
import { callNextCustomer, getCounter, getCounters } from '../api.js';
import ErrorNotice from '../components/ErrorNotice.jsx';
import ScreenHead from '../components/ScreenHead.jsx';
import { describeError } from '../errors.js';
import { formatMinutes } from '../format.js';
import { useLoad } from '../hooks/useLoad.js';
import { COUNTER_ID_KEY, readStored, writeStored } from '../storage.js';

// The officer's screen: choose the counter you work at, then call the next customer.
// The server decides who is next (the longest queue among the counter's services).
export default function NextCustomerScreen({ reloadSignal = 0 }) {
  const counters = useLoad(getCounters, reloadSignal);
  const [counterId, setCounterId] = useState(() => readStored(COUNTER_ID_KEY) ?? '');

  const loadCounter = useCallback(
    counterId === '' ? null : (signal) => getCounter(counterId, { signal }),
    [counterId],
  );
  const detail = useLoad(loadCounter, reloadSignal);

  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState(null);
  const [result, setResult] = useState(null); // { ticket, serviceName } | { ticket: null }

  const choose = (event) => {
    const value = event.target.value;
    setCounterId(value);
    writeStored(COUNTER_ID_KEY, value === '' ? null : value);
    setResult(null);
    setCallError(null);
  };

  const handleCall = async () => {
    if (calling || counterId === '') return;
    setCalling(true);
    setCallError(null);
    try {
      const answer = await callNextCustomer(counterId);
      const ticket = answer?.ticket ?? null;
      const service = detail.data?.services?.find((item) => item.id === ticket?.service_id);
      setResult(
        ticket ? { ticket, serviceName: service?.name ?? `Service ${ticket.service_id}` } : { ticket: null },
      );
    } catch (failure) {
      setResult(null);
      setCallError(failure);
      if (failure?.kind === 'not-found' && failure.message === 'Counter not found') {
        writeStored(COUNTER_ID_KEY, null);
        setCounterId('');
        counters.reload();
      }
    } finally {
      setCalling(false);
    }
  };

  const list = counters.data ?? [];
  const services = detail.data?.services ?? [];

  return (
    <div className="screen">
      <ScreenHead title="Next customer">
        Choose your counter, then call the next person in line.
      </ScreenHead>

      {counters.status === 'loading' && !counters.data && (
        <p className="screen-status" role="status">
          Loading counters…
        </p>
      )}
      {counters.status === 'error' && (
        <ErrorNotice error={counters.error} context="counters" onRetry={counters.reload} />
      )}

      {counters.data && list.length === 0 && (
        <div className="notice">
          <p>No counters are set up yet. Create one first.</p>
          <a className="button button-secondary" href="#/config-counters">
            Go to Config counters
          </a>
        </div>
      )}

      {list.length > 0 && (
        <section className="card" aria-labelledby="next-title">
          <h2 id="next-title" className="card-title">
            Your counter
          </h2>

          <label className="field">
            <span className="field-label">Counter</span>
            <select value={counterId} onChange={choose}>
              <option value="">Choose a counter…</option>
              {list.map((counter) => (
                <option key={counter.id} value={String(counter.id)}>
                  {counter.name}
                </option>
              ))}
            </select>
          </label>

          {counterId !== '' && detail.status === 'error' && (
            <ErrorNotice error={detail.error} context="counters" onRetry={detail.reload} />
          )}

          {counterId !== '' && detail.data && (
            <>
              <p className="field-help">
                {services.length === 0
                  ? 'This counter has no services yet.'
                  : 'Serves: ' + services.map((item) => `${item.name} (${formatMinutes(item.service_time)})`).join(', ') + '.'}
              </p>

              <button
                type="button"
                className="button button-primary button-large"
                onClick={handleCall}
                disabled={calling || services.length === 0}
              >
                {calling ? 'Calling…' : 'Call next customer'}
              </button>
            </>
          )}

          {callError && (
            <ErrorNotice error={callError} context="next" onRetry={handleCall} />
          )}

          <div className="result" role="status">
            {result?.ticket && (
              <div className="called">
                <p className="called-label">Now serving</p>
                <p className="called-number">{result.ticket.id}</p>
                <p className="called-service">{result.serviceName}</p>
              </div>
            )}
            {result && result.ticket === null && (
              <p className="result-empty">No one is waiting for this counter's services.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
