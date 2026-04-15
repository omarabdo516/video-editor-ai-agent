# Session 4 — Dashboard Polish + Claude Handoff + Rating

## الهدف

خلّي الـ Dashboard production-ready. إضافة:
1. **Progress bars** مع نسبة فعلية أثناء الـ phase execution
2. **Log viewer** collapsible يعرض live output من SSE
3. **Claude Handoff** — "Send to Claude" modal يوّلد message جاهزة + ينسخها للـ clipboard
4. **Rating UI** — 1-5 stars + optional note، يكتب على feedback/log.json مباشرة

**Effort**: 2-3 ساعات

**Dependencies**: **Session 3 لازم تكون خلصت**. هدّ polish layer فوق الـ UI الموجود.

---

## Files to Read

1. `CLAUDE.md`
2. `docs/phase-11/session-3.md` — spec الـ UI الحالي
3. `dashboard-ui/src/components/VideoCard.tsx` (من session 3)
4. `dashboard-ui/src/components/PhaseButton.tsx`
5. `dashboard-ui/src/store/useDashboardStore.ts`
6. `dashboard-ui/src/api/client.ts`
7. `dashboard-api/routes/phases.mjs` (من session 2) — عشان تضيف handoff route
8. `dashboard-api/routes/rating.mjs` — موجود من session 2
9. `feedback/log.json` — format reference
10. `src/data/محمد علاء - ورشة المحاسب المالي/content_analysis.json` — typical shape Claude needs
11. `src/data/محمد علاء - ورشة المحاسب المالي/animation_plan.json` — typical output

---

## Files to Create

### 1. `dashboard-ui/src/components/ProgressBar.tsx`
Reusable inline progress bar.
- Props: `{ progress: number (0-1), label?: string, color?: 'accent' | 'success' | 'danger' }`
- Accent gold fill on dark track. Thin (4px) to not dominate.

### 2. `dashboard-ui/src/components/LogViewer.tsx`
Collapsible log panel shown below a running or recently-completed phase button.
- Props: `{ lines: string[], maxHeight?: number }`
- Auto-scroll to bottom as new lines arrive (unless user has scrolled up)
- Collapse/expand toggle
- "Copy logs" button
- Styling: monospace font, small text, dark background

### 3. `dashboard-ui/src/components/ClaudeHandoffModal.tsx`
Modal (click outside to close, Esc to close).
- Props: `{ video: Video, onClose: () => void }`
- Content:
  - Title: "Claude Handoff — Phase 5/6 Analysis"
  - Pre-formatted message (see below) in a `<pre>` block
  - "📋 Copy to Clipboard" button (big, prominent)
  - "✓ Copied!" confirmation inline after click
  - "Open new Claude session" link (just opens `claude.ai` or similar)
  - Cancel button

**Message shape**:
```
اشتغل على فيديو "<video.name>".

الـ video path: <video.path>
المحاضر: <video.lecturer || 'محاضر'>
الورشة: <video.workshop || 'RS Hero workshop'>
المدة: <video.duration_sec>s

الـ files الجاهزة:
- captions: <video.outputs.captions>
- face_map: <derived path>
- energy: <derived path>
- speech_rhythm: <derived path>

المطلوب:
1. Phase 5 — content analysis → src/data/<slug>/content_analysis.json
2. Phase 6 — animation plan → src/data/<slug>/animation_plan.json  
3. Phase 6.5 — node scripts/generate_micro_events.mjs "<slug>"
4. اعمل validation: node scripts/validate_plan.mjs "<slug>"
5. لما تخلص، ارجع للـ Dashboard على localhost:5174 ودوس "Render"
```

The message is assembled from `video` state + derived paths (same pattern used by the existing pipeline).

### 4. `dashboard-ui/src/components/RatingInput.tsx`
Inline 5-star rating widget.
- Props: `{ videoId: string, currentRating: number | null, onSave: (rating: number, note?: string) => void }`
- 5 stars, click a star to set rating
- Textarea for optional note
- Save button → POST to API → update store
- Show "✓ Saved" confirmation briefly after save

---

## Files to Modify

### 1. `dashboard-ui/src/components/VideoCard.tsx`
Integrate the new components:
- Each phase button gets a mini progress area below it when running
  - Shows line count (e.g. "running — 120 lines") or explicit `progress` if the API reports one
- Below the phase button row, a **collapsible log viewer** shows the last phase's output
- Add a prominent "**🤖 Send to Claude**" button after Transcribe completes (replaces the TODO toast from session 3)
  - Clicking it opens `ClaudeHandoffModal`
  - The button is disabled until `transcribe.status === 'done'`
- After render succeeds, show **`RatingInput`** inline
  - If the video already has a rating, show it as a read-only pill with an "Edit" link

### 2. `dashboard-ui/src/store/useDashboardStore.ts`
Add:
- `logs: Record<string, string[]>` — map of jobId → lines buffer (capped at 500 per job)
- `appendLog(jobId, line)` action
- `clearLog(jobId)` action
- In `runPhase`, subscribe to SSE and forward every `line` event to `appendLog`

Add:
- `submitRating(videoId, rating, note?)` → POST to `/api/videos/:id/rating` → update store

### 3. `dashboard-ui/src/api/client.ts`
Add:
- `submitRating(videoId, rating, note?)` 
- `getHandoffMessage(videoId)` → calls `POST /api/videos/:id/handoff` and returns `{ message: string }`

### 4. `dashboard-api/routes/phases.mjs`
Add:
```
POST /api/videos/:id/handoff  → { message: string }
```

