// The five screens, in the order of the menu. The path is what follows "#/".
export const ROUTES = [
  { path: 'get-ticket', label: 'Get ticket', title: 'Get a ticket' },
  { path: 'next-customer', label: 'Next customer', title: 'Next customer' },
  { path: 'call-customer', label: 'Call customer', title: 'Now calling' },
  { path: 'stats', label: 'Stats', title: 'Statistics' },
  { path: 'config-counters', label: 'Config counters', title: 'Configure counters' },
];

export const DEFAULT_ROUTE = ROUTES[0].path;
