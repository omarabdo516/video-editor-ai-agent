# RS Reels Dashboard API

Local HTTP wrapper around `rs-reels.mjs` so the video pipeline can be driven
from a UI (dashboard-ui, arriving in session 3) without burning a Claude
session on every phase.

## Run

```bash
cd dashboard-api
npm install
npm run dev      # or: node server.mjs
```

Server listens on `http://localhost:7778` by default. Override with
`DASHBOARD_PORT`.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/health` | liveness probe |
| GET    | `/api/videos` | list tracked videos |
| POST   | `/api/videos` | add a video — body: `{ path, name?, lecturer?, workshop? }` |
| GET    | `/api/videos/:id` | video detail |
| DELETE | `/api/videos/:id` | forget a video (files on disk untouched) |
| POST   | `/api/videos/:id/phase1`       | run Phase 1 (preprocess) |
| POST   | `/api/videos/:id/transcribe`   | run transcribe + fix + snapshot (dry) |
| POST   | `/api/videos/:id/edit`         | return editor URL (no job) |
| POST   | `/api/videos/:id/micro-events` | run `scripts/generate_micro_events.mjs` |
| POST   | `/api/videos/:id/render`       | render the reel |
| GET    | `/api/progress/:jobId`         | SSE stream of stdout/stderr |
| POST   | `/api/videos/:id/rating`       | body: `{ rating: 1-5, note? }` — writes to state + `feedback/log.json` |

## State

Persisted to `dashboard-api/state/videos.json` (gitignored). Jobs are
in-memory only — they die with the server.

## Non-goals (this session)

No UI, no TypeScript, no batch, no Claude integration, no auth. All deferred
to Phase 11 sessions 3–6.
