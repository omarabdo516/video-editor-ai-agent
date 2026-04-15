# Session 5 — Bulk Mode

## الهدف

Multi-select في الـ Dashboard UI + batch runner على الـ backend عشان Omar يقدر يشغّل phase واحدة على 10 فيديوهات بضغطة زرار. الـ runner بيشغّلهم **sequential** (مش parallel — GPU واحد).

**Effort**: 2-3 ساعات

**Dependencies**: **Session 4 لازم تكون خلصت**. الـ UI كامل + الـ API routes شغّالة. ده بس بيضيف selection + batch queue layer.

---

## Files to Read

1. `CLAUDE.md`
2. `docs/phase-11/session-3.md` + `session-4.md` — current UI state
3. `dashboard-ui/src/store/useDashboardStore.ts` — موجود فيه `selectedVideoIds: Set<string>` stub من session 3
4. `dashboard-ui/src/components/VideoList.tsx`
5. `dashboard-ui/src/components/VideoCard.tsx`
6. `dashboard-api/routes/phases.mjs` — current single-video endpoints
7. `dashboard-api/lib/jobs.mjs` — job registry behavior
8. `dashboard-api/lib/state.mjs` — state structure

---

## Files to Create

### 1. `dashboard-api/routes/batch.mjs`
```
POST /api/batch/:phase    → body: { videoIds: string[], continueOnError?: boolean }
                          → returns: { batchId: string, jobIds: string[] }
GET  /api/batch/:batchId  → returns: batch status
POST /api/batch/:batchId/cancel → stops the batch (current video finishes, rest are cancelled)
```

**Allowed phases** in `:phase`: `phase1`, `transcribe`, `microEvents`, `render`. (Analyze = edit = not batchable — manual steps.)

### 2. `dashboard-api/lib/batch.mjs`
Batch queue runner.

**Behavior**:
- `createBatch({ videoIds, phase, continueOnError }): Batch`
- Batches stored in-memory `Map<batchId, Batch>` (like jobs)
- A batch has:
  - `id`, `phase`, `videoIds`, `currentIndex`, `status: 'running' | 'done' | 'cancelled' | 'failed'`
  - `results: Array<{ videoId, jobId, status, error? }>`
  - `startedAt`, `finishedAt?`
- `runBatch(batch)`:
  - Iterates videos sequentially
  - For each: spawns the phase job (same as single-video flow), awaits completion via `job.onComplete` promise
  - On failure: if `continueOnError` → record error + move on, else → mark batch failed + break
  - On cancel: current job finishes but rest are skipped
- Emits events via the same SSE progress mechanism so the UI can subscribe to the batch as a whole:
  - `batch:progress { currentIndex, total, currentVideoId }`
  - `batch:video-done { videoId, jobId }`
  - `batch:done`
  - `batch:failed { error }`
  - `batch:cancelled`

### 3. `dashboard-ui/src/components/BatchToolbar.tsx`
Floats at the top of VideoList when `selectedVideoIds.size > 0`.

Shows:
- "3 videos selected" counter
- Phase dropdown: `Phase 1 | Transcribe | Micro Events | Render`
- "Continue on error" checkbox
- "Run on all" button (big, prominent)
- "Clear selection" button

Clicking "Run on all":
- Confirm dialog: "Run <phase> on 3 videos? They'll process one at a time."
- Calls `/api/batch/:phase` with selected IDs
- Closes the selection
- Shows a floating `BatchStatus` panel (next component)

### 4. `dashboard-ui/src/components/BatchStatus.tsx`
Floating panel at bottom-right showing:
- Progress: "Processing 3/10 — محمد علاء"
- Overall progress bar
- Mini log of completed / failed videos
- Cancel button
- Close button (after completion)

Subscribes to the batch SSE stream and updates in real-time.

### 5. `dashboard-ui/src/store/useBatchStore.ts`
Separate small store for batch state:
- `activeBatch: BatchStatus | null`
- `startBatch(phase, videoIds, continueOnError)` — calls API + subscribes
- `cancelBatch()`
- `clearBatch()`

Kept separate from the main dashboard store so batch logic is isolated.

---

## Files to Modify

### 1. `dashboard-ui/src/components/VideoCard.tsx`
- Add checkbox at the top of each card (selected state from `useDashboardStore.selectedVideoIds`)
- Toggling the checkbox calls `store.toggleSelect(video.id)`
- Visual: checked cards get an accent-gold border

### 2. `dashboard-ui/src/components/VideoList.tsx`
- Render `<BatchToolbar />` at the top if `selectedVideoIds.size > 0`

### 3. `dashboard-ui/src/App.tsx`
- Render `<BatchStatus />` as a fixed-position overlay (shown when `activeBatch !== null`)

### 4. `dashboard-ui/src/store/useDashboardStore.ts`
- Ensure `toggleSelect(id)` is implemented (was stubbed in session 3)
- Add `clearSelection()` action
- Add `selectAll()` action

