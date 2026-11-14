# Connect the supplied frontend

Your uploaded HTML is only a partial extract: it contains literal `<!-- ... existing code ... -->` markers and several functions referenced by the backend section are not present in the uploaded source. The backend below is therefore built as a drop-in service for the complete frontend rather than pretending those missing UI functions exist.

## Replace Firebase

In the complete frontend, replace the current Firebase import/backend block with `public/js/backend-module.js`.

The replacement keeps these frontend calls compatible:

- `initCloudBackend()`
- `syncCrewMemberToBackend(member)`
- `syncMissionControlToBackend(extraLogEntry)`
- `pushFullStateToBackend(notify)`
- `resetBackendDatabase()`
- `updateBackendJsonPreview()`

## Backend transport

- REST for reads/writes.
- Server-Sent Events for real-time crew and mission-control updates.
- JSON file persistence for the competition/demo environment.
- Optional API key protection via `API_KEY` environment variable.

## Production upgrade

For a production deployment, replace `data/state.json` with PostgreSQL/Firestore and put the server behind HTTPS. Keep the same REST/SSE contract so the frontend does not need another rewrite.
