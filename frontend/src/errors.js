// True when the server does not have the endpoint at all (FastAPI answers an
// unknown path with the detail "Not Found"), as opposed to "Counter not found".
export function isUnavailable(error) {
  return error?.kind === 'not-found' && error?.message === 'Not Found';
}

// Turns an ApiError into a sentence a customer can act on.
// context: 'services' | 'create' | 'ticket' | 'counters' | 'save-counter'
//        | 'next' | 'display' | 'stats'
export function describeError(error, context) {
  const kind = error?.kind ?? 'server';

  if (kind === 'network') {
    return "We can't reach the queue system. Check your connection and try again.";
  }
  if (isUnavailable(error)) {
    return "The queue system doesn't offer this yet. Try again later.";
  }
  if (kind === 'not-found' && context === 'create') {
    return "That service isn't available anymore. The list was refreshed, so choose again.";
  }
  if (kind === 'not-found' && context === 'ticket') {
    return "We couldn't find that ticket. Take a new one from the list.";
  }
  if (kind === 'not-found' && (context === 'next' || context === 'save-counter')) {
    return "That counter doesn't exist anymore. Choose a counter again.";
  }
  if (kind === 'conflict' && context === 'save-counter') {
    return 'A counter with that name already exists. Choose another name.';
  }
  if (kind === 'invalid' && context === 'save-counter') {
    return 'One of the chosen services is not available anymore. Reload the list and try again.';
  }
  if (kind === 'invalid') {
    return 'That request was not accepted. Try again.';
  }
  if (context === 'create') {
    return "We couldn't issue your ticket. Try again in a moment.";
  }
  if (context === 'save-counter') {
    return "We couldn't save the counter. Try again in a moment.";
  }
  if (context === 'next') {
    return "We couldn't call the next customer. Try again in a moment.";
  }
  return 'The queue system had a problem. Try again in a moment.';
}
