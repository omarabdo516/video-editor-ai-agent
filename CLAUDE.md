# Video Editor AI Agent — Claude Code Instructions

## 📍 Next Up — اللي بنبدأ فيه دلوقتي

> **آخر تحديث:** 2026-04-14 — Phase 7 iteration 2 خلصت: 3 scene types جديدة (definition/equation/counter) + ChapterDivider + PopStyle caption. الـ agent جاهز للفيديو الجديد.

**الحالة:** Phase 0-9 كلهم كاملين. Phase 7 فيه دلوقتي 7 scene types + 2 caption styles + chapter dividers + 2 overlay types + 3 micro types + VideoBreathing. الـ gaps الفعلية الوحيدة: caption styles إضافية (Karaoke/Box/Typewriter/Classic) + scene types (chart/diagram) — مش blocking. Phase B (batch) مؤجّل.

**الخطوة الجاية:** **فيديو RS جديد** (end-to-end run)

اقرأ بالترتيب في الـ session الجاي:
1. الملف ده بالكامل (CLAUDE.md)
2. [`brands/rs/BRAND.md`](brands/rs/BRAND.md) — قواعد البراند
3. [`feedback/style_evolution.md`](feedback/style_evolution.md) — **أعلى أولوية** — تفضيلات المتراكمة
4. `~/.claude/projects/.../memory/` — 9 memory files (user-level, auto-loaded)
5. [`docs/phase-7-remotion-components.md`](docs/phase-7-remotion-components.md) — 3-tier architecture
6. [`docs/scene-validation-rules.md`](docs/scene-validation-rules.md) — **15s scene spacing** (مش 45)

**الـ inputs المطلوبة من المستخدم لفيديو جديد:**
- ملف الفيديو (.mp4 / .mov)
- اسم المحاضر
- اسم الورشة
- قرار caption style: Hormozi (default) أو Pop

**الـ Pipeline للفيديو الجديد:**
```
1. node rs-reels.mjs phase1 <video>              (preprocessing, ~3-5 min)
2. node rs-reels.mjs make <video> --dry          (transcribe + fix, ~2-3 min)
3. node rs-reels.mjs edit <video>                (manual subtitle review)
4. Claude Code runs Phase 5 + 6 in-context       (analysis + plan, ~10 min)
5. node scripts/generate_micro_events.mjs <name> (auto, instant)
6. node rs-reels.mjs make <video> --skip-audio --skip-transcribe  (render, ~5 min)
7. Phase 9: collect feedback + update log        (2-3 min)
```

**الـ Scene types المتاحة حالياً (7):**
- `process_stepper` — stepper بـ 3+ cards مرتبة عمودياً + stagger + status badges
- `process_timeline` — horizontal nodes مع connector line + done/next/future states
- `comparison_two_paths` — ✗ vs ✓ columns
- `big_metaphor` — massive headline + subline + footer (closing moments)
- `definition` — term accent + definition body + optional icon/example
- `equation` — LTR equation with tokens that appear one-by-one + labeled terms + result highlight
- `counter` — massive count-up number + top/bottom labels (social proof, stats)

**الـ plan template:** كل scene element يحدد الـ type بالـ element type (مش الـ scene_type)، والـ FullScreenScene dispatcher بيختار الـ component صح.

**قبل أي تعديل كبير على scenes موجودة:** استنى feedback محدد من المستخدم.

---

## 🎯 المشروع ده إيه

**Video Editor AI Agent** = نظام آلي لمونتاج الريلز التعليمية العربية. بياخد فيديو خام لمحاضر، وبيطلع ريل 9:16 احترافي مع كابشنز متزامنة، Smart Zoom على الوش في لحظات الحماس، lower-third، logo bug، outro، وفي المستقبل: Full-screen scenes + overlays + animation planning ذكي.

**Stack:** Remotion + faster-whisper + MediaPipe + librosa + Claude Code (الـ Brain).

