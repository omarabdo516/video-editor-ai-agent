# Video Editor AI Agent — Claude Code Instructions

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

## ✅ الحالة الحالية (Phase A + B خلصوا)

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

### Phase 3 ❌ (مؤجل)
- [ ] Subtitle Editor UI (Vite + React + Zustand + wavesurfer) — مؤجل لحد ما caps.js يبقى مش كفاية

### Phase 4 ✅ (via caps.js)
- [x] User بيعدّل الـ `.srt` يدوياً في VS Code أو Subtitle Edit، caps.js بيعيد import

### Phase 5 ❌
- [ ] Content analysis (sections, key moments, keywords, emphasis)

### Phase 6 ❌
- [ ] Animation planning (full plan generation, مش بس zoom)

### Phase 7 ⚠️ (في تقدم)
- [x] [`src/Reel.tsx`](src/Reel.tsx) — main composition (يدعم optional zoomPlan)
- [x] [`src/Root.tsx`](src/Root.tsx) — registration + preview-props
- [x] [`src/components/VideoTrack.tsx`](src/components/VideoTrack.tsx)
- [x] [`src/components/WordCaption.tsx`](src/components/WordCaption.tsx) — Hormozi-like word highlighting
- [x] [`src/components/LogoBug.tsx`](src/components/LogoBug.tsx) — top-center
- [x] [`src/components/LowerThird.tsx`](src/components/LowerThird.tsx)
- [x] [`src/components/Outro.tsx`](src/components/Outro.tsx)
- [x] [`src/components/SmartZoom.tsx`](src/components/SmartZoom.tsx) — **NEW (Phase B)** — spring ramp + face-centered transform + edge clamping
- [x] [`src/tokens.ts`](src/tokens.ts) — design tokens runtime source
- [x] [`src/utils/chunk.ts`](src/utils/chunk.ts) — caption rechunking
- [x] [`src/utils/fonts.ts`](src/utils/fonts.ts) — @remotion/google-fonts (Cairo + Tajawal)
- [ ] Explainer Scene components (definition, equation, comparison, process, etc.)
- [ ] Overlay components (keyword_highlight, counter, stamp, underline)
- [ ] Chapter Divider component
- [ ] Multiple caption styles (الخطة 6 ستايلات — Hormozi, Karaoke, Pop, Box, Typewriter, Classic)
- [ ] `@remotion/captions` integration

### Phase 8 ✅ (كامل)
- [x] [`rs-reels.mjs`](rs-reels.mjs) — hybrid CLI (`make` + `studio` + `phase1`)
- [x] HTTP video server (port 7777 للـ studio، random للـ render) — يحل مشكلة OffthreadVideo + file://
- [x] Async render (`spawn` بدل `spawnSync`) — الـ HTTP server يـ serve أثناء الريندر
- [x] [`remotion.config.ts`](remotion.config.ts) — concurrency=14، ANGLE renderer، 12GB cache، `hardware-acceleration=if-possible`
- [x] **Verified:** اتريندر فيديو حقيقي "محمد ريان - ورشة الشامل" (293MB، 203 segments)
- [x] zoom_plan.json auto-loading (لو موجود next to source video)

### Phase 9 ❌
- [ ] Feedback loop (log.json updates + style_evolution + best_components archiving)

### Phase B (Batch) ❌
- [ ] Multi-video batch processing

---

## 🏗️ قرارات معمارية

### 1. CLI: Hybrid (monolithic + phase-based)

```bash
# الاستخدام السريع (happy path — كل حاجة بترفض في command واحد):
node rs-reels.mjs make <video> --lecturer "..." --workshop "..."
node rs-reels.mjs studio <video> --lecturer "..." --workshop "..."

# الاستخدام الذكي (Claude بيقف بين الخطوات):
node rs-reels.mjs phase1 <video>     # ✅ audio + scale + metadata + face_map + energy
# Phase 2: node rs-reels.mjs phase2 (planned)
# Phase 5/6: Claude بيعمل التحليل في الـ context
node rs-reels.mjs studio <video>     # preview + يحمّل zoom_plan.json تلقائياً
node rs-reels.mjs make <video>       # render نهائي
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
| 5 | [`docs/phase-5-content-analysis.md`](docs/phase-5-content-analysis.md) | ❌ | captions → analysis |
| 6 | [`docs/phase-6-animation-planning.md`](docs/phase-6-animation-planning.md) | ❌ | analysis → animation plan |
| 7 | [`docs/phase-7-remotion-components.md`](docs/phase-7-remotion-components.md) | ⚠️ | plan → components (Smart Zoom done) |
| 8 | [`docs/phase-8-render.md`](docs/phase-8-render.md) | ✅ | components → final.mp4 |
| 9 | [`docs/phase-9-feedback.md`](docs/phase-9-feedback.md) | ❌ | rating → evolution |
| B | [`docs/phase-B-batch.md`](docs/phase-B-batch.md) | ❌ | multi-video batch |

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
