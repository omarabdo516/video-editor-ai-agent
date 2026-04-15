# Session 6 — Docs + CLAUDE.md + Memories + E2E Test

> ✅ **خلصت 2026-04-15.** الـ docs + context files + memories كلها synced على الـ Dashboard-first workflow. `docs/dashboard-workflow.md` كامل (13 sections). Memory files جديدة: `feedback_dashboard_workflow.md` + `reference_dashboard_location.md` + MEMORY.md index اتحدّث. CLAUDE.md Next Up + Pipeline sections rewritten. rs-reels.mjs فيه Dashboard tip banner على الـ startup. README.md فيه quick-start note للـ Dashboard. Sessions 1-6 كلها marked كـ ✅. Smoke test على الـ Dashboard: API /api/health + /api/videos ردوا، `tsc -b && vite build` على dashboard-ui TS-clean — **الـ interactive full-video e2e (الـ 14-step flow) محتاج user approval على الـ subtitle editor فمتـ deferred كـ Omar's next manual run**.

## الهدف

الـ Dashboard خلص (sessions 2-5)، الـ Whisper tracker خلص (session 1). دلوقتي محتاجين:
1. تحديث كل الـ context files عشان الـ session الجاية تعرف الـ workflow الجديد (Dashboard-first بدل CLI-first)
2. End-to-end test على فيديو حقيقي عشان نتأكد إن كل حاجة شغّالة مع بعض
3. Retiring الـ guidance القديم اللي بيقول "run rs-reels.mjs from Claude"

**Effort**: 1-2 ساعات

**Dependencies**: Sessions 1-5 كلها لازم تكون خلصت.

---

## Files to Read

1. `CLAUDE.md` — **كاملاً**
2. `feedback/style_evolution.md`
3. `~/.claude/projects/.../memory/MEMORY.md` — all existing memory entries
4. `docs/phase-11/README.md` + `session-{1..5}.md` — recap of all sessions
5. `dashboard-api/README.md`
6. `dashboard-api/server.mjs` — final API shape
7. `dashboard-ui/src/App.tsx` — final UI shape
8. `package.json` — root scripts
9. `README.md` (repo root, if exists)

---

## Files to Create

### 1. `docs/dashboard-workflow.md`
**The canonical "how to use the Dashboard" doc** (~300-500 lines).

Sections:
1. **Why the Dashboard exists** (1 paragraph — token savings, Claude session frees up, batch-ready)
2. **Starting the Dashboard**
   ```bash
   npm run dashboard              # starts both API + UI
   # Or separately:
   npm run dashboard:api          # only API on 7778
   npm run dashboard:ui           # only UI on 5174
   ```
3. **Adding a video** — screenshot description + step-by-step
4. **Running phases 1-4 from the UI** — no Claude involved
5. **The handoff to Claude for Phase 5/6** — detailed: click "Send to Claude", copy, open new Claude session, paste, Claude does the analysis, comes back
6. **Running the render** — back in the UI, click Render
7. **Rating the result** — inline after render
8. **Bulk mode** — select videos, pick a phase, run batch
9. **Troubleshooting** — common issues (port conflict, state file corruption, how to reset)
10. **The Whisper corrections tracker** — what it does in the background, how to check what was logged

### 2. `~/.claude/projects/.../memory/feedback_dashboard_workflow.md`
New memory file.

```markdown
---
name: Dashboard is the default workflow (not rs-reels.mjs from Claude)
description: Omar's primary workflow is the Dashboard UI at localhost:5174. Claude sessions should only handle Phase 5/6 analysis — not run scripts via Bash.
type: feedback
---
When Omar sends a new video for processing, the **Dashboard UI** is the primary tool. Claude Code sessions should NOT automatically run `node rs-reels.mjs phase1 ...` etc. from Bash — that's what the Dashboard exists to do.

**Why:** Running scripts from a Claude session burns ~6k tokens per video on progress output (Phase 1 + 2 + render output) and keeps the session busy for 30+ minutes. Omar built the Dashboard in Phase 11 (April 2026) specifically to decouple script execution from Claude thinking. Running scripts from Claude is now a ~18% token waste AND blocks the session.

**How to apply:**
- When Omar sends a new video: direct him to the Dashboard. Don't immediately call `node rs-reels.mjs phase1`.
- Claude's role in the workflow is **Phase 5 + Phase 6 + Phase 6.5** only — content analysis, animation planning, and triggering the micro events generator.
- The handoff mechanism: Omar clicks "Send to Claude" in the Dashboard, the UI generates a message with project name + paths + instructions, Omar pastes it into a new Claude session. Claude reads the files, writes `content_analysis.json` + `animation_plan.json`, runs `generate_micro_events.mjs`, validates, and tells Omar to click "Render" in the Dashboard.
- **Exceptions:** if Omar explicitly says "run rs-reels from here" or asks a debugging question that requires direct CLI invocation, Bash is still allowed. The rule is: **don't proactively run the pipeline from Claude**. Let the Dashboard do it.
- The Dashboard lives at `dashboard-ui/` + `dashboard-api/`. `npm run dashboard` starts both on ports 5174 + 7778.
```

