# Dashboard Workflow

> **الـ canonical guide** لتشغيل الـ RS Reels pipeline عبر الـ Dashboard UI. ده الـ workflow الأساسي من Phase 11 وما بعده. الـ CLI القديم (`rs-reels.mjs make ...`) لسه شغّال كـ debugging fallback، بس الـ default من دلوقتي = الـ Dashboard.

---

## 1. Why the Dashboard exists

قبل Phase 11 كل فيديو كان بيستهلك Claude session لمدة 30-40 دقيقة — معظمها scripts بتشتغل في الـ background والـ Claude context بيحرق tokens على progress output (Phase 1 + transcribe + render). الـ Dashboard بيفصل الـ script execution عن الـ Claude thinking: Omar بيـ click الـ phases من UI، والـ Claude session بتدخل **بس** للـ Phase 5 + 6 + 6.5 analysis عبر الـ handoff mechanism. Token savings على كل فيديو ≈ 6k tokens، والـ session بتفضل free للشغل التاني. ده كمان بيـ unlock الـ bulk mode — Omar يقدر يـ queue 5-10 فيديوهات دفعة واحدة على GPU واحد.

---

## 2. Starting the Dashboard

من repo root:

```bash
npm run dashboard              # يشغّل API + UI مع بعض عبر concurrently
```

أو كل واحد لوحده (مفيد لو عايز تشوف logs نظيفة لواحد منهم):

```bash
npm run dashboard:api          # API بس، بـ :7778
npm run dashboard:ui           # UI بس، بـ :5174 (بيـ proxy /api → :7778)
```