**اللهجة المستهدفة:** عامية مصرية (initially) — قابلة للتوسع لأي عربية.

**الـ AI:** مفيش Claude API. **أنت (Claude Code) هو الـ Brain** اللي بيعمل التحليل والـ animation planning بين الـ phases.

---

## 🏷️ الـ Brand النشط دلوقتي: RS Financial Services

المشروع ده مبني على نظام **multi-brand**:
- كل برند ليه فولدر في `brands/<client>/`
- كل برند فيه `BRAND.md` (هوية + قواعد) + `assets/` (لوجو + أصول)
- حالياً: `brands/rs/` فقط (RS Financial Services)
- مستقبلاً: ممكن نضيف `brands/<other-client>/` ونـ swap الـ tokens.ts

**القاعدة:** قبل أي شغل لـ RS، اقرأ [`brands/rs/BRAND.md`](brands/rs/BRAND.md) — فيه كل القواعد الإجبارية.

---

## 📖 ترتيب القراءة في أي session جديدة

1. **الملف ده (CLAUDE.md)** — current state + قرارات معمارية
2. **[`brands/rs/BRAND.md`](brands/rs/BRAND.md)** — هوية البراند النشط (إجباري — أعلى أولوية)
3. **[`feedback/style_evolution.md`](feedback/style_evolution.md)** — تفضيلات المستخدم المتراكمة
4. **[`docs/design-system.md`](docs/design-system.md)** — قواعد الـ design + الـ rationale
5. **[`feedback/best_components/`](feedback/best_components/)** — أفضل كود محفوظ (فاضي حالياً)

---

## ✅ الحالة الحالية (Phase A + B + C خلصوا)

### Phase 0 ✅ (كامل)
- [x] Remotion v4.0.448 + TypeScript + React 18
- [x] بنية المجلدات: `brands/rs/`, `scripts/`, `feedback/`, `templates/`, `input/`, `output/`, `data/`, `docs/`, `samples/`, `public/`, `src/`
- [x] [`brands/rs/BRAND.md`](brands/rs/BRAND.md) — هوية RS الكاملة
- [x] [`docs/design-system.md`](docs/design-system.md) — design rationale
- [x] [`feedback/log.json`](feedback/log.json) + [`feedback/style_evolution.md`](feedback/style_evolution.md)
- [x] Legacy AE pipeline اتحذف (build-reels.jsx, generate-reels.js, rs-brand-tokens.json)

### Phase 1 ✅ (كامل)
- [x] **FFmpeg audio preprocess** ([`preprocess-audio.js`](preprocess-audio.js)) — highpass/lowpass + loudnorm + 16kHz mono
- [x] **Video pre-scale** للـ 1080×1920 (center crop) — في `rs-reels.mjs`
- [x] **Video metadata** ([`scripts/video_metadata.py`](scripts/video_metadata.py)) — ffprobe → JSON
- [x] **Face detection** ([`scripts/face_detect.py`](scripts/face_detect.py)) — MediaPipe Tasks API + BlazeFace short-range
- [x] **Audio energy** ([`scripts/audio_energy.py`](scripts/audio_energy.py)) — librosa RMS + dramatic-pause detection
- [x] **CLI:** `node rs-reels.mjs phase1 <video>` — يشغّل الأربع خطوات بالـ caching

### Phase 2 ✅
- [x] **faster-whisper** (مش WhisperX — أسرع على CUDA + نفس الجودة) — [`scripts/transcribe.py`](scripts/transcribe.py) + Node wrapper [`transcribe.js`](transcribe.js)
- [x] Model: `large-v3`، CUDA + float16، beam=10، patience=2.0، VAD filter
- [x] Initial prompt محاسبي مصري + word-level timestamps
- [x] **Egyptian Arabic fix** ([`fix-captions.js`](fix-captions.js)) — ض↔د، ث↔س، إلخ
- [x] **SRT edit workflow:** [`caps.js`](caps.js) export JSON → SRT → user edits → import SRT

