# Video Editor AI Agent — Claude Code Instructions

## 📍 Next Up — اللي بنبدأ فيه دلوقتي

> **آخر تحديث:** 2026-04-16 — **Dashboard iteration #2: managed subtitle editor + IPv6 probe fix**. الـ Edit button في الـ VideoCard كان بيفتح URL للـ subtitle editor على `localhost:5173` بس الـ Vite dev server ما كانش مشغّل (كان Phase 11 session 2 trade-off: "run rs-reels edit in a separate terminal"). ده اتحلّ: `POST /api/videos/:id/edit` بقى يـ spawn `node rs-reels.mjs edit <path>` كـ **managed singleton subprocess** في [`dashboard-api/lib/editorSession.mjs`](dashboard-api/lib/editorSession.mjs)، ينتظر port 5173 يـ accept connections عبر `waitForPort()` (max 30s, poll every 400ms)، ويرجع `{ready: true}` للـ frontend. الـ frontend يفتح الـ URL بس لما `ready === true`. لما Omar يدوس Edit على فيديو تاني → الـ session القديم يتقفل (taskkill /T على Windows) + session جديد يتبدي. لما الـ Dashboard API shutdown (SIGINT/SIGTERM) → `shutdownEditor()` في الـ shutdown hook يكنس الـ editor subprocess. **Bug اتحلّ مع ده**: Vite على Windows بيـ bind IPv6 فقط (`::1:5173` مش `127.0.0.1:5173`)، فالـ `waitForPort()` بيجرّب الاتنين (`127.0.0.1` + `::1`) في parallel ويرجع `true` لو أي واحد منهم succeeded. **CORS fix كمان**: الـ API كان مقبل بس `localhost:5174`، دلوقتي بيقبل أي `localhost:517[0-9]` عشان لو orphan Vite dev servers حجزت 5174/5175/5176، الـ UI اللي على 5177 أو 5178 ييبقى شغّال مع الـ API.
>
> **Dashboard iteration #1 (earlier today)**: **folder scan + name auto-parse**. الـ AddVideoForm بقى فيه tab "فولدر كامل" جنب "فيديو واحد": `POST /api/videos/scan-folder` بيـ walk الفولدر (optional recursive)، يتجاهل الـ derived outputs (`.1080x1920.mp4`, `-reel.mp4`)، ويرجع كل الـ videos مع parsed lecturer/workshop + `alreadyTracked` flag. الـ UI بيعرض editable grid بـ checkboxes، select all / clear، inline lecturer+workshop editing. `POST /api/videos/bulk-add` بيـ add الكل بـ single call. الـ single-video form بقى برضه يعمل auto-parse on path blur — يستدعي `POST /api/videos/parse` ويـ fill الـ lecturer/workshop fields من اسم الملف (convention: `<lecturer> - <workshop>`). الـ parser في [`dashboard-api/lib/parseName.mjs`](dashboard-api/lib/parseName.mjs) — بيـ detect الـ workshop side بالكلمات `ورشة / دورة / محاضرة / كورس / جلسة`، fallback للـ convention (first = lecturer). الـ `addVideo()` في state.mjs بقى يـ auto-parse برضه لو الـ caller ما بعتش lecturer/workshop.
>
> **Phase 11 كامل** (Sessions 1 + 2 + 3 + 4 + 5 + 6). الـ workflow الأساسي للفيديو الجديد بقى عبر **Dashboard UI** (localhost:5174) مش CLI. Claude session بتدخل بس للـ Phase 5 + 6 + 6.5 عبر الـ handoff mechanism (copy-paste، مفيش API invocation). Phase 1 / Transcribe / Edit / Micro Events / Render كلهم من الـ UI بدون Claude session ولا tokens. الـ canonical guide: [`docs/dashboard-workflow.md`](docs/dashboard-workflow.md) — فيه screenshots-in-words لكل زرار، الـ Claude handoff steps، bulk mode، troubleshooting، والـ background Whisper corrections tracker.
>
> **الـ 6 sessions اللي خلصت:**
> 1. Whisper corrections tracker — [`scripts/diff_captions.mjs`](scripts/diff_captions.mjs) + [`feedback/whisper_corrections.jsonl`](feedback/whisper_corrections.jsonl) + [`docs/phase-11-whisper-finetuning.md`](docs/phase-11-whisper-finetuning.md). Fire-and-forget diff بين الـ raw Whisper output + الـ approved captions — zero Omar effort.
> 2. Dashboard API backend — [`dashboard-api/`](dashboard-api/) (Express + SSE + persistent state + ffprobe duration). 5 phase routes + rating route + handoff route + batch routes.
> 3. Dashboard React UI core — [`dashboard-ui/`](dashboard-ui/) (Vite 8 + React 19 + TS + Tailwind v4 + Zustand). VideoList + VideoCard + 5 phase buttons + SSE live progress.
> 4. Polish + Claude handoff + rating UI — ProgressBar + LogViewer + ClaudeHandoffModal + RatingInput + `/handoff` endpoint + rating → feedback/log.json.
> 5. Bulk mode — [`dashboard-api/lib/batch.mjs`](dashboard-api/lib/batch.mjs) sequential runner + `waitForJob()` helper + BatchToolbar + BatchStatus + [`useBatchStore.ts`](dashboard-ui/src/store/useBatchStore.ts). `continueOnError` default = `true`. GPU single → strictly sequential. 4 batchable phases: phase1, transcribe, microEvents, render.
> 6. Docs + memories + context sync + workflow migration (الـ session دي).

