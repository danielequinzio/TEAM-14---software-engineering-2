import { useEffect, useRef, useState } from 'react';
import { useHashRoute } from './hooks/useHashRoute.js';
import { ROUTES } from './routes.js';
import CallCustomerScreen from './screens/CallCustomerScreen.jsx';
import ConfigCountersScreen from './screens/ConfigCountersScreen.jsx';
import GetTicketScreen from './screens/GetTicketScreen.jsx';
import NextCustomerScreen from './screens/NextCustomerScreen.jsx';
import StatsScreen from './screens/StatsScreen.jsx';
// >>> TEST MODE (temporary): delete these two lines, the <TestBar> block below and the src/devtools folder <<<
import { clearScreenMemory } from './storage.js';
import TestBar from './devtools/TestBar.jsx';
// >>> END TEST MODE <<<

const SCREENS = {
  'get-ticket': GetTicketScreen,
  'next-customer': NextCustomerScreen,
  'call-customer': CallCustomerScreen,
  stats: StatsScreen,
  'config-counters': ConfigCountersScreen,
};

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#14213d" />
      <path
        d="M8 9h16a1 1 0 0 1 1 1v3.2a2.8 2.8 0 0 0 0 5.6V22a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-3.2a2.8 2.8 0 0 0 0-5.6V10a1 1 0 0 1 1-1z"
        fill="#ffb400"
      />
    </svg>
  );
}

export default function App() {
  const route = useHashRoute();
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const firstRender = useRef(true);

  const current = ROUTES.find((item) => item.path === route);
  const Screen = SCREENS[route];

  // The tab title follows the screen, and a screen change moves focus to the
  // new heading so keyboard and screen-reader users start at the top of it.
  useEffect(() => {
    document.title = `${current.title} · Office Queue`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [current]);

  return (
    <>
      <div className="page" inert={modalOpen ? '' : undefined}>
        <header className="site-header">
          <p className="brand">
            <BrandMark />
            Office Queue
          </p>
          <nav className="site-nav" aria-label="Screens">
            <ul>
              {ROUTES.map((item) => (
                <li key={item.path}>
                  <a
                    href={`#/${item.path}`}
                    className="site-nav-link"
                    aria-current={item.path === route ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main>
          <Screen
            key={`${route}:${resetKey}`}
            reloadSignal={reloadSignal}
            onModalChange={setModalOpen}
          />
        </main>
      </div>

      {/* >>> TEST MODE (temporary): delete this block, the two imports above and the src/devtools folder <<< */}
      <TestBar
        onReload={() => setReloadSignal((value) => value + 1)}
        onReset={() => {
          clearScreenMemory();
          setModalOpen(false);
          setResetKey((value) => value + 1);
        }}
      />
      {/* >>> END TEST MODE <<< */}
    </>
  );
}
