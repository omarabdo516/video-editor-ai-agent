# Session 1 — Whisper Corrections Tracker

> ✅ **خلصت 2026-04-15.** `scripts/diff_captions.mjs` + `feedback/whisper_corrections.jsonl` + `docs/phase-11-whisper-finetuning.md` شغالين. الـ transcribe بيحفظ `<video>.captions.raw.json` (gitignored) أول مرة، والـ subtitle editor save handler بيـ fire-and-forget الـ diff script. Success criteria كلها marked.

## الهدف

كل مرة Omar يراجع captions في الـ subtitle editor ويضغط Approve، النظام يقارن الـ raw Whisper output بالـ edited version ويسجّل الـ corrections في `feedback/whisper_corrections.jsonl`. ده بيبني dataset طبيعي للـ fine-tuning المستقبلي **بدون أي effort إضافي** من Omar.

**Effort**: 1-2 ساعة

**Dependencies**: مفيش — standalone session.

---

## Files to Read (قبل أي تعديل)

1. `CLAUDE.md` — current state + the 2026-04-15 commit rule
2. `scripts/transcribe.py` — understand the output shape + `CaptionsData` JSON format
3. `rs-reels.mjs`:
   - الـ `transcribe()` function (around line 217)
   - الـ `runEdit()` function (around line 500-600)
   - الـ save routes in `startFileServer` (the `POST /save/captions.json` handler)