**الحالة:** Phase 0-11 كاملين. **Phase 10** كان (Round A Tier 1+2 + Round B + Round C). 4 reels راندرت end-to-end: محمد ريان × 3 (4/5, 3.5/5, 3/5) + محمد علاء × 1 (3.6/5). الـ primary workflow من دلوقتي = Dashboard. Claude ما بتشغّلش scripts من Bash في الـ normal flow.

**الخطوة الجاية:** **content farming على scale**. استخدم الـ Dashboard لكل فيديو جديد. لو عندك 5-10 فيديوهات جاهزين نفس الوقت، اختار الـ checkboxes واعمل bulk phase1 / transcribe / render. الـ `feedback/log.json` + `feedback/whisper_corrections.jsonl` بيتراكموا طبيعي ليوم الـ Whisper LoRA fine-tune (threshold: 500+ corrections أو 30+ projects).

**ما اتضافش في Phase 10:**
- ❌ محذوف نهائياً: Emotion Colors (F13) · Intro 3.5s (F6) · Auto-CTA (F11) · Notifications (F15) · BG Music (F2) · SFX (F1 — طبّقت ثم اتقفلت)
- ⏸️ مؤجّل: Retention Heatmap (F21) · Audio Ducking (F17) · Auto-Splitter (F4)

اقرأ بالترتيب في الـ session الجاي:
1. الملف ده بالكامل (CLAUDE.md)
2. [`docs/dashboard-workflow.md`](docs/dashboard-workflow.md) — الـ primary workflow guide
3. [`brands/rs/BRAND.md`](brands/rs/BRAND.md) — قواعد البراند
4. [`feedback/style_evolution.md`](feedback/style_evolution.md) — **أعلى أولوية** — تفضيلات المتراكمة
5. `~/.claude/projects/.../memory/` — memory files (user-level, auto-loaded) — فيها `feedback_dashboard_workflow.md` + `reference_dashboard_location.md`
6. [`docs/phase-7-remotion-components.md`](docs/phase-7-remotion-components.md) — 3-tier architecture
7. [`docs/scene-validation-rules.md`](docs/scene-validation-rules.md) — **15s scene spacing** (مش 45)

**الـ inputs المطلوبة من المستخدم لفيديو جديد:**
- ملف الفيديو (.mp4 / .mov)
- اسم المحاضر
- اسم الورشة
- caption style: hormozi (default) — **ما تخلطش caption styles في نفس الريل** إلا لو Omar طلب صراحةً

**الـ Pipeline للفيديو الجديد (via Dashboard — الـ default flow):**
```
1. npm run dashboard                             (API + UI مع بعض، instant)
2. افتح http://localhost:5174 → "+ Add Video"   (enter path + lecturer + workshop)
3. Click "Phase 1"                               (preprocessing, ~3-5 min — مفيش Claude)
4. Click "Transcribe"                            (whisper + fix + raw snapshot, ~2-3 min — مفيش Claude)
5. Terminal تانية: node rs-reels.mjs edit <path> (بيشغّل file server :7777 + editor :5173)
   Click "Edit" في الـ Dashboard → يفتح الـ editor في tab جديدة → راجع → Approve
   (fire-and-forget بيـ append corrections لـ feedback/whisper_corrections.jsonl)
6. Click "🤖 Send to Claude"                      → modal → Copy to Clipboard
   Paste في Claude session جديدة → Claude بيعمل Phase 5 + 6 + 6.5 + validation (~5-10 min)
   Claude بيرجعك للـ Dashboard لما تخلص
7. Click "Render"                                (remotion, ~5-8 min — مفيش Claude)
8. Rate inline على الـ card                       (1-5 stars + note → feedback/log.json)
```

