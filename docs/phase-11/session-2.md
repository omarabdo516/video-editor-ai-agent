# Session 2 — Dashboard API Backend

> ✅ **خلصت 2026-04-15.** `dashboard-api/` جاهز — Express + CORS + SSE + persistent state في `state/videos.json`. الـ routes كلها شغّالة: videos (CRUD) + phases (phase1/transcribe/edit/micro-events/render/handoff) + progress (SSE) + rating + batch. State + jobs registry + ffprobe duration كلها متـ wired. Non-goals محافظ عليها (مفيش UI / TS / DB / auth).

## الهدف

Express server بـ TypeScript-free Node (just `.mjs`) بيعمل wrap للـ `rs-reels.mjs` CLI commands كـ HTTP routes. كل phase بيتحوّل لـ POST endpoint، مع SSE progress streaming، ومع state file بيحفظ حالة كل فيديو.

**Effort**: 3-4 ساعات

**Dependencies**: مفيش — session 2 مستقلة تماماً عن session 1.

**ملاحظة مهمة**: ده session 2 حتى لو session 1 ما اتعملتش. الـ API server مش بيعتمد على الـ corrections tracker.

---

## Files to Read (قبل أي تعديل)

1. `CLAUDE.md` — current state + commit rule
2. `rs-reels.mjs` — **كاملاً**:
   - Focus on: `runPhase1`, `transcribe`, `fixCaptions`, `speechRhythm`, `runEdit`, `renderRemotion`, `runPerformance`
   - افهم arguments كل subcommand + outputs
