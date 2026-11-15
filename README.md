# ASTRA-MED — Astronaut Health Monitoring Prototype

ASTRA-MED is a browser-based astronaut health-monitoring and mission decision-support prototype. It combines a complete dashboard frontend with a dependency-free Node.js backend and a NASA Open Science Data Repository (OSDR) research-data connection.

## Run locally

1. Install Node.js 18+.
2. Open a terminal in the ASTRA-MED project folder.
3. Run `npm start` (or `node server.js`).
4. Open `http://localhost:3000`.

The backend creates its persistent state file at `data/state.json` when the server first starts if it does not already exist.

Optional API protection:

```bash
API_KEY=change-me node server.js
```

## Backend API

- `GET /api/health`
- `GET /api/crew`
- `GET /api/crew/:id`
- `PUT /api/crew/:id`
- `POST /api/crew/reset`
- `GET /api/mission-control`
- `PUT /api/mission-control`
- `POST /api/logs`
- `GET /api/events` (Server-Sent Events)
- `GET /api/nasa/osd-575` (NASA OSDR study metadata proxy)

## Frontend

The complete dashboard is served from `public/index.html`. The frontend uses the backend connector modules in `public/js/` for crew synchronization, mission-control persistence, event streaming, and NASA OSDR metadata retrieval.

The original dashboard source is also preserved in the repository as `astronaut_health_telemetry_dashboard_2026_nasa_space_apps.html`.

## NASA OSDR integration

ASTRA-MED retrieves metadata from NASA Open Science Data Repository study OSD-575 through the Node.js backend. The dashboard presents assay and sample metadata in the Mission Brief view.

The OSDR information is historical research data and metadata, not live astronaut telemetry or real-time clinical measurements. The crew telemetry displayed by the prototype is simulated.

## Prototype scope

ASTRA-MED is a demonstration prototype. Its simulated telemetry, anomaly workflows, and decision-support interface are intended to demonstrate software concepts and are not a clinically validated or flight-ready medical system.