### 3. `~/.claude/projects/.../memory/reference_dashboard_location.md`
Reference-type memory.

```markdown
---
name: Dashboard UI + API location + ports
description: Where the Dashboard lives in the repo, what runs on which port, and how to start it.
type: reference
---
Dashboard components:
- **UI**: `dashboard-ui/` — React + Vite + TypeScript + Tailwind v4 + Zustand, runs on `http://localhost:5174`
- **API**: `dashboard-api/` — Express + Node `.mjs`, runs on `http://localhost:7778`
- **State**: `dashboard-api/state/videos.json` (gitignored)
- **Handoff files**: `dashboard-api/state/handoffs/` (generated per-session)

Start commands (from repo root):
```bash
npm run dashboard           # both concurrently
npm run dashboard:api       # API only
npm run dashboard:ui        # UI only
```

Dependencies between dashboards:
- Dashboard UI proxies `/api/*` → API (port 7778)
- Dashboard UI opens subtitle-editor at `http://localhost:5173` when "Edit" is clicked
- Subtitle editor still needs to be started separately via `node rs-reels.mjs edit <video>` OR added to the Dashboard as a managed process (future work)

Docs: `docs/dashboard-workflow.md` is the user-facing guide.
```

---

## Files to Modify

### 1. `CLAUDE.md`

**Next Up section**: Rewrite to reflect Phase 11 complete.

```markdown
## 📍 Next Up — اللي بنبدأ فيه دلوقتي

> **آخر تحديث:** 2026-04-XX — **Phase 11 كامل** (Dashboard + Whisper tracker + Bulk mode). الـ workflow الأساسي بقى عبر الـ Dashboard UI (localhost:5174). Claude session بتدخل بس للـ Phase 5 + 6 + 6.5 عبر الـ handoff mechanism. Phase 1/2/3/4/6.5/8 كلهم من الـ UI بدون Claude session أو tokens.
>
> **الـ 6 sessions اللي خلصت:**
> 1. Whisper corrections tracker — `scripts/diff_captions.mjs` + `feedback/whisper_corrections.jsonl`
> 2. Dashboard API backend — `dashboard-api/` (Express + SSE + state)
> 3. Dashboard React UI core — `dashboard-ui/` (Vite + React 19)
> 4. Polish + Claude handoff + rating UI
> 5. Bulk mode — multi-select + sequential batch runner
> 6. Docs + context file migration (هذه الـ session)

**الحالة:** Phase 0-11 كاملين. **الـ primary workflow بقى Dashboard** — انظر `docs/dashboard-workflow.md`. Claude ما بيشغّلش scripts من Bash في الـ normal flow — الـ Dashboard بيعمل ده. 

**الخطوة الجاية:** content farming على scale. استخدم bulk mode لـ 5-10 فيديوهات دفعة واحدة. راقم feedback/log.json + feedback/whisper_corrections.jsonl بيتراكموا ليوم اللـ fine-tune.
```

**Pipeline section**: Replace the CLI-first pipeline with a Dashboard-first pipeline.

```markdown
**الـ Pipeline للفيديو الجديد (via Dashboard):**
1. افتح الـ Dashboard: `npm run dashboard` (API + UI)
2. افتح `http://localhost:5174` → "+ Add Video"
3. Click "Phase 1" على الفيديو — يشتغل بدون Claude
4. Click "Transcribe" — يشتغل بدون Claude
5. Click "Edit" — يفتح subtitle editor في tab جديدة
6. بعد الـ approve، click "🤖 Send to Claude"
7. Copy الـ handoff message → paste في Claude session جديدة
8. Claude بيعمل Phase 5 + 6 + 6.5 + validation (~5-10 min)
9. ارجع للـ Dashboard → Click "Render" — يشتغل بدون Claude
10. بعد الـ render، rate من الـ UI مباشرة