### Phase 3 ✅ (Phase C — كامل)
- [x] **Subtitle Editor UI** في [`subtitle-editor/`](subtitle-editor/) — Vite 8 + React 19 + TypeScript + Tailwind v4 + Zustand + wavesurfer.js v7
- [x] [`subtitle-editor/src/components/VideoPlayer.tsx`](subtitle-editor/src/components/VideoPlayer.tsx) — HTML5 video + caption overlay + bidirectional sync مع الـ store
- [x] [`subtitle-editor/src/components/WaveformTimeline.tsx`](subtitle-editor/src/components/WaveformTimeline.tsx) — wavesurfer.js مع Regions + Timeline plugins، drag-to-resize، zoom slider
- [x] [`subtitle-editor/src/components/SubtitleList.tsx`](subtitle-editor/src/components/SubtitleList.tsx) — scrollable list + search + word count badges (5-7 = أخضر، غيره = أصفر)
- [x] [`subtitle-editor/src/components/SubtitleEditPanel.tsx`](subtitle-editor/src/components/SubtitleEditPanel.tsx) — start/end inputs + textarea + Split/Merge/Delete + Move first/last word
- [x] [`subtitle-editor/src/components/Toolbar.tsx`](subtitle-editor/src/components/Toolbar.tsx) — Import (.srt/.json) + Export SRT + Approve & Save JSON + Undo/Redo
- [x] [`subtitle-editor/src/components/KeyboardHandler.tsx`](subtitle-editor/src/components/KeyboardHandler.tsx) — Space/Arrows/Ctrl+Z/Ctrl+Shift+Z/Delete/S/M/Ctrl+Shift+←/→
- [x] [`subtitle-editor/src/components/Dropzone.tsx`](subtitle-editor/src/components/Dropzone.tsx) — drag-drop video + .srt/.json
- [x] [`subtitle-editor/src/store/useSubtitleStore.ts`](subtitle-editor/src/store/useSubtitleStore.ts) — Zustand store مع 50-step undo/redo + كل الـ edit actions
- [x] **TypeScript path alias** `@agent/* → ../src/*` — الـ editor بيستورد `CaptionsData` و `WordTiming` types مباشرة من الـ agent (single source of truth)
- [x] **Auto-load via URL params** — `?video=URL&captions=URL&name=...` لما الـ rs-reels CLI يفتح الـ editor

### Phase 4 ✅ (via subtitle-editor + caps.js)
- [x] الـ subtitle editor الجديد بيقبل `.captions.json` + `.srt` ويحفظ approved JSON
- [x] الـ caps.js workflow القديم لسه شغّال للـ users اللي بيفضّلوا VS Code/Subtitle Edit

### Phase 5 ✅
- [x] **Content analysis** — sections + key_moments + keywords + emphasis_moments + phase_6_hints
- [x] الـ output في `src/data/<video_basename>/content_analysis.json` (مش جنب الفيديو — عشان الـ learning loop)
- [x] **Done by Claude Code in-context** — مفيش API calls
- [x] الفيديو الأول اللي اتحلل: `محمد ريان - ورشة الشامل` (203 segments → 6 sections, 13 key_moments, 17 keywords, 39 emphasis)
- [x] [`docs/phase-5-content-analysis.md`](docs/phase-5-content-analysis.md) اتحدّث ليطابق الواقع

### Phase 6 ✅ (كامل)
- [x] **Animation planning** — full plan: scenes + smart_zooms + overlays + micro_events + timing
- [x] الـ output في `src/data/<video_basename>/animation_plan.json`
- [x] **Validation**: scenes ≥45s spacing, zooms ≥30s + face conf ≥0.5, overlays ≥20s
- [x] Phase 6.5 (micro-events): `scripts/generate_micro_events.mjs` — auto-generator يقرا emphasis_moments ويولّد Tier 2 beats لـ retention rhythm كل ~4 ثواني
- [x] **Done by Claude Code in-context** — مفيش API calls
- [x] الفيديو الأول اللي اتخطط: `محمد ريان - ورشة الشامل` (4 scenes, 4 big zooms, 5 overlays, 30 micro events = 43 total, cadence 4.86s)

