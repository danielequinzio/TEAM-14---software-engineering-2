# What the frontend needs from the backend

The Get ticket and Config counters screens use endpoints that already exist.
Next customer, Call customer and Stats need three endpoints the backend does
not have yet. The shapes below are what `src/api.js` expects; if the backend
team prefers another shape, only `api.js` (and the screens' reading of the
result) has to change.

Until they exist, those screens show "The queue system doesn't offer this yet".
In development, **Test mode** (bottom right) answers them with sample data
(`src/devtools/mockQueue.js`), so the screens can be tried and demonstrated.

## Already in the backend (used as is)

| Endpoint | Used by |
| --- | --- |
| `GET /services` | Get ticket, Config counters |
| `POST /ticket?service_id=` / `GET /ticket?ticket_id=` | Get ticket |
| `GET /counters`, `GET /counters/{id}` | Next customer, Config counters |
| `POST /counters?name=` (JSON array of service ids as body) | Config counters |
| `PUT /counters/{id}` (JSON array of service ids as body) | Config counters |

## Proposed

### `POST /counters/{counter_id}/next`

An officer calls the next customer. The server applies the rule from the
assignment: take the first ticket of the longest queue among the services of
this counter; on a tie, the service with the shorter service time; if nobody
waits, do nothing.

- 200 `{ "ticket": { "id", "service_id", "status": "serving", "created_at" } }`
- 200 `{ "ticket": null }` when nobody is waiting (nothing changes)
- 404 `{ "detail": "Counter not found" }`

The ticket the counter served before should become `done`.

### `GET /display`

For the waiting-room screen (Call customer).

```json
{
  "counters": [{ "id": 1, "name": "Counter 1", "current_ticket": { "id": 7, "service_id": 2 } }],
  "queues": [{ "service_id": 2, "name": "Accounts", "waiting": 3 }]
}
```

`current_ticket` is `null` when the counter is free.

### `GET /stats?period=day|week|month&date=YYYY-MM-DD`

For the manager. `date` is any day inside the period; the week runs Monday to
Sunday. "Served" means a ticket that a counter has called.

```json
{
  "period": "week", "from": "2026-10-05", "to": "2026-10-11", "total": 42,
  "by_service": [{ "service_id": 1, "name": "Shipping", "count": 20 }],
  "by_counter": [{ "counter_id": 1, "name": "Counter 1", "count": 25 }]
}
```