**الـ Pipeline القديم (CLI-only, for debugging):** لسه شغّال. `node rs-reels.mjs make <video> ...` بتاخد نفس الـ args. استخدمها لو عايز تـ debug أي phase أو بتشتغل بعيد عن الـ Dashboard.
```

**Section "بعد كل ريندر نهائي"**: Update step 6 to mention `docs/dashboard-workflow.md` as another file to keep in sync.

### 2. `~/.claude/projects/.../memory/MEMORY.md`
Add the 2 new memory entries:
```markdown
- [Dashboard workflow](feedback_dashboard_workflow.md) — Dashboard at localhost:5174 is the default; Claude should not run the pipeline from Bash.
- [Dashboard location](reference_dashboard_location.md) — ports, paths, start commands.
```

### 3. `rs-reels.mjs`
Add a banner at startup:
```js
function main() {
  console.log('\x1b[90m  Tip: run via Dashboard at http://localhost:5174 for a managed workflow.\x1b[0m');
  // ... existing code
}
```
(Only when a real command is being run, not on `--help` or version.)

### 4. `package.json` (root)
Make sure `npm run dashboard` works end-to-end. Add a top-level README note if missing.

### 5. `README.md` (if it exists)
Quick-start section pointing to the Dashboard.

---

## End-to-End Test (Required Before Commit)

Run the full pipeline on **at least one real video** via the Dashboard:

1. `npm run dashboard` — both start clean
2. `http://localhost:5174` loads
3. Add a video (use any existing sample, OR a new one from your drive)
4. Click Phase 1 → watch progress → done
5. Click Transcribe → watch progress → done
6. Click Edit → subtitle editor opens in new tab → make a small edit → approve
7. **Check**: `feedback/whisper_corrections.jsonl` got a new entry
8. Click "Send to Claude" → modal opens → "Copy to Clipboard" works
9. Open a new Claude session manually → paste → (test just the paste, don't actually run)
10. Click Render → watch progress → done
11. Rate the result → 4/5 + note
12. **Check**: `feedback/log.json` has the rating
13. Refresh browser → everything persists
14. Try bulk mode: select 2 videos → run Phase 1 batch → watch sequential execution

If ANY step fails, fix it before committing.

---

## Success Criteria

- [ ] `docs/dashboard-workflow.md` exists and is accurate
- [ ] CLAUDE.md "Next Up" section reflects Phase 11 complete
- [ ] CLAUDE.md pipeline section recommends Dashboard over CLI
- [ ] Two new memory entries added (feedback + reference)
- [ ] MEMORY.md index updated
- [ ] rs-reels.mjs shows the Dashboard tip on startup
- [ ] End-to-end test passed on at least one real video
- [ ] Bulk mode test passed on at least 2 videos
- [ ] All earlier session docs (`docs/phase-11/session-{1..5}.md`) marked as "✅ completed" at the top

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ No new features
- ❌ No Whisper fine-tuning trigger (still waiting for threshold)
- ❌ No refactoring of existing components
- ❌ Don't break the CLI-first workflow — it should still work as a fallback
- ❌ Don't delete `docs/phase-11/session-*.md` files — keep them as historical reference

---

## Commit Template

```
phase-11: docs + memories + e2e workflow migration

Closes out Phase 11 (Dashboard + Whisper tracker + Bulk mode). All
six sessions are done; this commit ties everything together:

Docs:
  docs/dashboard-workflow.md
    ~400 lines covering: why the dashboard exists, how to start
    it, adding videos, running phases, the Claude handoff, bulk
    mode, troubleshooting, and the background Whisper corrections
    tracker.

Memory:
  memory/feedback_dashboard_workflow.md
    Rule: Dashboard at localhost:5174 is the default. Claude
    sessions should NOT run the pipeline from Bash — that's what
    the Dashboard exists to do. Claude's role is Phase 5/6 only.
  memory/reference_dashboard_location.md
    Ports (5174 UI, 7778 API), paths, start commands.
  memory/MEMORY.md
    Index updated with the two new entries.

CLAUDE.md:
  Next Up section rewritten to reflect Phase 11 complete.
  Pipeline section rewritten: Dashboard-first flow as the default,
  CLI-first flow kept as a debugging fallback.
  Ratings history updated (4 reels so far).

rs-reels.mjs:
  Startup banner points users to the Dashboard.

package.json:
  `npm run dashboard` confirmed working end-to-end.

End-to-end test:
  Ran <video name> through the full Dashboard flow: add → phase 1
  → transcribe → edit → send to Claude (manual handoff) → render
  → rate. All 10 steps passed. Also ran a 2-video bulk phase1
  batch — sequential execution as expected.

Marked docs/phase-11/session-{1..6}.md as ✅ completed.

Context updates bundled here per the 2026-04-15 commit rule — all
context files (CLAUDE.md, memory/, feedback/style_evolution.md)
are in sync with the new workflow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Ideally, run the e2e test on a fresh video** — not one that's already been processed. If Omar has a new video handy, use it. Otherwise, use any existing one but re-run phases from scratch.
- **Don't over-engineer the doc** — `docs/dashboard-workflow.md` should read like a friendly tutorial, not a formal spec.
- **Retiring old guidance carefully**: the CLI pipeline still works. Don't delete any of the existing `docs/phase-{1..9}-*.md` files. Just add a note at the top of each saying "See `docs/dashboard-workflow.md` for the Dashboard-first flow; this doc describes the underlying CLI."
- **rs-reels.mjs banner**: make it subtle — gray text, one line, only when a command is actually being executed (not on `--help`).
- **Memory file names**: keep the prefix convention: `feedback_*` for cross-session behavioral rules, `reference_*` for pointers to resources/locations.
- **Commit rule reminder**: this whole session IS a context-files update. Don't forget to include the rule from 2026-04-15 (commit must update context files) — it still applies.
