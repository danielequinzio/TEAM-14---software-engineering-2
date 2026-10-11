import { useState } from 'react';
import { createCounter, getCounter, getCounters, getServices, updateCounterServices } from '../api.js';
import ErrorNotice from '../components/ErrorNotice.jsx';
import ScreenHead from '../components/ScreenHead.jsx';
import { describeError } from '../errors.js';
import { formatMinutes } from '../format.js';
import { useLoad } from '../hooks/useLoad.js';

async function loadAll(signal) {
  const [services, list] = await Promise.all([getServices({ signal }), getCounters({ signal })]);
  const counters = await Promise.all(list.map((counter) => getCounter(counter.id, { signal })));
  return { services, counters };
}

function ServiceChecklist({ legend, services, checked, onToggle, disabled }) {
  return (
    <fieldset className="checklist" disabled={disabled}>
      <legend className="field-label">{legend}</legend>
      {services.length === 0 && <p className="field-help">There are no services to choose from.</p>}
      {services.map((service) => (
        <label key={service.id} className="check">
          <input
            type="checkbox"
            checked={checked.includes(service.id)}
            onChange={() => onToggle(service.id)}
          />
          <span>
            {service.name} <span className="check-meta">{formatMinutes(service.service_time)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function toggled(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function CounterRow({ counter, services, onSaved }) {
  const current = (counter.services ?? []).map((item) => item.id);
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setChecked(current);
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateCounterServices(counter.id, checked);
      setEditing(false);
      onSaved(`Saved ${counter.name}.`);
    } catch (failure) {
      setError(describeError(failure, 'save-counter'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="counter-row">
      <div className="counter-head">
        <h3 className="counter-name">{counter.name}</h3>
        {!editing && (
          <button
            type="button"
            className="button button-secondary"
            aria-label={`Edit services of ${counter.name}`}
            onClick={startEdit}
          >
            Edit services
          </button>
        )}
      </div>

      {!editing && (
        <p className="counter-services">
          {current.length === 0
            ? 'No services yet.'
            : counter.services.map((item) => item.name).join(', ')}
        </p>
      )}

      {editing && (
        <>
          <ServiceChecklist
            legend={`Services of ${counter.name}`}
            services={services}
            checked={checked}
            onToggle={(id) => setChecked((list) => toggled(list, id))}
            disabled={saving}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="button button-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

// The manager's screen: see the counters, add one, choose which services each serves.
export default function ConfigCountersScreen() {
  const load = useLoad(loadAll);
  const { reload } = load;

  const [name, setName] = useState('');
  const [checked, setChecked] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  const services = load.data?.services ?? [];
  const counters = load.data?.counters ?? [];

  const handleSaved = (text) => {
    setMessage(text);
    reload();
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a name for the counter.');
      return;
    }
    setCreating(true);
    setFormError('');
    setMessage('');
    try {
      await createCounter(trimmed, checked);
      setName('');
      setChecked([]);
      handleSaved(`Added ${trimmed}.`);
    } catch (failure) {
      setFormError(describeError(failure, 'save-counter'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHead title="Configure counters">
        Add counters and choose which services each one can serve.
      </ScreenHead>

      {load.status === 'loading' && !load.data && (
        <p className="screen-status" role="status">
          Loading counters…
        </p>
      )}
      {load.status === 'error' && (
        <ErrorNotice error={load.error} context="counters" onRetry={reload} />
      )}

      <p className="banner" role="status" hidden={!message}>
        {message}
      </p>

      {load.data && (
        <div className="config-grid">
          <section className="card" aria-labelledby="counters-title">
            <h2 id="counters-title" className="card-title">
              Counters
            </h2>
            {counters.length === 0 ? (
              <p className="result-empty">No counters yet. Add the first one.</p>
            ) : (
              <ul className="counter-list">
                {counters.map((counter) => (
                  <CounterRow key={counter.id} counter={counter} services={services} onSaved={handleSaved} />
                ))}
              </ul>
            )}
          </section>

          <form className="card" onSubmit={handleCreate} noValidate aria-labelledby="add-title">
            <h2 id="add-title" className="card-title">
              Add a counter
            </h2>
            <label className="field">
              <span className="field-label">Name</span>
              <input
                type="text"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                disabled={creating}
              />
            </label>
            <ServiceChecklist
              legend="Services"
              services={services}
              checked={checked}
              onToggle={(id) => setChecked((list) => toggled(list, id))}
              disabled={creating}
            />
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="button button-primary" disabled={creating}>
              {creating ? 'Adding…' : 'Add counter'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