### 5. `dashboard-api/server.mjs`
- Mount `batchRouter` on `/api/batch`

### 6. `dashboard-api/lib/jobs.mjs`
- Expose a `waitForJob(jobId): Promise<{exitCode, status}>` helper so the batch runner can await job completion

### 7. `dashboard-ui/src/api/client.ts`
Add:
- `startBatch(phase, videoIds, continueOnError)` 
- `cancelBatch(batchId)`
- `subscribeToBatch(batchId, onEvent)` — SSE to `/api/batch/:batchId/stream`

---

## Success Criteria

- [ ] Check the checkbox on 3 videos → batch toolbar appears showing "3 videos selected"
- [ ] Select phase "Phase 1" → click "Run on all" → confirm dialog → starts
- [ ] BatchStatus panel shows "Processing 1/3 — <video name>" with a progress bar
- [ ] First video completes → panel updates to "Processing 2/3 — ..."
- [ ] Each video's phase button reflects the live status (pending → running → done)
- [ ] If one video fails and continueOnError is on → batch moves on, failure shown in batch log
- [ ] If one video fails and continueOnError is off → batch stops, panel shows the error
- [ ] Cancel button stops the batch after the current video finishes
- [ ] Refresh the page mid-batch → the batch is remembered (restore from state if possible, or cleanly "batch lost on reload — sorry")
- [ ] All batch phases work: phase1, transcribe, microEvents, render
- [ ] `render` batch is the heaviest — test with 2 small videos to confirm it works

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ No parallel GPU usage — strictly sequential
- ❌ No batched Claude analysis (Phase 5/6 stays manual per video)
- ❌ No fancy priority queue / reordering mid-batch
- ❌ No "resume on restart" — if the server restarts mid-batch, the batch is lost (document this). Too complex for this session.
- ❌ No batch rating UI — rate individually after render
- ❌ No batch delete of videos
- ❌ Don't touch the single-video flow — it still works independently

---

## Commit Template

```
dashboard: bulk mode — sequential batch runner + selection UI

Session 5 — lets Omar process 10 videos in one click. Multi-select
in the UI + a sequential batch runner on the backend. Critical
constraint: all batches run sequentially because the RTX 5060 Ti
is a single GPU and transcode/render jobs each saturate it.

Backend:
  routes/batch.mjs
    POST /api/batch/:phase          start a batch
    GET  /api/batch/:id             status
    POST /api/batch/:id/cancel      stop after current video
    GET  /api/batch/:id/stream      SSE for progress events
  lib/batch.mjs
    createBatch + runBatch — iterates videoIds, awaits each
    phase job via waitForJob() from jobs.mjs, handles
    continueOnError, emits batch:progress / batch:done /
    batch:failed / batch:cancelled events
  lib/jobs.mjs
    Added waitForJob(jobId) helper returning a Promise

Frontend:
  components/
    BatchToolbar — floats when selectedVideoIds.size > 0, shows
                   phase dropdown + continueOnError toggle + "Run
                   on all" button
    BatchStatus  — fixed-position overlay showing current progress,
                   mini log, cancel button
  store/useBatchStore.ts — separate store for batch state (kept
                            isolated from the main dashboard store)
  components/VideoCard.tsx — adds selection checkbox + accent
                              border when selected
  api/client.ts — startBatch, cancelBatch, subscribeToBatch

Allowed batch phases: phase1, transcribe, microEvents, render.
Edit and analyze are not batchable — they're manual steps.

Tested: selected 3 videos, ran phase1 as a batch, watched the
status panel tick through them one at a time. Verified that
continueOnError: true actually skips failures and keeps going.

Non-goals (by design): no parallel GPU, no batch Claude analysis,
no batch resume-on-restart, no batch delete.

Context updates:
  - CLAUDE.md Next Up (session 5 done, session 6 next)
  - docs/phase-11/session-5.md marked complete

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Sequential is mandatory**: الـ GPU single. لو حاولت تشغّل 2 renders بالتوازي، الاتنين هيبطّؤوا أو واحد هيفشل. الـ batch runner بيستخدم `await waitForJob()` ورا كل واحد.
- **Batch state is in-memory**: مش بنحفظه في state/videos.json. لو الـ server بيروحاد mid-batch، الـ batch بيضيع (لكن الفيديوهات اللي خلصت حالتها محفوظة).
- **continueOnError default**: خليه `true` بالـ default — Omar في الـ bulk mode غالباً يفضّل يكمل بدل ما يوقف.
- **Event bus for batch**: لو session 4 أضافت event emitter عام، استخدمه. لو لأ، اعمل local `EventEmitter` في `lib/batch.mjs`.
- **SSE for batch vs per-job**: الـ batch عنده SSE خاص بيه. الـ individual phase SSE لسه شغّال لكل فيديو. الـ UI يقدر يشترك في الاتنين.
- **Test carefully**: قبل ما تعمل commit، شغّل batch على 2-3 فيديوهات صغيرة. لا تشغّله على 10 لأن ده هياخد ساعات.
