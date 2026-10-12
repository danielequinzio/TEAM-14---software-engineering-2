import { useCallback, useEffect, useRef, useState } from 'react';
import { getServices } from '../api.js';

// Loads the service list. status: 'loading' | 'ready' | 'error'.
// reload() fetches again (used by "Try again" and after a 404 on ticket creation).
export function useServices() {
  const [state, setState] = useState({ status: 'loading', services: [], error: null });
  const controllerRef = useRef(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    getServices({ signal: controller.signal })
      .then((services) => setState({ status: 'ready', services, error: null }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setState({ status: 'error', services: [], error });
      });
  }, []);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