4. `src/types.ts` — `CaptionsData` + `CaptionSegment` + `WordTiming` types
5. `feedback/log.json` — structure reference (don't modify)

---

## Files to Create

### 1. `scripts/diff_captions.mjs`
Node script that takes two JSON paths (raw + edited) and outputs a JSONL of corrections.

**Behavior**:
- Reads both captions JSONs
- Word-aligns them via timing proximity (start time within ±0.2s)
- Identifies:
  - **Word-level changes**: same position, different text → `type: 'word'`
  - **Segment splits/merges**: handle gracefully (skip or note but don't fail)
  - **Pure timing changes**: skip (not relevant for dialect training)
- Emits one JSONL line per correction:
  ```json
  {"original":"المصروف","corrected":"المصاريف","context_before":"حساب","context_after":"الفحص","time_sec":45.2,"project":"<basename>","date":"2026-04-15"}
  ```
- Appends to `feedback/whisper_corrections.jsonl` (creates file if not exists)
- Prints a summary: `Logged N corrections for <project>`
- Exit 0 on success, 1 on error, 2 on missing files

**Usage**:
```bash
node scripts/diff_captions.mjs <raw.json> <edited.json> [--project "name"]
```

### 2. `feedback/whisper_corrections.jsonl`
Empty file. Create it so git tracks its existence, but each line gets appended by the script.

Header comment as first line:
```
# Whisper → Approved corrections log. Append-only. Format: JSONL. Each line = one word-level correction.
```

### 3. `docs/phase-11-whisper-finetuning.md`
Short doc (150-250 lines) explaining:
- Why we track corrections
- When to trigger fine-tuning (threshold: 500+ entries OR 30+ projects)
- How LoRA fine-tuning works with Whisper (link to huggingface PEFT docs)
- Estimated steps when the time comes (dataset prep → LoRA config → training → adapter deployment)
- **Not** an implementation — just the plan for future

---

## Files to Modify

### 1. `rs-reels.mjs`
Two small changes:

**(a)** After `transcribe()` finishes, copy the output to `<video>.captions.raw.json`:
```js
// After: transcribe(wavPath, captionsOut)
if (fileExists(captionsOut)) {
  const rawCopy = captionsOut.replace(/\.captions\.json$/, '.captions.raw.json');
  if (!fileExists(rawCopy)) {
    // Only save on the first transcription — subsequent re-runs should not
    // overwrite the baseline we're comparing against.
    require('node:fs').copyFileSync(captionsOut, rawCopy);
  }
}
```

**(b)** In `runEdit()`'s save handler (the `POST /save/captions.json` route), after the successful write, spawn `diff_captions.mjs`:
```js
// In the save-json handler, after the file has been successfully written:
const rawPath = destPath.replace(/\.captions\.json$/, '.captions.raw.json');
if (fileExists(rawPath)) {
  // Fire-and-forget — don't block the HTTP response
  spawn('node', [
    path.join(__dirname, 'scripts/diff_captions.mjs'),
    rawPath,
    destPath,
    '--project',
    path.basename(destPath).replace(/\.mp4\.captions\.json$/, ''),
  ], { stdio: 'inherit', shell: false });
}
```

### 2. `.gitignore`
Add:
```
# Raw Whisper output (snapshot before user review) — per-video, not committed
*.captions.raw.json
```

### 3. `CLAUDE.md`
Add a note in the "Pipeline" section mentioning that corrections are logged automatically for future fine-tuning.

---

## Success Criteria

- [ ] `node scripts/diff_captions.mjs --help` prints usage
- [ ] Running `rs-reels.mjs make <video> --skip-audio --dry` on a NEW video creates both `<video>.captions.json` AND `<video>.captions.raw.json`
- [ ] Running `rs-reels.mjs edit <video>` + approving the subtitle editor → automatically appends entries to `feedback/whisper_corrections.jsonl`
- [ ] The JSONL file contains real corrections (test: change one word in the editor, approve, check the file — 1 new line should appear)
- [ ] Script can be run manually for back-filling: `node scripts/diff_captions.mjs raw.json edited.json`
- [ ] `tsc --noEmit` + doctor both clean
- [ ] Manual test against an existing project (e.g. "محمد علاء - ورشة المحاسب المالي" — its raw.json doesn't exist yet, so re-run phase 2 to regenerate)

---

## Non-Goals (DO NOT DO IN THIS SESSION)

- ❌ Don't start fine-tuning Whisper itself
- ❌ Don't build a corrections viewer UI
- ❌ Don't modify the subtitle editor React components
- ❌ Don't change `scripts/transcribe.py`
- ❌ Don't touch `scripts/fix-captions.js` — it runs BEFORE the raw snapshot and is fine
- ❌ Don't add SQL/database storage — the JSONL file is fine
- ❌ Don't build an automation to trigger fine-tuning — that's a future session

---

## Commit Template

```
whisper: corrections tracker for future fine-tuning

Every time a user approves edited captions via the subtitle editor,
the system now diffs the raw Whisper output against the approved
version and appends word-level corrections to
feedback/whisper_corrections.jsonl. This builds a natural training
dataset from Omar's actual review work — zero extra effort — which
will eventually feed a LoRA fine-tune of large-v3 on Egyptian
accounting Arabic.

Flow:
1. Phase 2 transcribe snapshots output as <video>.captions.raw.json
   on first run (subsequent runs don't overwrite).
2. Subtitle editor Approve → POST /save/captions.json writes the
   edited file normally, then fires-and-forgets
   scripts/diff_captions.mjs which aligns raw vs edited by word
   timing and appends each real word-level change to the JSONL.
3. Docs note the fine-tuning threshold (500+ entries or 30+
   projects) and the LoRA approach.

The .captions.raw.json files are gitignored — they're per-video
snapshots, not project state. Only the aggregated corrections JSONL
lives in the repo.

Context updates:
  - CLAUDE.md pipeline section notes the automatic logging
  - docs/phase-11-whisper-finetuning.md — threshold + future plan
  - feedback/whisper_corrections.jsonl — initialized with header

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Notes للـ session اللي هتنفّذ

- **Word alignment algorithm**: اتبع الـ greedy approach — لكل word في الـ raw، دور على أقرب word في الـ edited بـ timing proximity (±0.2s). لو لقيت match + text مختلف، ده correction. لو مش لقيت match، skip.
- **Skip rules**: لا تسجّل corrections للـ punctuation-only changes (لأن `normalizePunctuation` في الـ editor ممكن يعمل كتير من دول تلقائياً — مش dialect signal).
- **الـ raw.json بيتعمل مرة واحدة بس**: لو الفيديو اتـ transcribe مرة تانية، الـ raw.json الأصلي لازم يفضل محفوظ — مش عايزين نخسر الـ baseline.
- **Fire-and-forget**: الـ diff script مش بيـ block الـ HTTP response. لو فشل، نخلي الـ log يظهر الـ error بس الـ save يمشي.