### Phase 7 ⚠️ (base كامل — iteration مستمر)

**موجود وشغّال:**
- [x] [`src/Reel.tsx`](src/Reel.tsx) — main composition: 3-tier event system (major / micro / continuous)
- [x] [`src/Root.tsx`](src/Root.tsx) — registration + preview-props + animationPlan support
- [x] [`src/components/VideoTrack.tsx`](src/components/VideoTrack.tsx)
- [x] [`src/components/VideoBreathing.tsx`](src/components/VideoBreathing.tsx) — **NEW** Tier 3 continuous 1.5% scale oscillation
- [x] [`src/components/WordCaption.tsx`](src/components/WordCaption.tsx) — Hormozi-like word highlighting **+ emphasis boost** (scale 1.28 + accent glow when emphasis time active)
- [x] [`src/components/LogoBug.tsx`](src/components/LogoBug.tsx) — **بيفضل ظاهر طول الوقت** (يغطي scenes كمان — feedback من Omar)
- [x] [`src/components/LowerThird.tsx`](src/components/LowerThird.tsx)
- [x] [`src/components/Outro.tsx`](src/components/Outro.tsx)
- [x] [`src/components/SmartZoom.tsx`](src/components/SmartZoom.tsx) — spring ramp + face-centered transform + edge clamping (+ mini zooms من Tier 2)
- [x] **Scene components (7)**:
  - [x] [`scenes/FullScreenScene.tsx`](src/components/scenes/FullScreenScene.tsx) — wrapper + element-driven dispatcher
  - [x] [`scenes/ProcessStepperScene.tsx`](src/components/scenes/ProcessStepperScene.tsx) — 3 cards stagger
  - [x] [`scenes/ProcessTimelineScene.tsx`](src/components/scenes/ProcessTimelineScene.tsx) — horizontal nodes
  - [x] [`scenes/ComparisonTwoPathsScene.tsx`](src/components/scenes/ComparisonTwoPathsScene.tsx) — ✗ vs ✓
  - [x] [`scenes/BigMetaphorScene.tsx`](src/components/scenes/BigMetaphorScene.tsx) — headline + subline
  - [x] [`scenes/DefinitionScene.tsx`](src/components/scenes/DefinitionScene.tsx) — **NEW** term + definition + optional icon/example
  - [x] [`scenes/EquationScene.tsx`](src/components/scenes/EquationScene.tsx) — **NEW** left-to-right equation builder with labels
  - [x] [`scenes/CounterScene.tsx`](src/components/scenes/CounterScene.tsx) — **NEW** massive count-up number with top/bottom labels
- [x] **Chapter divider (NEW)**:
  - [x] [`scenes/ChapterDivider.tsx`](src/components/scenes/ChapterDivider.tsx) — 2-3s section break (kicker + title + underline + subtitle)
- [x] **Overlay components (2)**:
  - [x] [`overlays/Overlay.tsx`](src/components/overlays/Overlay.tsx) — dispatcher
  - [x] [`overlays/KeywordHighlightOverlay.tsx`](src/components/overlays/KeywordHighlightOverlay.tsx) — pill + badge
  - [x] [`overlays/StampOverlay.tsx`](src/components/overlays/StampOverlay.tsx) — bordered rotated stamp
- [x] **Micro-event components (Tier 2)**:
  - [x] [`micro/MicroEventHost.tsx`](src/components/micro/MicroEventHost.tsx) — dispatcher
  - [x] [`micro/CaptionUnderline.tsx`](src/components/micro/CaptionUnderline.tsx) — animated underline under captions
  - [x] [`micro/AccentFlash.tsx`](src/components/micro/AccentFlash.tsx) — edge bar flash
  - [x] `word_pop` = in-caption boost (not a separate component — handled via WordCaption emphasisTimes prop)
  - [x] `mini_zoom` = merged into smart_zoom_plan (not a separate component)
