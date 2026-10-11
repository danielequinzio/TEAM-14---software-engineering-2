import { useCallback, useEffect, useRef, useState } from 'react';

// Runs loader(signal) when it changes and when reload() is called.
// status: 'idle' (loader is null) | 'loading' | 'ready' | 'error'.
// The previous data is kept while loading again or after an error, so a screen
// can keep showing it (for example while the next period is loading).
// The loader must be stable (wrap it in useCallback).
// reloadSignal: when it grows, the data is loaded again (used by test mode).
export function useLoad(loader, reloadSignal = 0) {
  const [state, setState] = useState({
    status: loader ? 'loading' : 'idle',
    data: null,
    error: null,
  });
  const controllerRef = useRef(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    if (!loader) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data, error: null });
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        setState((previous) => ({ ...previous, status: 'error', error }));
      });
  }, [loader]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const seenSignal = useRef(reloadSignal);
  useEffect(() => {
    if (reloadSignal === seenSignal.current) return;
    seenSignal.current = reloadSignal;
    load();
  }, [reloadSignal, load]);

  return { ...state, reload: load };
}
