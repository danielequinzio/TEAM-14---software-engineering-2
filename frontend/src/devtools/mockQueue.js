// TEST MODE (temporary, development only).
//
// The fake of the queue endpoints the real backend does not have yet
// (counters CRUD is there; next customer, display and stats are proposals, see
// API-NEEDS.md). mockBackend.js hands matching requests to this file.
//
// Tickets are the ones from the Get ticket mock (sessionStorage "oqm.testTickets"),
// so a ticket taken on the Get ticket screen shows up in the queue, can be called
// on Next customer, appears on Call customer and is counted in Stats.

const QUEUE_KEY = 'oqm.testQueue';
const TICKETS_KEY = 'oqm.testTickets';
const HISTORY_DAYS = 45;

const SEED_COUNTERS = [
  { id: 1, name: 'Counter 1', service_ids: [1, 2] },
  { id: 2, name: 'Counter 2', service_ids: [2, 3] },
  { id: 3, name: 'Counter 3', service_ids: [4] },
];

// ---------- storage ----------

function read(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable: the mock still works for this page load
  }
}

function loadQueue() {
  try {
    const saved = JSON.parse(read(QUEUE_KEY));
    if (saved && Array.isArray(saved.counters)) return saved;
  } catch {
    // fall through to the seed
  }
  return { counters: SEED_COUNTERS.map((counter) => ({ ...counter })) };
}

function saveQueue(queue) {
  write(QUEUE_KEY, JSON.stringify(queue));
}