- [x] [`src/tokens.ts`](src/tokens.ts) — design tokens + scenes + overlays + springs presets
- [x] [`src/utils/chunk.ts`](src/utils/chunk.ts) — caption rechunking
- [x] [`src/utils/fonts.ts`](src/utils/fonts.ts) — @remotion/google-fonts (Cairo + Tajawal)

- [x] **Caption styles (2)**:
  - [x] [`WordCaption.tsx`](src/components/WordCaption.tsx) — Hormozi (default) — all words in segment + active-word highlight + emphasis boost
  - [x] [`WordCaptionPop.tsx`](src/components/WordCaptionPop.tsx) — **NEW** Pop style — one huge word at a time, body zone, bouncy

**ناقص (iteration مستقبلي):**
- [ ] Caption styles (4 باقي): Karaoke, Box, Typewriter, Classic
- [ ] Scene types جدد: chart, diagram
- [ ] `@remotion/captions` integration
- [ ] Scene polish من feedback الـ user بعد ما شاف الـ full render

### Phase 8 ✅ (كامل)
- [x] [`rs-reels.mjs`](rs-reels.mjs) — hybrid CLI (`make` + `studio` + `phase1` + `edit`)
- [x] **HTTP file server** (port 7777) — refactored من video-only لـ multi-route، بيخدم video + captions + أي ملف
- [x] Async render (`spawn` بدل `spawnSync`) — الـ HTTP server يـ serve أثناء الريندر
- [x] [`remotion.config.ts`](remotion.config.ts) — concurrency=14، ANGLE renderer، 12GB cache، `hardware-acceleration=if-possible`
- [x] **Verified:** اتريندر فيديو حقيقي "محمد ريان - ورشة الشامل" (293MB، 203 segments)
- [x] zoom_plan.json auto-loading (لو موجود next to source video)
- [x] `edit` subcommand — يشغّل الـ subtitle editor مع auto-load للـ video + captions

### Phase 9 ✅ (infrastructure + first entry)
- [x] [`feedback/log.json`](feedback/log.json) — first project entry (محمد ريان - ورشة الشامل) مع 8 feedback items
- [x] [`feedback/style_evolution.md`](feedback/style_evolution.md) — 8 entries من الـ session الأول
- [x] Memory system — 7 memory files في `~/.claude/projects/.../memory/` (user-level)
- [x] [`docs/phase-9-feedback.md`](docs/phase-9-feedback.md) — اتحدّث ليطابق الـ in-context implementation
- [ ] Automation: أسئلة rating UI/script (اختياري — دلوقتي Claude بيسألهم في الـ context)

### Phase B (Batch) ❌
- [ ] Multi-video batch processing

---

## 🏗️ قرارات معمارية

### 1. CLI: Hybrid (monolithic + phase-based)

```bash
# الاستخدام السريع (happy path — كل حاجة في command واحد):
node rs-reels.mjs make   <video> --lecturer "..." --workshop "..."   # full pipeline
node rs-reels.mjs studio <video> --lecturer "..." --workshop "..."   # Remotion Studio preview

# الاستخدام التفصيلي (phase-by-phase):
node rs-reels.mjs phase1 <video>     # ✅ audio + scale + metadata + face_map + energy
node rs-reels.mjs edit   <video>     # ✅ subtitle editor (Vite + wavesurfer)
# Phase 2: node rs-reels.mjs phase2 (planned)
# Phase 5/6: Claude بيعمل التحليل في الـ context مش في command
```

### 2. Tokens vs Design System