> Bulk mode: لو عندك فيديوهات multiple في نفس الوقت، اختار الـ checkboxes → BatchToolbar فوق → اختار phase → "Run on N". الـ runner sequential (GPU واحد). التفاصيل في `docs/dashboard-workflow.md` Section 8.

**الـ Pipeline القديم (CLI-only, for debugging):** لسه شغّال كـ fallback. `node rs-reels.mjs make <video> ...` بتاخد نفس الـ args ونفس الـ output. استخدمها للـ range render (`--from / --to`)، `performance` subcommand، أو debugging أي script فيه bug مطلوب تشوفه مباشر في stdout. الـ `rs-reels.mjs` بيطبع banner صغير بيـ nudge ناحية الـ Dashboard في الـ startup.

> **Phase 11 Session 1 (corrections tracker):** الـ transcribe phase بيحفظ `<video>.captions.raw.json` مرة واحدة (gitignored). لما الـ subtitle editor يـ POST الـ approved captions، [`scripts/diff_captions.mjs`](scripts/diff_captions.mjs) بتشتغل fire-and-forget وتـ append word-level corrections لـ [`feedback/whisper_corrections.jsonl`](feedback/whisper_corrections.jsonl) — ده dataset طبيعي للـ Whisper LoRA fine-tune المستقبلي (التفاصيل في [`docs/phase-11-whisper-finetuning.md`](docs/phase-11-whisper-finetuning.md)). مفيش effort إضافي من Omar.

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

### Phase 10 Round A ✅ (animation variety — Tier 1 + Tier 2)

**Tier 1 (core primitives):**
- [x] **A1 — Scene entrance variety (4 presets)**: [`FullScreenScene.tsx`](src/components/scenes/FullScreenScene.tsx) wrapper بياخد `scene.entrance?: 'fade' | 'scale_bounce' | 'blur_reveal' | 'stagger_cascade'`. default بيتحدد من الـ element type.
- [x] **A2 — Dynamic stagger helper**: [`getStaggerDelay(n)`](src/tokens.ts) exported من tokens.ts. `tokens.scenes.dynamicStagger = { few: 15, some: 10, many: 7 }`.
- [x] **A3 — Element stagger refinement**: ProcessStepperScene + ProcessTimelineScene + EquationScene بقوا بيقروا `getStaggerDelay` بدل القيم الثابتة.
- [x] **A4 — WordCaption emphasis variants**: 3 variants (`normal` / `pop` / `glow`) — نفس الذهبي بـ scale + letter-spacing + shadow intensity مختلفة. `EmphasisBeat` type جديد. `resolveEmphasisIntensity` في Reel.tsx بيقبل legacy `low/medium/high` + الـ enum الجديد.

**Tier 2 (expansion):**
- [x] **A5 — Scene exit variety (3 presets)**: `scene.exit?: 'fade' | 'scale_out' | 'slide_down'`. بيتركّب فوق الـ enter transform بـ `combineTransforms()`. defaults per element type (stepper→slide_down, big_metaphor→scale_out, definition→fade).
- [x] **A6 — Smart zoom easing variety (3 curves)**: `tokens.smartZoomCurves = { smooth_glide, dolly_in, crash_zoom }` — كل curve فيها spring config + rampIn/rampOut frames. `ZoomMoment.easing?: SmartZoomEasing` optional. SmartZoom.tsx بيقرا per-moment. default `dolly_in` (legacy-equivalent).
- [x] **A7 — Micro events expansion**: [`CornerSweep.tsx`](src/components/micro/CornerSweep.tsx) (diagonal 45° accent line sweep من corner) + [`BorderPulse.tsx`](src/components/micro/BorderPulse.tsx) (2px border pulse حوالين caption zone). اضافة في `MicroEventType` + MicroEventHost dispatch.

