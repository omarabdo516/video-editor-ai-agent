# Session 3 — Dashboard React UI (Core)

## الهدف

React + Vite + TypeScript + Tailwind + Zustand UI بيعرض list بالـ videos، كل فيديو فيه 5 phase buttons، كل button بيعمل call للـ Dashboard API من session 2 ويـ stream الـ progress live.

**Effort**: 3-4 ساعات

**Dependencies**: **Session 2 لازم تكون خلصت**. الـ UI بيستهلك الـ API من session 2.

---

## Files to Read (قبل أي تعديل)

1. `CLAUDE.md` — current state + commit rule
2. `docs/phase-11/session-2.md` — API routes spec (exactly what endpoints exist)
3. `dashboard-api/server.mjs` (من session 2) — real routes + state shape
4. `dashboard-api/routes/videos.mjs` + `routes/phases.mjs` — response shapes
5. `subtitle-editor/package.json` — reference Vite/React/TS/Tailwind versions + dependencies used
6. `subtitle-editor/vite.config.ts` — reference port + plugin config
7. `subtitle-editor/tsconfig.json` — reference strictness + paths
8. `subtitle-editor/tailwind.config.ts` — reference tailwind setup
9. `subtitle-editor/src/App.tsx` — layout pattern
10. `subtitle-editor/src/store/useSubtitleStore.ts` — Zustand pattern reference
11. `subtitle-editor/src/components/Toolbar.tsx` — component styling reference (tailwind classes + CSS vars)

**ملاحظة**: dashboard-ui هيبقى **مشروع Vite منفصل** (زي subtitle-editor بالظبط). مش هيشارك node_modules مع الـ agent repo.

---

## Files to Create

### Folder structure
```
dashboard-ui/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  tailwind.config.ts
  postcss.config.js
  index.html
  .gitignore
  src/
    main.tsx
    App.tsx
    index.css
    vite-env.d.ts
    api/
      client.ts                 ← fetch wrappers
      types.ts                  ← Video, Phase, Job types (match API)
    store/
      useDashboardStore.ts      ← Zustand: videos, selectedIds, actions
    components/
      VideoList.tsx             ← main list container
      VideoCard.tsx             ← per-video card
      AddVideoForm.tsx          ← add-new-video form
      PhaseButton.tsx           ← single phase button with live status
      StatusPill.tsx            ← reusable status indicator (done/running/pending/failed)
      EmptyState.tsx            ← shown when videos list is empty
```

### 1. `dashboard-ui/package.json`
Match the existing `subtitle-editor/package.json` versions so both projects stay consistent:
```json
{
  "name": "rs-reels-dashboard-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "zustand": "^5.x"
  },
  "devDependencies": {
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@vitejs/plugin-react": "^5.x",
    "typescript": "^5.x",
    "vite": "^8.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x"
  }
}
```

**ملاحظة**: نسخة بالضبط من اللي في subtitle-editor — **لا تخترع أرقام جديدة**، اقرا اللي موجود ونسخه.