- [`src/tokens.ts`](src/tokens.ts) = **الأرقام للـ runtime** (TypeScript type-safe). الكود بيستورده مباشرة.
- [`docs/design-system.md`](docs/design-system.md) = **الـ rationale + القواعد + الـ "ليه/امتى"**.
- [`brands/rs/BRAND.md`](brands/rs/BRAND.md) = **الثوابت الإجبارية** للبراند (ألوان + خطوط + لوجو). **أعلى أولوية** — ما تتغيرش.

**القاعدة:** لما feedback يعدّل قيمة → عدّل `tokens.ts` + سطر شرح في `design-system.md` + entry في `feedback/style_evolution.md`.

### 3. Multi-Brand (مستقبلاً)

البنية الحالية بتدعم multi-brand بشكل مبدئي:
```
brands/
  rs/
    BRAND.md          ← هوية البراند
    assets/
      logo.png        ← brand-owned copy
      logo-alt.png
  <future-client>/
    BRAND.md
    assets/
      ...
```

دلوقتي `src/tokens.ts` فيه قيم RS hardcoded. الـ refactor المستقبلي:
- يحوّل tokens.ts لـ `tokens/rs.ts`، `tokens/<client>.ts`
- CLI يقبل `--brand <name>` flag
- Build step يـ copy `brands/<active>/assets/*` → `public/`

دلوقتي مفيش حاجة من ده — بس البنية جاهزة.

### 4. Transcription: faster-whisper (مش WhisperX)

- CTranslate2 backend أسرع على RTX 5060 Ti
- نفس الجودة + word timestamps + VAD
- أقل dependencies (مش محتاج torch manual setup)

### 5. Smart Zoom: Plan-driven

- **Phase 1** بيطلع raw data: `face_map.json` + `energy.json`
- **Phase 6 (مستقبلاً)** أو Claude يدوياً بيقرأ الـ raw data ويولّد `zoom_plan.json`
- [`src/components/SmartZoom.tsx`](src/components/SmartZoom.tsx) بيقرأ الـ plan ويرسم spring transform
- الـ component dummy في الذكاء — كل القرارات في الـ plan

---

## 🔄 الـ Phases — نفذ بالترتيب

كل Phase ليها ملف تفصيلي في `docs/`. اقرأ ملف الـ Phase قبل ما تبدأ فيها.

| Phase | الملف | الحالة | Input → Output |
|-------|-------|--------|----------------|
| 0 | [`docs/phase-0-setup.md`](docs/phase-0-setup.md) | ✅ | setup → project ready |
| 1 | [`docs/phase-1-preprocessing.md`](docs/phase-1-preprocessing.md) | ✅ | video → audio + face_map + energy + metadata |
| 2 | [`docs/phase-2-transcription.md`](docs/phase-2-transcription.md) | ✅ | audio → captions.json + .srt |
| 3 | [`docs/phase-3-subtitle-editor.md`](docs/phase-3-subtitle-editor.md) | ❌ | subtitle editor UI |
| 4 | [`docs/phase-4-captions-review.md`](docs/phase-4-captions-review.md) | ✅ (caps.js) | srt → approved JSON |
| 5 | [`docs/phase-5-content-analysis.md`](docs/phase-5-content-analysis.md) | ✅ | captions+energy+metadata → content_analysis.json |
| 6 | [`docs/phase-6-animation-planning.md`](docs/phase-6-animation-planning.md) | ✅ | analysis → animation plan |
| 6.5 | [`docs/phase-6.5-micro-events.md`](docs/phase-6.5-micro-events.md) | ✅ | emphasis → micro_events (Tier 2 retention) |
| 7 | [`docs/phase-7-remotion-components.md`](docs/phase-7-remotion-components.md) | ⚠️ | base done (4 scenes, 2 overlays, 3 micro, breathing) — polish + more styles |
| 8 | [`docs/phase-8-render.md`](docs/phase-8-render.md) | ✅ | components → final.mp4 |
| 9 | [`docs/phase-9-feedback.md`](docs/phase-9-feedback.md) | ✅ | rating → log.json + style_evolution.md |
| B | [`docs/phase-B-batch.md`](docs/phase-B-batch.md) | ❌ (مؤجّل) | multi-video batch |