بعد ما الـ output يقول `Dashboard API on http://localhost:7778` + `Local: http://localhost:5174/`، افتح [http://localhost:5174](http://localhost:5174) في المتصفح.

**Smoke test سريع** (لو شكيت في حاجة):

```bash
curl http://localhost:7778/api/health    # → {"ok":true}
curl http://localhost:7778/api/videos    # → {"videos":[...]}
```

---

## 3. Adding a video

1. افتح `http://localhost:5174` → الـ header فوق على اليسار فيها "+ Add Video"
2. اكتب الـ absolute path للـ video (`.mp4` / `.mov`) — مثال:
   `D:/Work/RS/raw/محمد علاء - ورشة المحاسب المالي.mp4`
3. اختيارياً: اكتب `lecturer` + `workshop` — الـ render بيستخدمهم في الـ lower-third. لو سبتهم فاضيين، الـ pipeline بيـ default على "محاضر" + "ورشة RS Hero".
4. دوس Submit → الـ card بتظهر في الـ grid بـ phase buttons كلها في `pending`.

الـ Dashboard بيحفظ الـ state في [`dashboard-api/state/videos.json`](../dashboard-api/state/videos.json) (gitignored) — الفيديوهات بتفضل بين restarts.

---

## 4. Running Phases 1-4 from the UI (no Claude involved)

كل phase button فوق الـ card بيعمل spawn لـ child process عبر الـ API، ويـ stream stdout/stderr كـ SSE events (line-by-line) للـ log viewer. الـ button بيـ tick pending → running → done تلقائياً.

### 4.1 Phase 1 — Preprocess
دوس **Phase 1**. بيشغّل `node rs-reels.mjs phase1 <path>`:
- FFmpeg audio preprocess (16kHz mono WAV)
- Pre-scale للـ 1080×1920 (center crop)
- ffprobe metadata
- MediaPipe face detection
- librosa audio energy analysis

الـ runtime ~3-5 دقيقة للفيديو 3-5 min.

### 4.2 Transcribe
دوس **Transcribe**. بيشغّل `rs-reels.mjs make <path> --skip-audio --dry`:
- faster-whisper large-v3 على CUDA
- Egyptian Arabic fix-captions
- Snapshot للـ raw output في `<video>.captions.raw.json` (first run بس — Session 1 behavior)
- Speech rhythm analysis (fails soft)

الـ runtime ~2-3 دقيقة للفيديو ~3 min.

### 4.3 Edit — subtitle review
دوس **Edit**. الـ Dashboard بترجع `editorUrl` + `hintCommand`:
- **Important**: الـ subtitle editor محتاج الـ rs-reels file server (:7777) + Vite dev server (:5173) يكونوا شغالين مع بعض. الـ Dashboard لسه ما بيـ manage الـ processes دي من الـ UI مباشرة (future work).
- لحد ما يتـ automate، افتح terminal تانية وشغّل:
  ```bash
  node rs-reels.mjs edit "D:/Work/RS/raw/محمد علاء - ورشة المحاسب المالي.mp4"
  ```
  ده بيشغّل الـ file server على :7777 + الـ subtitle editor على :5173.
- الـ Dashboard بيـ open الـ editorUrl في tab جديدة بـ query params كاملة (video + captions + saveBase + name).
- راجع الـ subtitles، اعمل الـ splits/merges المطلوبة، دوس **Approve & Save**.
- في الـ background: [`scripts/diff_captions.mjs`](../scripts/diff_captions.mjs) fires-and-forget لما الـ save endpoint يتنادى → word-level corrections بتتـ append على [`feedback/whisper_corrections.jsonl`](../feedback/whisper_corrections.jsonl) بدون أي effort إضافي. راجع الـ Section 11 للتفاصيل.

### 4.4 Micro Events
دوس **Micro Events** بعد ما Claude session يخلص من Phase 5/6 (شوف Section 5). بيشغّل `node scripts/generate_micro_events.mjs <slug>` اللي بيقرا الـ emphasis_moments من الـ content_analysis ويولّد Tier 2 retention beats (~1 كل 4 ثواني).

ده في theory batchable، لكن في practice Omar بيـ trigger-ه يدوياً لأنه بياخد ثواني معدودة.

---

## 5. The handoff to Claude for Phase 5/6

ده الجزء الوحيد اللي Claude لسه بتدخل فيه. Omar مش بيـ start Claude session عشان يشغّل scripts — بيـ start-ها عشان تفكر.

### Steps

1. بعد ما الـ Transcribe phase تخلص، زرار **🤖 Send to Claude** بيبقى enabled على الـ card.
2. دوس عليه → modal بيفتح مع الـ handoff message كامل:
   - اسم الفيديو + path
   - lecturer + workshop
   - المدة
   - الـ derived files الجاهزة (captions + face_map + energy + speech_rhythm)
   - الـ 5 instructions المطلوبة من Claude
3. دوس **📋 Copy to Clipboard** — الـ text يتنسخ.
4. افتح Claude session جديدة (VS Code extension أو `claude.ai/code`) — **session جديدة نظيفة عشان ما تورثش context من شغل سابق**.
5. Paste الرسالة. Claude هيعمل:
   - Phase 5: content analysis → `src/data/<slug>/content_analysis.json`
   - Phase 6: animation plan → `src/data/<slug>/animation_plan.json`
   - Phase 6.5: `node scripts/generate_micro_events.mjs "<slug>"`
   - Validation: `node scripts/validate_plan.mjs "<slug>"`
6. لما Claude تقول "تمام، ارجع للـ Dashboard ودوس Render" → ارجع لـ `http://localhost:5174` وكمّل.

### Why the handoff is copy-paste

الـ Dashboard **ما بيـ invoke Claude directly**. ده قرار متعمّد:
- مفيش API key هيـ burn rate limits
- Omar بيقدر يراجع الرسالة قبل الـ paste + يعدّل لو فيه سياق إضافي
- Claude session بتفضل interactive — لو فيه سؤال Claude محتاج يسأله عن الـ content، بيحصل طبيعي

---

## 6. Running the render

ارجع للـ Dashboard على `http://localhost:5174`:
- دوس **Render** على الـ card
- الـ API بيشغّل `node rs-reels.mjs make <path> --skip-audio --skip-transcribe`
- الـ log viewer بيـ stream الـ progress (بيـ parse `Rendered X/Y` لـ percentage)
- الـ runtime ~5-8 دقيقة بحسب طول الفيديو
- لما يخلص، الـ reel بيتحفظ next to the source video كـ `<name>-reel.mp4`

---

## 7. Rating the result

بعد ما render يخلص:
- RatingInput widget بيظهر inline على الـ card
- Click 1-5 stars + (اختيارياً) اكتب note قصير
- دوس Save → الـ API بيكتب على الـ state file + بيـ append على [`feedback/log.json`](../feedback/log.json) بنفس shape الـ entries القديمة
- لو الفيديو متقيّم قبل كده، بيظهر pill مع Edit link

ده بيـ replace الـ step اللي كان Claude بتسأله في الـ context زمان.

---

## 8. Bulk mode

لو عندك 5-10 فيديوهات جاهزين نفس الوقت:

1. دوس الـ checkbox في الـ top-right على كل card اللي عايز تـ include-ه. الـ cards المختارة بياخدوا accent-gold border + shadow.
2. الـ `BatchToolbar` بيظهر فوق الـ grid لما `selectedVideoIds.size > 0` — فيه:
   - Counter ("3 videos selected")
   - Phase dropdown — الـ allowed phases: `phase1` / `transcribe` / `microEvents` / `render` (مش `edit` — ده manual)
   - "Continue on error" checkbox (default: on)
   - "Select all" / "Clear" buttons
   - "Run on N" button
3. دوس **Run on N** → confirm dialog → الـ batch يبتدي.
4. الـ `BatchStatus` panel في الـ bottom-right بيظهر مع:
   - Headline ("Processing 2/3 — <video name>")
   - Overall progress bar
   - Colored log tail (info / success / error)
   - Cancel button (mid-flight)
5. الـ batch runner **sequential** (GPU واحد — مفيش parallel). كل فيديو بيخلص قبل ما التاني يبتدي.
6. `continueOnError: true` → لو فيديو فشل، الـ batch يكمل ويـ mark-ه failed. `continueOnError: false` → يوقف ويـ mark الباقي كـ cancelled.
7. Cancel mid-flight: الـ current job بيخلص طبيعي، الباقي بيتـ skip.

### Limitations (non-goals by design)

- **Batch state in-memory فقط** — لو الـ API server restart-ت mid-batch، الـ batch بيضيع (بس الفيديوهات اللي خلصت فعلاً بتفضل محفوظة في `state/videos.json`).
- **مفيش batched Claude analysis** — Phase 5/6 لسه manual per فيديو.
- **مفيش batch rating** — قيّم كل واحد فرد.

---

## 9. Troubleshooting

### Port conflict
- الـ API default = 7778. لو الـ port مشغول: `DASHBOARD_PORT=7779 npm run dashboard:api` + عدّل الـ vite proxy في [`dashboard-ui/vite.config.ts`](../dashboard-ui/vite.config.ts).
- الـ UI default = 5174. Vite هيختار port تاني تلقائياً لو 5174 مشغول — بس الـ CORS في [`dashboard-api/server.mjs`](../dashboard-api/server.mjs) متقيد على 5174، فلو الـ port اتغير لازم تعدّل الـ `cors({ origin: [...] })` list.

### State file corruption
- Path: `dashboard-api/state/videos.json`
- Reset: `echo '{"videos":[]}' > dashboard-api/state/videos.json` — الـ Dashboard بيـ reload الـ state من disk على كل restart.
- Backup قبل الـ reset لو عايز تحتفظ بالـ ratings: `cp dashboard-api/state/videos.json dashboard-api/state/videos.json.bak`

### SSE stuck / progress stops updating
- الـ `EventSource` في الـ browser ساعات بيـ disconnect silently. Refresh الـ page — الـ store بيعيد fetch + يـ re-subscribe.
- لو الـ job فعلاً عالق: `curl http://localhost:7778/api/jobs` → شوف الـ job's `status` + `exitCode`. لو `running` لفترة طويلة بدون progress، kill الـ API server وشغّله تاني.

### Subtitle editor ما بيفتحش
- الـ Edit phase محتاج terminal تانية شغّالة `node rs-reels.mjs edit <path>` (شوف Section 4.3). لو ما شغّلتش الـ command دي، الـ editorUrl هيفتح بس :5173 + :7777 مش هيردوا.
- ده non-goal معروف — الـ automation هيتضاف في future session.

### Claude handoff copy-to-clipboard فشل
- `navigator.clipboard.writeText()` محتاج HTTPS أو localhost. بما إن الـ Dashboard localhost-only، المفروض يشتغل. لو فشل، الـ modal بيعرض الرسالة في `<pre>` — select all + Ctrl+C يدوي.

### Render فشل بـ "Insufficient memory"
- Remotion concurrency في [`remotion.config.ts`](../remotion.config.ts) = 14. لو الـ GPU VRAM ضايق، قلّله لـ 10 أو 8. ده بيحصل بشكل خاص لو في batch render فيه فيديوهات طويلة.

---

## 10. CLI-first workflow (fallback)

الـ CLI لسه كامل الشغل كـ debugging path. مثال كامل:

```bash
node rs-reels.mjs phase1 <video>
node rs-reels.mjs make <video> --lecturer "..." --workshop "..." --dry
node rs-reels.mjs edit <video>
# Claude runs Phase 5 + 6 + 6.5 here
node rs-reels.mjs make <video> --lecturer "..." --workshop "..." --skip-audio --skip-transcribe
```

استخدم الـ CLI لما:
- بتـ debug bug في رصد الـ scripts الأساسية (الـ Dashboard abstraction بيخفي stdout)
- عايز تشغّل `--from / --to` range render (لسه مش في الـ UI)
- بتشتغل على machine من غير browser (remote SSH session)
- `rs-reels.mjs performance` — recording post-publish metrics (مش في الـ Dashboard لسه)

الـ `rs-reels.mjs` بيطبع banner small في الـ top بيـ nudge-ك ناحية الـ Dashboard، بس مفيش حاجة اتكسرت في الـ CLI flow.

---

## 11. The Whisper corrections tracker (background)

كل مرة تـ approve captions في الـ subtitle editor، [`scripts/diff_captions.mjs`](../scripts/diff_captions.mjs) بيشتغل fire-and-forget ويـ append word-level corrections لـ [`feedback/whisper_corrections.jsonl`](../feedback/whisper_corrections.jsonl). زيرو effort من Omar.

### الـ format

```jsonl
{"original":"المصروف","corrected":"المصاريف","context_before":"حساب","context_after":"الفحص","time_sec":45.2,"project":"<basename>","date":"2026-04-15"}
```

### إزاي تعرف إيه اللي اتسجّل

```bash
wc -l feedback/whisper_corrections.jsonl      # total corrections so far
tail -20 feedback/whisper_corrections.jsonl   # last 20 entries
```

### الـ threshold للـ fine-tuning

- **500+ corrections** OR **30+ projects** → وقت الـ LoRA fine-tune
- التفاصيل كاملة في [`docs/phase-11-whisper-finetuning.md`](phase-11-whisper-finetuning.md)
- لحد ما نوصل للـ threshold، الـ JSONL بس بيتراكم. مفيش effort.

### الـ raw snapshot

أول مرة فيديو يعمل transcribe، الـ pipeline بيعمل copy لـ `<video>.captions.raw.json` (gitignored). الـ subsequent runs ما بيعملوش overwrite — عشان الـ baseline اللي بتتقارن بيه يفضل ثابت. لو عايز تـ force regenerate: امسح الـ raw.json قبل ما تـ re-run الـ transcribe.

---

## 12. File layout reference

```
dashboard-api/
  server.mjs              Express + CORS + health + route mounts
  routes/
    videos.mjs            CRUD على الفيديوهات
    phases.mjs            POST /:id/{phase1,transcribe,edit,micro-events,render,handoff}
    progress.mjs          GET /:jobId SSE stream
    rating.mjs            POST /:id/rating → state + feedback/log.json
    batch.mjs             POST /batch/:phase + GET/cancel/stream
  lib/
    state.mjs             load/save state/videos.json
    jobs.mjs              spawn wrapper + SSE registry + waitForJob()
    batch.mjs             sequential batch runner + events
    handoff.mjs           Claude handoff message builder
    paths.mjs             per-video file path helpers
  state/
    videos.json           gitignored — persisted per-video state

dashboard-ui/
  vite.config.ts          port 5174, proxy /api → :7778
  src/
    main.tsx + App.tsx    layout
    api/
      client.ts           fetch wrappers + EventSource helpers
      types.ts            Video / PhaseState / BatchEvent types
    store/
      useDashboardStore.ts  videos + logs + selection + actions
      useBatchStore.ts      active batch + log + subscriptions
    components/
      VideoList.tsx          grid + BatchToolbar
      VideoCard.tsx          per-video card (checkbox + 5 phase buttons + log viewer + handoff + rating)
      AddVideoForm.tsx       path input modal
      PhaseButton.tsx        per-phase button w/ status
      StatusPill.tsx         status badge
      ProgressBar.tsx        reusable progress bar
      LogViewer.tsx          collapsible SSE log tail
      ClaudeHandoffModal.tsx handoff message + copy button
      RatingInput.tsx        5-star + note + save
      BatchToolbar.tsx       sticky selection toolbar
      BatchStatus.tsx        bottom-right panel for active batch
      EmptyState.tsx         shown when videos list empty
```

---

## 13. Start-of-session checklist (for future Claude sessions)

لو دخلت في Claude session جديدة وعايز تعمل لـ Omar فيديو جديد:

1. **ما تشغّلش الـ pipeline من Bash**. الـ Dashboard بيعمل ده. دوّر على feedback memory `feedback_dashboard_workflow.md`.
2. اقرأ [`CLAUDE.md`](../CLAUDE.md) + [`brands/rs/BRAND.md`](../brands/rs/BRAND.md) + [`feedback/style_evolution.md`](../feedback/style_evolution.md).
3. لو Omar بعت الـ handoff message من الـ Dashboard: دوس على Phase 5 + 6 + 6.5 exactly. اكتب الـ JSON files. شغّل الـ validator. ارجعه للـ Dashboard.
4. لو Omar طلب منك Bash commands صراحة (debugging, range render, perf): استخدم الـ CLI. ده exception مش default.
