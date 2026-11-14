# ASTRA-MED Telemetry Backend

This is a dependency-free Node.js backend designed to replace the Firebase dependency in the supplied ASTRA-MED frontend.

## Run

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `node server.js`.
4. Open `http://localhost:3000`.

Optional API protection:

```bash
API_KEY=change-me node server.js
```

## API

- `GET /api/health`
- `GET /api/crew`
- `GET /api/crew/:id`
- `PUT /api/crew/:id`
- `POST /api/crew/reset`
- `GET /api/mission-control`
- `PUT /api/mission-control`
- `POST /api/logs`
- `GET /api/events` (Server-Sent Events)

State is persisted in `data/state.json`.

## Important frontend note

The supplied HTML contains literal `<!-- ... existing code ... -->` placeholders and references frontend functions that are not present in the uploaded file. The backend API is complete and the connector is included, but the UI file must be restored to its complete source before every frontend interaction can be wired end-to-end.
