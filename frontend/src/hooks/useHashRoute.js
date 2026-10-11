import { useEffect, useState } from 'react';
import { DEFAULT_ROUTE, ROUTES } from '../routes.js';

// The current screen comes from the address ("#/stats"), so a reload or the
// browser's back button keeps the screen, and no router library is needed.
function readRoute() {
  const path = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES.some((route) => route.path === path) ? path : DEFAULT_ROUTE;
}

export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}
