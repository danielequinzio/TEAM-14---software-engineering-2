import { describeError } from '../errors.js';

// An error with a way out. context says what was being done (see errors.js).
export default function ErrorNotice({ error, context, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{describeError(error, context)}</p>
      <button type="button" className="button button-secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