The endpoint:
- Loads the video from state
- Computes all the derived paths (captions, face_map, energy, speech_rhythm, src/data slug)
- Assembles the message using a template
- Returns `{ message }` — **doesn't** actually invoke Claude, just prepares the text

### 5. `dashboard-api/routes/rating.mjs`
Make sure it:
- Writes to `feedback/log.json` — if the project exists, updates its `overall_rating` + adds an item to `feedback` array. If it doesn't exist yet, creates a new project entry with minimal metadata (project name, date, counts from animation_plan if available).
- Updates the dashboard state file too

### 6. `dashboard-ui/src/api/types.ts`
Add:
```ts
export type HandoffResponse = { message: string };
export type RatingInput = { rating: number; note?: string };
```

---

## Success Criteria

- [ ] Running a phase shows a live progress indicator (line count or % if known)
- [ ] Clicking the log toggle on a video card shows a scrollable log panel with SSE output
- [ ] After transcribe completes, "Send to Claude" button becomes enabled
- [ ] Clicking "Send to Claude" opens a modal with the handoff message
- [ ] "Copy to Clipboard" button actually copies the text (test with Ctrl+V in a new tab)
- [ ] After render, rating input shows up
- [ ] Submitting a rating writes to `feedback/log.json` AND updates the video card display
- [ ] Refreshing the page preserves the rating
- [ ] End-to-end flow on a real video: Phase 1 → Transcribe → Edit → Send to Claude (manual) → Render → Rate
- [ ] Error state on a failed phase shows clearly (red indicator + error message in the log)
- [ ] `dashboard:api` + `dashboard:ui` both clean on restart

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ No batch mode — session 5
- ❌ No direct Claude API integration — handoff is copy-paste only
- ❌ No drag-and-drop file picker
- ❌ No video preview / thumbnails
- ❌ Don't modify session 3's Zustand actions fundamentally — just extend them
- ❌ Don't add new phase buttons
- ❌ Don't change the dashboard API port or routing shape
- ❌ No WebSocket upgrade from SSE

---

## Commit Template

```
dashboard: progress bars + log viewer + Claude handoff + rating

Session 4 — makes the dashboard production-ready by layering polish
on top of session 3's core. Four additions:

1. ProgressBar + LogViewer
   Each running phase now shows live progress (line count as a proxy
   when no explicit percentage is reported) plus a collapsible log
   panel that tails the SSE stream. Lines are buffered per-jobId in
   the Zustand store (capped at 500 per job) and auto-scroll to the
   bottom unless the user has scrolled up.

2. Claude handoff modal
   After transcribe completes, a "🤖 Send to Claude" button becomes
   enabled. Clicking it opens a modal showing a pre-formatted message
   assembled by GET /api/videos/:id/handoff (new route) that includes
   the project name, lecturer, workshop, all derived file paths, and
   the exact Phase 5/6/6.5 instructions. Omar copies to clipboard,
   pastes into a new Claude session, and comes back to the dashboard
   to render. The dashboard never invokes Claude directly.

3. RatingInput
   After the render phase completes, an inline 5-star rating widget
   appears. Submitting writes to feedback/log.json via the existing
   /api/videos/:id/rating route (wired in session 2). Existing
   ratings show as a pill with an Edit link.

4. Error surfacing
   Failed phases now show a red indicator + the error message inline,
   with the log viewer auto-expanded so Omar can see what broke.

New components:
  ProgressBar, LogViewer, ClaudeHandoffModal, RatingInput

Modified:
  VideoCard — integrates all four new components
  useDashboardStore — logs map + submitRating action
  api/client.ts — submitRating, getHandoffMessage
  dashboard-api/routes/phases.mjs — adds /handoff route
  dashboard-api/routes/rating.mjs — writes to feedback/log.json

Non-goals (by design): no batch mode (session 5), no direct Claude
API calls, no drag-drop picker.

Tested end-to-end: added a fresh video, ran all phases, handed off
to a Claude session, pasted back, rendered, rated. Rating landed in
feedback/log.json correctly.

Context updates:
  - CLAUDE.md Next Up section (session 4 done, session 5 next)
  - docs/phase-11/session-4.md marked complete

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Progress as a proxy**: الـ `rs-reels.mjs` ما بيطلّعش percentage صريح لمعظم الـ phases (ما عدا الـ render اللي بيقول "Rendered 1234/6521"). الحل: regex على السطور اللي فيها `/\d+\/\d+/` وخد الـ ratio. للـ phases التانية (phase1, transcribe)، اعرض "line count" بس.
- **Handoff message template**: الأفضل تحطه في `dashboard-api/lib/handoff.mjs` module منفصل عشان يبقى clean.
- **Rating → feedback/log.json**: استخدم الـ logic من `runPerformance` في rs-reels.mjs كمرجع — بس dashboard-api نسخته الخاصة عشان مش يعتمد على CLI wrapping لمجرد كتابة JSON.
- **Don't break session 3 behavior**: كل التعديلات additive — زرار جديد، field جديد، action جديد. الـ existing phase button بيفضل يشتغل زي ما هو.
- **Copy-to-clipboard polyfill**: استخدم `navigator.clipboard.writeText()` — فيه fallback لـ textarea+execCommand لو الـ browser قديم، بس Chromium/Edge حديث يشتغل مباشر.
- **Log viewer auto-scroll**: حط `ref` على الـ container + `scrollTop = scrollHeight` في `useEffect` لما lines تتغير — بس **شرط** إنه الـ user ما scrolled up يدوياً (اتحقق من `scrollHeight - scrollTop - clientHeight < 40`).