**⚠️ لما المستخدم يقول "ابدأ Phase X" → اقرأ `docs/phase-X-...md` واشتغل.**

---

## 🎨 قبل كتابة أي component

1. اقرأ [`brands/<active>/BRAND.md`](brands/rs/BRAND.md) — القواعد الإجبارية
2. اقرأ [`docs/design-system.md`](docs/design-system.md) — الـ rationale
3. اقرأ [`feedback/style_evolution.md`](feedback/style_evolution.md) — تفضيلات المستخدم
4. شوف [`feedback/best_components/`](feedback/best_components/) لو فيه component مشابه
5. **استخدم القيم من `src/tokens.ts`** — مفيش hardcoded values في الـ components
6. **الخط Cairo أو Tajawal. الكتابة RTL. الأرقام إنجليزية.**

---

## 🛡️ Scene Validation

(التفاصيل في [`docs/scene-validation-rules.md`](docs/scene-validation-rules.md))

- ✅ **Full-Screen Scene**: مفهوم مجرد + يتوضح بصرياً + مفيش demo. الحد الأدنى بين scenes: **45 ثانية**.
- ✅ **Smart Zoom**: face confidence > 0.5 + audio energy عالية. الحد: **1 كل 30 ثانية**.
- ✅ **Overlay**: keyword/رقم/تنبيه. الحد: **1 كل 20 ثانية**.

---

## 📝 بعد كل ريندر نهائي — إجباري

(التفاصيل في [`docs/phase-9-feedback.md`](docs/phase-9-feedback.md))

1. اسأل عن تقييم كل عنصر (1-5)
2. سجّل في [`feedback/log.json`](feedback/log.json)
3. حدّث [`feedback/style_evolution.md`](feedback/style_evolution.md)
4. عنصر 5/5 → احفظ في [`feedback/best_components/`](feedback/best_components/)
5. لو قيمة اتغيرت → حدّث `src/tokens.ts` + `docs/design-system.md`
6. `git commit`
7. كل 3 مشاريع → اقترح variation جديدة

---

## 🚨 Error Recovery

اقرأ [`docs/error-recovery.md`](docs/error-recovery.md)

---

## 🔧 Stack الحالي

| Layer | Tool | Notes |
|-------|------|-------|
| Video engine | Remotion 4.0.448 | TypeScript + React 18 |
| Transcription | faster-whisper (Python 3.11) | CUDA + float16 + large-v3 |
| Face detection | MediaPipe 0.10.33 (Tasks API) | BlazeFace short-range — `scripts/models/` |
| Audio analysis | librosa 0.11.0 | RMS + dramatic pause detection |
| Audio I/O | FFmpeg | `C:/ffmpeg/bin/ffmpeg.exe` (Windows) |
| Python venv | uv-managed | `C:/Users/PUZZLE/Documents/Claude/_tools/whisper-env/.venv` |
| Fonts | @remotion/google-fonts | Cairo + Tajawal (Arabic subsets) |
| Hardware target | RTX 5060 Ti + i7-14700K + 32GB DDR5 | Render config tuned for it |

---

## 📦 Onboarding session جديدة

لو المستخدم قال "اقرأ الخطة وكمّل":
1. اقرأ الملف ده (CLAUDE.md) — current state + قرارات
2. اقرأ [`brands/rs/BRAND.md`](brands/rs/BRAND.md) — قواعد البراند
3. اقرأ [`docs/design-system.md`](docs/design-system.md) — design rationale
4. اقرأ [`feedback/style_evolution.md`](feedback/style_evolution.md) — تفضيلات تراكمية
5. شوف المستخدم عايز يشتغل في أي Phase
6. اقرأ `docs/phase-X-*.md` للـ phase اللي هتبدأ فيها
7. **استنى موافقة قبل أي تعديل كبير**