### Phase 10 Round B ✅ (polish layer)
- [x] **F7 — Dynamic font size**: [`computeDynamicFontSize(wordCount, base)`](src/components/WordCaption.tsx) — WordCaption بيتكبّر للـ segments القصيرة (≤3 كلمات = +20%) ويصغّر للمزحومة (≥8 = -20%). WordCaptionPop بياخد [`popSizeForWord(word, base)`](src/components/WordCaptionPop.tsx) اللي بيصغّر حسب طول الكلمة (chars) عشان لا تفيض من الـ body zone.
- [x] **F5 — Motion Backgrounds**: [`MotionBackground.tsx`](src/components/scenes/MotionBackground.tsx) — gradient angle بيتذبذب ±4° كل 6s + color-stop shift بيتحرك بـ sine خفيف كل 8s. بيتركّب داخل [`FullScreenScene`](src/components/scenes/FullScreenScene.tsx) كـ child sibling قبل SceneBody.
- [x] **F3 — Progress bar**: [`ProgressBar.tsx`](src/components/ProgressBar.tsx) — 4px thin bar في y=210 (تحت logo bug، جوه safe area، بعيد عن Instagram UI). white track + accent fill + soft glow.
- [x] **F1 — SFX layer**: 4 أصوات synthesized بـ ffmpeg (pink/brown noise + sine bursts) في [`public/sfx/`](public/sfx/). [`SfxLayer.tsx`](src/components/SfxLayer.tsx) بيقرا الـ scenes + overlays + zoomPlan + يدور Audio Sequence عند كل event. `tokens.sfx.enabled = false` بيقفّلهم كلهم. volumes quiet (12-20%).
- [x] **F20 — Speech rhythm script**: [`scripts/speech_rhythm.py`](scripts/speech_rhythm.py) — بياخد captions.json ويطلع speech_rhythm.json فيها pace classification + pause detection (micro / breath / dramatic) + summary stats. متكامل في `rs-reels.mjs make` pipeline بعد transcribe (fails soft).
- [x] **F12 — Manual transitions**: ✅ مغطّى أصلاً بـ A1 (entrance variety) + A5 (exit variety) — مفيش حاجة جديدة مطلوبة.

### Phase 10 Round C ✅ (data foundation)
- [x] **F19 — Performance loop**: [`rs-reels.mjs performance <video_or_project> --views N --retention 0.65 ...`](rs-reels.mjs) subcommand. بيكتب entry في [`feedback/performance_data.json`](feedback/performance_data.json) — metrics (views/reach/saves/shares/likes/comments/retention/drop-off) + snapshot من الـ animation_plan (caption_style, num_scenes, num_zooms, num_overlays, num_micro_events). [`feedback/performance_insights.md`](feedback/performance_insights.md) فيه template الـ patterns اللي Claude Code يـ refresh بعد 3+ entries. Phase 6 docs اتحدّثت عشان تقرا الـ insights في البداية.
- [x] **F9 — Hook detector (docs update)**: [`docs/phase-5-content-analysis.md`](docs/phase-5-content-analysis.md) — Step 5.2 جديد "Hook Analysis" بيحلل أول 3s من الـ captions. لو ضعيف (بداية مؤسسية)، يقترح `alternative_start_sec` من أول 30s فيها سؤال/statement. `hook_analysis` block جديد في schema. Phase 6 بيسأل المستخدم قبل تطبيق الاقتراح (Step 6.3).
- [x] **F23 — Adaptive difficulty (docs update)**: [`docs/phase-5-content-analysis.md`](docs/phase-5-content-analysis.md) — كل key_moment بياخد `difficulty: simple | medium | complex` + `difficulty_score` + `visual_complexity`. [`docs/phase-6-animation-planning.md`](docs/phase-6-animation-planning.md) — Step 6.3 فيه جدول بيربط difficulty بـ scene_type + عدد عناصر + duration + entrance + stagger. برضو Phase 6 docs بتشرح إزاي نكتب `scene.entrance/exit` و `zoom_moment.easing` و `word_pop.intensity`.

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
| 11 | [`docs/phase-11/README.md`](docs/phase-11/README.md) + [`docs/dashboard-workflow.md`](docs/dashboard-workflow.md) | ✅ | Dashboard UI + API + Whisper tracker + Bulk mode |
| B | ~~`docs/phase-B-batch.md`~~ | ✅ (superseded by Phase 11 Session 5 bulk mode) | — |

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
6. **حدّث الـ Context Files قبل الـ commit** (قاعدة جديدة — 2026-04-15):
   - [`CLAUDE.md`](CLAUDE.md) — "Next Up" section + current state + ratings history + لو قاعدة جديدة اتضافت اكتبها هنا
   - Memory files في `~/.claude/projects/.../memory/` — أي feedback cross-session يتحوّل لـ memory entry
   - [`feedback/style_evolution.md`](feedback/style_evolution.md) — "📐 القيم المعدّلة" لو قيمة rebased
   - [`docs/dashboard-workflow.md`](docs/dashboard-workflow.md) — لو الـ Dashboard behavior اتغيّر (ports, phases, handoff, batch)
   - أي doc تاني فيه ذكر القيمة/القاعدة القديمة (مثلاً `docs/design-system.md`)
   - **المبدأ**: ما تـ commit source files من غير ما الـ context files اللي بتشرحها تكون synced. Omar طلب ده صراحة لأن الـ context files هي اللي بيقراها الـ session الجاي، ولازم تطابق الكود الفعلي.
7. `git commit` — الـ commit message لازم يذكر اللي اتحدّث في الـ context files كمان، مش بس الـ source
8. كل 3 مشاريع → اقترح variation جديدة

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