### 2. `dashboard-ui/vite.config.ts`
- Port `5174` (to avoid collision with subtitle-editor's 5173)
- Proxy `/api/*` to `http://localhost:7778`
- React plugin + Tailwind plugin

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:7778',
    },
  },
});
```

### 3. `dashboard-ui/tsconfig.json` + `tsconfig.node.json`
Copy from subtitle-editor, update `include` paths. Remove any `@agent/*` aliases — the dashboard doesn't share types with the Remotion project.

### 4. `dashboard-ui/index.html`
```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RS Reels Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5. `dashboard-ui/src/main.tsx`
Standard React 19 entry.

### 6. `dashboard-ui/src/index.css`
Tailwind v4 directives + CSS vars matching subtitle-editor's color system (so the two UIs feel related):
```css
@import "tailwindcss";

@theme {
  --color-brand-accent: #FFB501;
  --color-brand-primary: #10479D;
  --color-brand-dark: #0D1F3C;
  --color-bg-base: #0a0e1a;
  --color-bg-panel: #111826;
  --color-bg-elevated: #1a2234;
  --color-border-subtle: #1f2937;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --font-family-cairo: 'Cairo', system-ui, sans-serif;
}

body {
  font-family: var(--font-family-cairo);
}
```

### 7. `dashboard-ui/src/api/types.ts`
TypeScript types that match the API's JSON responses. Mirror the state shape from `dashboard-api/lib/state.mjs`.

```ts
export type PhaseId = 'phase1' | 'transcribe' | 'edit' | 'analyze' | 'microEvents' | 'render';

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed';

export type PhaseState = {
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  lastJobId?: string;
  error?: string;
};

export type Video = {
  id: string;
  path: string;
  name: string;
  addedAt: string;
  duration_sec?: number;
  phases: Record<PhaseId, PhaseState>;
  outputs: {
    raw_captions?: string;
    captions?: string;
    animation_plan?: string;
    reel?: string;
  };
  rating: number | null;
  notes: string | null;
};

export type JobStartResponse = {
  jobId: string;
  status: 'running';
};

export type ProgressEvent =
  | { type: 'line'; text: string }
  | { type: 'done'; exitCode: number }
  | { type: 'error'; message: string };
```

### 8. `dashboard-ui/src/api/client.ts`
Fetch wrappers with typed returns.

```ts
import type { Video, JobStartResponse, PhaseId, ProgressEvent } from './types';

const API = '/api';

export async function listVideos(): Promise<Video[]> {
  const r = await fetch(`${API}/videos`);
  if (!r.ok) throw new Error(`listVideos: ${r.status}`);
  const { videos } = await r.json();
  return videos;
}

export async function addVideo(input: { path: string; name?: string; lecturer?: string; workshop?: string }): Promise<Video> {
  const r = await fetch(`${API}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`addVideo: ${r.status}`);
  return r.json();
}

export async function removeVideo(id: string): Promise<void> {
  const r = await fetch(`${API}/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`removeVideo: ${r.status}`);
}

export async function runPhase(videoId: string, phase: PhaseId): Promise<JobStartResponse> {
  const r = await fetch(`${API}/videos/${encodeURIComponent(videoId)}/${phase}`, { method: 'POST' });
  if (!r.ok) throw new Error(`runPhase: ${r.status}`);
  return r.json();
}

export function subscribeToProgress(
  jobId: string,
  onEvent: (e: ProgressEvent) => void,
): () => void {
  const es = new EventSource(`${API}/progress/${encodeURIComponent(jobId)}`);
  es.addEventListener('line', (ev) => onEvent({ type: 'line', text: JSON.parse(ev.data).text }));
  es.addEventListener('done', (ev) => { onEvent({ type: 'done', exitCode: JSON.parse(ev.data).exitCode }); es.close(); });
  es.addEventListener('error', (ev) => {
    const msgEv = ev as MessageEvent;
    const data = msgEv.data ? JSON.parse(msgEv.data) : { message: 'SSE error' };
    onEvent({ type: 'error', message: data.message });
    es.close();
  });
  return () => es.close();
}
```

### 9. `dashboard-ui/src/store/useDashboardStore.ts`
Zustand store.

**State**:
- `videos: Video[]`
- `loading: boolean`
- `error: string | null`
- `selectedVideoIds: Set<string>` (for future batch mode — unused in session 3)

**Actions**:
- `refresh()` — calls `listVideos()` + updates state
- `addVideo(input)` — calls API + optimistic insert
- `removeVideo(id)`
- `runPhase(videoId, phase)` — calls API + subscribes to progress + updates phase state in real-time
- `toggleSelect(id)` — toggle in selectedVideoIds (for session 5)

### 10. `dashboard-ui/src/App.tsx`
Simple layout:
```tsx
<div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
  <header className="border-b border-[var(--color-border-subtle)] px-6 py-4 flex items-center justify-between">
    <h1 className="font-bold text-[var(--color-brand-accent)] text-lg">RS Reels Dashboard</h1>
    <AddVideoForm />
  </header>
  <main className="p-6">
    <VideoList />
  </main>
</div>
```

On mount: `refresh()`.

### 11. `dashboard-ui/src/components/VideoList.tsx`
- Reads `videos` + `loading` from the store
- If empty → `<EmptyState />`
- Otherwise → `videos.map((v) => <VideoCard key={v.id} video={v} />)`
- Grid layout: 1 column on mobile, 2 on desktop

### 12. `dashboard-ui/src/components/VideoCard.tsx`
Per-video card showing:
- Video name (big, RTL)
- Video path (small, muted, truncated with title attr for hover)
- Duration
- 5 phase buttons in a row: Phase 1, Transcribe, Edit, Analyze, Render
  - `Analyze` button is disabled until `transcribe` is done — clicking it shows a TODO toast "Session 4 will wire Claude handoff here"
  - `Edit` opens the subtitle editor in a new tab (URL built from the video path)
- Rating display (if set)
- Delete button (with confirm)

### 13. `dashboard-ui/src/components/PhaseButton.tsx`
Controlled component:
- Props: `{ video, phase }`
- Reads the current phase status from the video
- Status → visual state:
  - `pending`: neutral button, clickable
  - `running`: yellow button with spinner + "jobRunning..." label
  - `done`: green check + "done"
  - `failed`: red with error icon + tooltip
- Clicking `pending` or `failed`: calls `store.runPhase(video.id, phase)`
- Clicking `running`: disabled
- Clicking `done`: shows confirm "Re-run this phase?" → if yes, run again

### 14. `dashboard-ui/src/components/StatusPill.tsx`
Reusable pill: `<StatusPill status="done" />` → green badge with checkmark.

### 15. `dashboard-ui/src/components/AddVideoForm.tsx`
- Button: "+ Add Video"
- On click: opens a small modal or inline form
- Inputs:
  - `path` (required, text input — Windows absolute path)
  - `name` (optional, auto-derived from path if empty)
  - `lecturer` (optional)
  - `workshop` (optional)
- Submit: calls `store.addVideo(input)`
- Closes on success, shows error on fail

### 16. `dashboard-ui/src/components/EmptyState.tsx`
Shown when there are no videos. Just a friendly message + a hint to click "+ Add Video".

### 17. `dashboard-ui/.gitignore`
Standard Vite gitignore (node_modules, dist, .vite, etc.).

---

## Files to Modify

### 1. `package.json` (root)
Add scripts:
```json
{
  "scripts": {
    "dashboard:api": "node dashboard-api/server.mjs",
    "dashboard:ui": "cd dashboard-ui && npm run dev",
    "dashboard": "concurrently \"npm run dashboard:api\" \"npm run dashboard:ui\""
  },
  "devDependencies": {
    "concurrently": "^8.x"
  }
}
```

**ملاحظة**: `concurrently` صغير (100KB) + بيخلّي الـ `npm run dashboard` يشغّل الاتنين مع بعض.

### 2. `.gitignore`
Add:
```
# Dashboard UI — sub-project with its own node_modules
dashboard-ui/node_modules/
dashboard-ui/dist/
dashboard-ui/.vite/
```

---

## Success Criteria

- [ ] `cd dashboard-ui && npm install` clean
- [ ] `npm run dashboard:ui` starts vite dev server on 5174
- [ ] `npm run dashboard:api` starts API on 7778 (from session 2)
- [ ] `npm run dashboard` starts both concurrently
- [ ] Open `http://localhost:5174` → empty state shows
- [ ] Click "Add Video" → form → paste the محمد علاء path → click submit → video appears
- [ ] Video card shows 5 phase buttons
- [ ] `edit` button opens subtitle editor in new tab
- [ ] Click `Phase 1` on a fresh video → button goes yellow + spinner → API streams progress → button turns green when done
- [ ] Refresh the page → video list persists
- [ ] `Analyze` button shows the "Session 4 TODO" toast when clicked
- [ ] `Delete` button removes the video (after confirm)

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ No progress bars (yet) — just "running..." text with spinner
- ❌ No log viewer (yet) — just console.log the SSE events for now
- ❌ No Claude handoff — that's session 4
- ❌ No rating UI — session 4
- ❌ No batch mode / multi-select UI — session 5
- ❌ Don't modify the `dashboard-api/` code — if you find a bug there, note it in the commit message but don't fix it (session spec is: API is frozen from session 2)
- ❌ Don't modify `subtitle-editor/` — the `edit` button just opens its URL in a new tab
- ❌ No authentication
- ❌ No drag-and-drop file picker (yet) — plain path input is fine

---

## Commit Template

```
dashboard: React UI core — video list + phase buttons

Second half of the dashboard (paired with the API from session 2).
A standalone Vite + React 19 + TypeScript + Tailwind v4 + Zustand
app at dashboard-ui/ that lists tracked videos and exposes each
phase as a clickable button wired to the local API.

Structure:
  dashboard-ui/
    vite.config.ts   port 5174, proxies /api → 7778
    src/
      api/
        client.ts     fetch wrappers (listVideos, runPhase,
                      subscribeToProgress) + SSE EventSource
        types.ts      Video, PhaseState types mirroring API
      store/
        useDashboardStore.ts  Zustand: videos, selectedIds, actions
      components/
        VideoList     container
        VideoCard     per-video panel w/ 5 phase buttons
        PhaseButton   single-phase button w/ live status
        StatusPill    reusable status indicator
        AddVideoForm  path input → POST /api/videos
        EmptyState    shown when list is empty

Root package.json gains three scripts:
  dashboard:api    wraps node dashboard-api/server.mjs
  dashboard:ui     wraps cd dashboard-ui && npm run dev
  dashboard        runs both via concurrently

Non-goals (by design, spec'd in docs/phase-11/session-3.md):
  - No progress bars or log viewer (session 4)
  - No Claude handoff (session 4)
  - No batch mode (session 5)
  - No rating UI (session 4)
  - Dashboard API frozen — don't modify

Tested end-to-end: added a video via the form, ran Phase 1 live,
watched SSE events update the button, verified state persists
across page refreshes.

Context updates:
  - CLAUDE.md Next Up section (session 3 done, session 4 next)
  - docs/phase-11/session-3.md — marked complete

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Port 5174**: اختيار متعمّد. الـ subtitle-editor على 5173 + الـ dashboard-api على 7778. عشان مش يتعارضوا.
- **اللـ CSS vars**: نسخ من subtitle-editor عشان الاتنين يحسّوا بنفس الـ brand.
- **RTL**: الـ `<html lang="ar" dir="rtl">` في index.html يكفي عشان Tailwind utilities ترجع RTL-aware.
- **Zustand store**: ابتدا بسيط. `refresh` action بيعمل `listVideos()` ويكتب في الـ state. `runPhase` action بيعمل `runPhase()` → `subscribeToProgress()` ويحدّث الـ video phase in-place.
- **Optimistic updates**: لما runPhase يرجع jobId، حدّث الـ phase.status محلياً لـ 'running' فوراً، من غير ما تستنى GET /videos.
- **Polling fallback**: لو SSE فشل لأي سبب، ابدأ polling كل ثانيتين للـ GET /api/videos/:id — كـ safety net.
- **Errors**: show them inline في الـ card، مش alert boxes.
- **Empty path validation**: AddVideoForm لازم يمنع submit لو الـ path فاضي. وممكن تـ validate إنه ينتهي بـ .mp4/.mov بس.
- **"Session 4 TODO" toast**: ممكن يبقى alert() بسيط لـ`Analyze` button — ما تبنيش toast system كامل.