function loadTickets() {
  try {
    const tickets = JSON.parse(read(TICKETS_KEY) ?? '[]');
    return Array.isArray(tickets) ? tickets : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  write(TICKETS_KEY, JSON.stringify(tickets));
}

export function resetMockQueue() {
  write(QUEUE_KEY, null);
}

// ---------- helpers ----------

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseBody(body) {
  try {
    return typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

function counterView(counter, services) {
  return {
    id: counter.id,
    name: counter.name,
    services: counter.service_ids
      .map((id) => services.find((service) => service.id === id))
      .filter(Boolean),
  };
}

// Same checks as the real backend: a list of known service ids.
function validIds(ids, services) {
  return (
    Array.isArray(ids) &&
    ids.every((id) => Number.isInteger(id) && services.some((service) => service.id === id))
  );
}

export function isMockQueueRoute(pathname) {
  return /\/(counters(\/\d+(\/next)?)?|display|stats)$/.test(pathname);
}

// ---------- dates (local) ----------

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function periodRange(period, date) {
  if (period === 'day') return [dateString(date), dateString(date)];
  if (period === 'week') {
    const offset = (date.getDay() + 6) % 7; // Monday first
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return [dateString(monday), dateString(sunday)];
  }
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return [dateString(first), dateString(last)];
}

// ---------- history (made up, always the same) ----------

// 45 days of served customers before today: [{ date, service_id, counter_id, count }].
function history() {
  let seed = 14;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const rows = [];
  const today = new Date();
  for (let back = 1; back <= HISTORY_DAYS; back += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    SEED_COUNTERS.forEach((counter) => {
      counter.service_ids.forEach((serviceId) => {
        const count = weekend ? 0 : Math.floor(next() * 9) + 2;
        if (count > 0) {
          rows.push({ date: dateString(day), service_id: serviceId, counter_id: counter.id, count });
        }
      });
    });
  }
  return rows;
}

function servedToday(tickets) {
  return tickets
    .filter((ticket) => ticket.called_at)
    .map((ticket) => ({
      date: dateString(new Date(`${ticket.called_at}Z`)),
      service_id: ticket.service_id,
      counter_id: ticket.counter_id,
      count: 1,
    }));
}

// ---------- endpoints ----------

function nextCustomer(counterId, queue, services) {
  const counter = queue.counters.find((item) => item.id === counterId);
  if (!counter) return json({ detail: 'Counter not found' }, 404);

  const tickets = loadTickets();
  const waiting = tickets.filter(
    (ticket) => ticket.status === 'waiting' && counter.service_ids.includes(ticket.service_id),
  );
  if (waiting.length === 0) return json({ ticket: null });

  // The rule from the assignment: longest queue first; on a tie, the service
  // with the shorter service time; inside a queue, the oldest ticket.
  const length = (serviceId) => waiting.filter((ticket) => ticket.service_id === serviceId).length;
  const time = (serviceId) => services.find((service) => service.id === serviceId)?.service_time ?? 0;
  const serviceId = [...new Set(waiting.map((ticket) => ticket.service_id))].sort(
    (a, b) => length(b) - length(a) || time(a) - time(b) || a - b,
  )[0];
  const chosen = waiting.filter((ticket) => ticket.service_id === serviceId).sort((a, b) => a.id - b.id)[0];

  const calledAt = new Date().toISOString().replace('Z', '');
  const updated = tickets.map((ticket) => {
    if (ticket.status === 'serving' && ticket.counter_id === counterId) {
      return { ...ticket, status: 'done' }; // the previous customer is finished
    }
    if (ticket.id === chosen.id) {
      return { ...ticket, status: 'serving', counter_id: counterId, called_at: calledAt };
    }
    return ticket;
  });
  saveTickets(updated);

  const { id, service_id, status, created_at } = updated.find((ticket) => ticket.id === chosen.id);
  return json({ ticket: { id, service_id, status, created_at } });
}

function display(queue, services) {
  const tickets = loadTickets();
  return json({
    counters: queue.counters.map((counter) => {
      const current = tickets.find(
        (ticket) => ticket.status === 'serving' && ticket.counter_id === counter.id,
      );
      return {
        id: counter.id,
        name: counter.name,
        current_ticket: current ? { id: current.id, service_id: current.service_id } : null,
      };
    }),
    queues: services.map((service) => ({
      service_id: service.id,
      name: service.name,
      waiting: tickets.filter((ticket) => ticket.status === 'waiting' && ticket.service_id === service.id)
        .length,
    })),
  });
}

function stats(url, queue, services) {
  const period = url.searchParams.get('period');
  const date = parseDay(url.searchParams.get('date'));
  if (!['day', 'week', 'month'].includes(period) || !date) {
    return json({ detail: [{ msg: 'Invalid period or date' }] }, 422);
  }
  const [from, to] = periodRange(period, date);
  const rows = [...history(), ...servedToday(loadTickets())].filter(
    (row) => row.date >= from && row.date <= to,
  );

  const sum = (key) => {
    const totals = new Map();
    rows.forEach((row) => totals.set(row[key], (totals.get(row[key]) ?? 0) + row.count));
    return totals;
  };
  const byService = [...sum('service_id')].map(([id, count]) => ({
    service_id: id,
    name: services.find((service) => service.id === id)?.name ?? `Service ${id}`,
    count,
  }));
  const byCounter = [...sum('counter_id')].map(([id, count]) => ({
    counter_id: id,
    name: queue.counters.find((counter) => counter.id === id)?.name ?? `Counter ${id}`,
    count,
  }));
  const byCount = (a, b) => b.count - a.count;

  return json({
    period,
    from,
    to,
    total: rows.reduce((total, row) => total + row.count, 0),
    by_service: byService.sort(byCount),
    by_counter: byCounter.sort(byCount),
  });
}

// url: URL; body: the raw request body; services: the service list of the Get ticket mock.
export function handleMockQueueRoute(url, method, body, services) {
  const queue = loadQueue();
  const path = url.pathname;

  if (/\/display$/.test(path) && method === 'GET') return display(queue, services);
  if (/\/stats$/.test(path) && method === 'GET') return stats(url, queue, services);

  const next = /\/counters\/(\d+)\/next$/.exec(path);
  if (next && method === 'POST') return nextCustomer(Number(next[1]), queue, services);

  const single = /\/counters\/(\d+)$/.exec(path);
  if (single) {
    const counter = queue.counters.find((item) => item.id === Number(single[1]));
    if (!counter) return json({ detail: 'Counter not found' }, 404);
    if (method === 'GET') return json(counterView(counter, services));
    if (method === 'PUT') {
      const ids = parseBody(body);
      if (!validIds(ids, services)) {
        return json({ detail: 'Unknown service id in service_ids' }, 422);
      }
      counter.service_ids = [...new Set(ids)];
      saveQueue(queue);
      return json(counterView(counter, services));
    }
  }

  if (/\/counters$/.test(path)) {
    if (method === 'GET') {
      return json(queue.counters.map(({ id, name }) => ({ id, name })));
    }
    if (method === 'POST') {
      const name = (url.searchParams.get('name') ?? '').trim();
      if (!name) return json({ detail: [{ msg: 'String should have at least 1 character' }] }, 422);
      if (queue.counters.some((counter) => counter.name === name)) {
        return json({ detail: 'Counter name already exists' }, 409);
      }
      const ids = parseBody(body);
      if (!validIds(ids, services)) {
        return json({ detail: 'Unknown service id in service_ids' }, 422);
      }
      const created = {
        id: Math.max(0, ...queue.counters.map((counter) => counter.id)) + 1,
        name,
        service_ids: [...new Set(ids)],
      };
      queue.counters.push(created);
      saveQueue(queue);
      return json({ id: created.id, name: created.name }, 201);
    }
  }

  return json({ detail: 'Method Not Allowed' }, 405);
}

// Puts a few waiting customers in the queue so Next customer has someone to call.
export function addMockWaitingCustomers(services) {
  const plan = [
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 1],
  ];
  const tickets = loadTickets();
  let id = Math.max(0, ...tickets.map((ticket) => ticket.id));
  plan.forEach(([serviceId, count]) => {
    if (!services.some((service) => service.id === serviceId)) return;
    for (let index = 0; index < count; index += 1) {
      id += 1;
      tickets.push({
        id,
        service_id: serviceId,
        status: 'waiting',
        created_at: new Date().toISOString().replace('Z', ''),
      });
    }
  });
  saveTickets(tickets);
  return id;
}
