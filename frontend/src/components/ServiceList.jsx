import { describeError } from '../errors.js';
import { formatMinutes } from '../format.js';

const SKELETON_ROWS = 3;

export default function ServiceList({ status, services, error, onSelect, onRetry }) {
  return (
    <section className="panel" aria-labelledby="services-title">
      <h2 id="services-title" className="panel-title">
        Available services
      </h2>

      {status === 'loading' && (
        <>
          <p className="visually-hidden" role="status">
            Loading services…
          </p>
          <ul className="service-list" aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li className="service-row" key={index}>
                <div>
                  <div className="skeleton-bar skeleton-name" />
                  <div className="skeleton-bar skeleton-meta" />
                </div>
                <div className="skeleton-bar skeleton-button" />
              </li>
            ))}
          </ul>
        </>
      )}

      {status === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>{describeError(error, 'services')}</p>
          <button type="button" className="button button-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && services.length === 0 && (
        <div className="notice">
          <p>No services are open right now. Ask at the front desk, or check again in a moment.</p>
          <button type="button" className="button button-secondary" onClick={onRetry}>
            Check again
          </button>
        </div>
      )}

      {status === 'ready' && services.length > 0 && (
        <ul className="service-list">
          {services.map((service) => {
            const time = formatMinutes(service.service_time);
            return (
              <li className="service-row" key={service.id}>
                <div>
                  <h3 className="service-name">{service.name}</h3>
                  {time && <p className="service-meta">Average time per customer: {time}</p>}
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  aria-label={`Get ticket for ${service.name}`}
                  onClick={() => onSelect(service)}
                >
                  Get ticket
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