3. `package.json` (root) — available deps (notably express might need install)
4. `subtitle-editor/package.json` — reference sibling project structure
5. `docs/phase-1-preprocessing.md` + `docs/phase-2-transcription.md` — phase semantics
6. `docs/phase-8-render.md` — render phase semantics
7. `scripts/validate_plan.mjs` — how plan validation is currently exposed (we'll wrap it too)
8. `src/types.ts` — shared types (import where useful)

---

## Files to Create

### Folder structure
```
dashboard-api/
  package.json
  server.mjs                    ← entry point
  routes/
    videos.mjs                  ← GET/POST/DELETE /api/videos
    phases.mjs                  ← POST /api/videos/:id/:phase
    progress.mjs                ← GET  /api/progress/:jobId (SSE)
    rating.mjs                  ← POST /api/videos/:id/rating
  lib/
    state.mjs                   ← load/save .dashboard/videos.json
    jobs.mjs                    ← job registry + spawn wrapper
    paths.mjs                   ← helpers for per-video file paths
  state/
    videos.json                 ← persisted state (gitignored)
  README.md
```

### 1. `dashboard-api/package.json`
```json
{
  "name": "rs-reels-dashboard-api",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server.mjs",
    "dev": "node --watch server.mjs"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
}
```

### 2. `dashboard-api/server.mjs`
Express app with:
- JSON middleware
- CORS (allow `http://localhost:5174`)
- Mount the 4 route modules under `/api`
- Listen on `PORT=7778`
- Graceful shutdown on SIGINT

Shape:
```js
import express from 'express';
import cors from 'cors';
import { videosRouter } from './routes/videos.mjs';
import { phasesRouter } from './routes/phases.mjs';
import { progressRouter } from './routes/progress.mjs';
import { ratingRouter } from './routes/rating.mjs';
import { loadState } from './lib/state.mjs';

const PORT = process.env.DASHBOARD_PORT || 7778;
const app = express();
app.use(cors({ origin: 'http://localhost:5174' }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/videos', videosRouter);
app.use('/api/videos', phasesRouter);   // /:id/phase1, /:id/transcribe, ...
app.use('/api/progress', progressRouter);
app.use('/api/videos', ratingRouter);

// Ensure state loads on startup
loadState();

app.listen(PORT, () => console.log(`Dashboard API on http://localhost:${PORT}`));
```

### 3. `dashboard-api/lib/state.mjs`
In-memory state + persisted to `dashboard-api/state/videos.json`.

**State shape**:
```json
{
  "videos": [
    {
      "id": "muhammad-alaa-1",
      "path": "D:/Work/.../محمد علاء - ورشة المحاسب المالي.mp4",
      "name": "محمد علاء - ورشة المحاسب المالي",
      "addedAt": "2026-04-15T14:00:00Z",
      "duration_sec": 212.4,
      "phases": {
        "phase1":    { "status": "done", "startedAt": "...", "finishedAt": "...", "lastJobId": "abc123" },
        "transcribe":{ "status": "done", ... },
        "edit":      { "status": "pending" },
        "analyze":   { "status": "pending" },
        "microEvents": { "status": "pending" },
        "render":    { "status": "pending" }
      },
      "outputs": {
        "raw_captions": "<video>.captions.raw.json",
        "captions": "<video>.captions.json",
        "animation_plan": "src/data/<name>/animation_plan.json",
        "reel": "<video>-reel.mp4"
      },
      "rating": null,
      "notes": null
    }
  ]
}
```

**Exports**:
- `loadState(): State` — sync, reads from disk, creates file if missing
- `saveState(state)` — sync, writes to disk
- `getVideos(): Video[]`
- `getVideo(id)` 
- `addVideo({ path, name? }): Video` — generates ID, detects duration via ffprobe
- `updateVideoPhase(id, phase, patch)`
- `removeVideo(id)`

ID generation: slugify the name + ensure uniqueness. Example: `"محمد علاء - ورشة المحاسب المالي"` → `"muhammad-alaa-workshop-1"` (transliterate + dedupe with counter).

Duration detection: spawn `ffprobe -v quiet -show_entries format=duration -of default=nw=1:nk=1 <path>`.

### 4. `dashboard-api/lib/jobs.mjs`
Job registry for spawned processes with streaming output.

**Features**:
- `createJob(videoId, phase, cmd, args): { jobId, emitter }`
- Jobs stored in-memory `Map<jobId, Job>` — not persisted (jobs die with the server)
- Each job has:
  - `id`, `videoId`, `phase`, `status: 'running' | 'done' | 'failed' | 'cancelled'`
  - `startedAt`, `finishedAt?`
  - `exitCode?`
  - `lines: string[]` (buffered stdout + stderr, capped at 500 lines)
  - `subscribers: Set<Response>` (SSE clients)
- `runJob(job, cwd)` spawns the process, pipes stdout/stderr to lines + subscribers
- On exit: update state via `updateVideoPhase`, notify subscribers, keep job for 5 min then GC
- `subscribeToJob(jobId, res)` for SSE
- `getJob(jobId)` for queries

**Phase → command mapping** (central dictionary so routes stay thin):
```js
export const PHASE_COMMANDS = {
  phase1:     (video) => ({ cmd: 'node', args: ['rs-reels.mjs', 'phase1', video.path] }),
  transcribe: (video) => ({ cmd: 'node', args: ['rs-reels.mjs', 'make', video.path, '--lecturer', 'placeholder', '--workshop', 'placeholder', '--skip-audio', '--dry'] }),
  microEvents:(video) => ({ cmd: 'node', args: ['scripts/generate_micro_events.mjs', video.name] }),
  render:     (video) => ({ cmd: 'node', args: ['rs-reels.mjs', 'make', video.path, '--lecturer', video.lecturer || 'محاضر', '--workshop', video.workshop || 'RS', '--skip-audio', '--skip-transcribe'] }),
};
```

`cwd` for all spawns: the repo root (one level up from `dashboard-api/`).

### 5. `dashboard-api/routes/videos.mjs`
```
GET    /api/videos          → list all videos
POST   /api/videos          → body: { path, name?, lecturer?, workshop? } → adds + returns
GET    /api/videos/:id      → detail
DELETE /api/videos/:id      → remove from state (files on disk untouched)
```

### 6. `dashboard-api/routes/phases.mjs`
```
POST /api/videos/:id/phase1         → start Phase 1 job
POST /api/videos/:id/transcribe     → start Phase 2 job
POST /api/videos/:id/edit           → return editor URL (no job — just a URL)
POST /api/videos/:id/micro-events   → start micro events generation
POST /api/videos/:id/render         → start render
```

Each job-starting route:
1. Load video from state
2. Look up `PHASE_COMMANDS[phase](video)` → `{ cmd, args }`
3. `createJob(videoId, phase, cmd, args)` → `{ jobId }`
4. `runJob(job, repoRoot)` (async, non-blocking)
5. `updateVideoPhase(id, phase, { status: 'running', startedAt: new Date().toISOString(), lastJobId: jobId })`
6. Return `{ jobId, status: 'running' }`

### 7. `dashboard-api/routes/progress.mjs`
```
GET /api/progress/:jobId    → SSE stream
```

Server-Sent Events format:
```
event: line
data: {"text":"rendered 42/6521"}

event: done
data: {"exitCode":0}

event: error
data: {"message":"..."}
```

Flush headers immediately, subscribe to the job, stream lines as they arrive, close on done/error.

### 8. `dashboard-api/routes/rating.mjs`
```
POST /api/videos/:id/rating  → body: { rating: 1-5, note? }
```

Writes directly to the video's state AND appends a new entry to `feedback/log.json` (same format as the existing entries). This lets Omar rate from the dashboard without Claude.

### 9. `dashboard-api/README.md`
How to run:
```
cd dashboard-api
npm install
npm run dev    # or: node server.mjs
```

Environment:
- `DASHBOARD_PORT` (default 7778)
- `REPO_ROOT` — derived from `__dirname/..` — no env var needed

### 10. `dashboard-api/state/.gitkeep`
Empty file to ensure the folder exists in git.

---

## Files to Modify

### 1. `.gitignore`
Add:
```
# Dashboard state files — per-installation, not committed
dashboard-api/state/videos.json
dashboard-api/node_modules/
```

### 2. `package.json` (root)
Add scripts (don't add deps — the dashboard-api has its own package.json):
```json
{
  "scripts": {
    "dashboard:api": "node dashboard-api/server.mjs"
  }
}
```

---

## Success Criteria

- [ ] `cd dashboard-api && npm install` works clean
- [ ] `node dashboard-api/server.mjs` starts + prints "Dashboard API on http://localhost:7778"
- [ ] `curl http://localhost:7778/api/health` returns `{"ok":true}`
- [ ] `curl http://localhost:7778/api/videos` returns `{"videos":[]}` initially
- [ ] POST a video path → returns the new video object with auto-generated ID
- [ ] `curl http://localhost:7778/api/videos` now lists that video
- [ ] POST `/phase1` on that video → returns `{"jobId":"..."}`, phase status updates to "running"
- [ ] GET `/api/progress/:jobId` (SSE) streams real output from `rs-reels.mjs phase1`
- [ ] When phase1 finishes → status updates to "done" in state
- [ ] Kill server + restart → videos list persists (from state/videos.json)
- [ ] DELETE a video → gone from state (but files on disk untouched)
- [ ] Rating POST → writes to both the state file AND feedback/log.json

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ No React UI — that's session 3
- ❌ No TypeScript — keep it `.mjs` + JSDoc if needed
- ❌ No database — JSON file is the source of truth
- ❌ No authentication — localhost-only
- ❌ No batch mode — that's session 5
- ❌ No Claude integration — that's session 4
- ❌ No websockets — SSE only (simpler, sufficient for one-way progress)
- ❌ Don't touch `rs-reels.mjs` — the Dashboard wraps it, doesn't modify it
- ❌ Don't touch `subtitle-editor/` — the edit phase just returns the URL
- ❌ Don't change existing render behavior — just wrap it

---

## Commit Template

```
dashboard: API backend — Express wrapper over rs-reels CLI

Adds the first half of Phase 11: a local HTTP API that wraps every
rs-reels.mjs subcommand as a POST route with live SSE progress
streaming and a persistent state file for per-video phase status.

Why: today, Omar runs every phase through a Claude session which
burns tokens on script progress output and keeps Claude busy for
~30 min per video. The dashboard decouples script execution from
Claude thinking — Omar starts phases from a UI, Claude only enters
for Phase 5/6 analysis.

Structure:
  dashboard-api/
    server.mjs          Express + CORS + health
    lib/
      state.mjs         load/save state/videos.json (in-memory +
                        persistence)
      jobs.mjs          spawn wrapper + SSE registry + phase →
                        command dictionary
      paths.mjs         per-video file path helpers
    routes/
      videos.mjs        CRUD on tracked videos
      phases.mjs        POST /:id/{phase1,transcribe,microEvents,
                        render,edit}
      progress.mjs      GET /:jobId SSE stream
      rating.mjs        POST /:id/rating (writes state +
                        feedback/log.json)
    state/
      .gitkeep          (videos.json gitignored)
    README.md           run instructions
    package.json        express + cors

Root package.json gains `npm run dashboard:api`.
.gitignore gains dashboard-api/state/videos.json.

Non-goals (by design): no UI, no TypeScript, no batch, no Claude
integration — all deferred to sessions 3-5.

Context updates:
  - CLAUDE.md Next Up section (session 2 done, session 3 next)
  - docs/phase-11/session-2.md — marked complete if anything
    deviated from spec

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Spawn semantics on Windows**: استخدم `spawn` مع `shell: false` عشان تتفادى الـ EINVAL bug اللي ظهر في `doctor` command. الـ `cmd` لازم يبقى `'node'` (not `'node.exe'`) — الـ PATH resolution بيشتغل.
- **ffprobe for duration**: استخدم الـ path `C:/ffmpeg/bin/ffprobe.exe` اللي مستخدم في rs-reels.mjs
- **ID generation**: keep it simple. For arabic names, strip non-ASCII and add a counter if duplicate. Example: `محمد علاء → 'video-1'`, `محمد ريان → 'video-2'`. Uniqueness matters more than readability (the UI will show the full `name` anyway).
- **State file location**: `dashboard-api/state/videos.json` (not in repo root, not in .claude).
- **Avoid reading big files into memory**: when serving logs, only keep the last 500 lines in memory; don't buffer entire script output.
- **لا تكسر الـ subtitle editor**: الـ `/edit` route مش بيشغّل أي شيء — فقط بيرجّع URL للـ editor (اللي شغّال على port 5173 منفصل). الـ user بيفتح الـ URL يدوياً أو الـ UI بتفتحه في window جديدة.
