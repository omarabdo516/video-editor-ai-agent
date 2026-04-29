---
name: rs-reel
description: "End-to-end pipeline لإنتاج ريل RS Financial Services من فيديو خام لمحاضر. Omar بيستدعيها لكل فيديو جديد وبيديها: (1) Path الفيديو (2) اسم المحاضر (3) اسم الورشة (4) اختياري: caption style. الـ skill بتكتشف الـ state الحالي من source of truth files في الـ runtime — مفيش snapshots hardcoded — فبتفضل صح لما الـ pipeline يتحدّث من غير ما الـ skill نفسها تتحدّث."
---

# RS Reel Pipeline — Skill (Dynamic)

أنت مسؤول عن إنتاج ريل RS كامل من فيديو خام. اشتغل بالترتيب. **ما تسألش** قبل ما تعمل Step 0 — كل اللي محتاجه موجود في الـ source of truth files اللي هتقراها.

> **مبدأ أساسي:** الـ skill دي **dynamic**. الحقائق المتغيرة (قايمة scene types، caption styles، packages، spacing rules، tagline، إلخ) **مش موجودة هنا** — Codex بيقراها كل session من الـ source of truth files المذكورة تحت. لما الـ pipeline يتحدّث، الـ skill تفضل صح من غير تعديل.

---

## 🎯 الـ Inputs المطلوبة من Omar

Omar بيستدعيك بـ:
1. **Video path** — الـ `.mp4` الخام
2. **Lecturer name** — بالعربي
3. **Workshop name** — بالعربي
4. **Caption style** (اختياري) — الخيارات في [src/types.ts](../../../src/types.ts) (`CaptionStyle` union). **الـ default الحالي = `hormozi` واحد طول الريل** — Omar بيفضّل ستايل واحد ثابت (memory: `feedback_single_caption_style.md`). `caption_style_ranges` بتتطبق **فقط** لو Omar قال صراحةً "غيّر الـ caption style جوه الفيديو" / "mix the captions".

لو فيه input ناقص → اسأل سؤال واحد واضح وخذ جوابه. ما تسألش عن caption style لو Omar ما ذكرهاش — استخدم `hormozi` بدون `caption_style_ranges`.

**⚠️ Trap شائع — "variety" vs "caption mixing":**
لو Omar قال جملة زي "استخدم أكتر من استايل بذكاء" أو "خليها متنوعة" أو "اكسر الملل" — ده بيقصد **scenes + overlays + animations + micro-events** (الـ visual layer اللي المشاهد بيحس بيه كـ "الفيديو فيه حركة")، **مش** الـ caption renderer نفسه. الكابشن بيفضل constant طول الريل. لو مش متأكد، اسأل سؤال واحد: **"تقصد variety في الـ scenes/overlays ولا عايز أغيّر الـ caption style نفسه؟"**

---

## 📚 Step 0: Discover current state (إجباري — ما تتخطاهوش)

### 0.1 — Source of Truth Map

الجدول ده هو الأساس. كل حاجة عايز تعرفها عن الـ pipeline موجودة في واحد من الملفات دي. اقرا اللي محتاجه بس — ما تقراش كل حاجة لو مش ضرورية.

| هدف | Source of Truth |
|-----|------------------|
| حالة المشروع الحالية + قرارات معمارية + "next up" | `AGENTS.md` (root) |
| قواعد البراند الإجبارية (ألوان، خطوط، logo، tagline) | `brands/rs/BRAND.md` |
| تفضيلات Omar المتراكمة (anchoring، layered motion، إلخ) | `feedback/style_evolution.md` |
| قواعد الـ memory الـ user-level | `~/.Codex/projects/c--Users-PUZZLE-Documents-Codex-video-editor-ai-agent/memory/MEMORY.md` (auto-loaded) |
| Scene spacing / zoom spacing / overlay spacing + durations | `docs/scene-validation-rules.md` |
| Phase 7 architecture (3-tier event system + safe zones) | `docs/phase-7-remotion-components.md` |
| Phase 6 schema + **caption_style_ranges auto-assignment algorithm** | `docs/phase-6-animation-planning.md` |
| Schema لكل phase تاني (1, 2, 4, 5, 8, 9) | `docs/phase-<N>-*.md` |
| الـ CLI commands + flags المتاحة | `rs-reels.mjs` (اقرا أو شغّل بدون args للـ usage) |
| **قايمة scene types المتاحة** | `src/types.ts` → `SceneType` union + `SceneElement` union |
| **قايمة caption styles المتاحة** | `src/types.ts` → `CaptionStyle` union |
| **قايمة overlay types المتاحة** | `src/types.ts` → `OverlayType` union |
| **قايمة micro event types المتاحة** | `src/types.ts` → `MicroEventType` union |
| Scene components الفعلية (على القرص) | `src/components/scenes/*.tsx` (glob) |
| Caption components الفعلية (على القرص) | `src/components/WordCaption*.tsx` (glob) |
| Design tokens (ألوان، خطوط، أحجام، outro tagline، caption config) | `src/tokens.ts` |
| Remotion packages المتاحة (للـ polish + features) | `package.json` → dependencies (`@remotion/*`) |
| Schema reference لأي content_analysis.json | أحدث ملف في `src/data/*/content_analysis.json` |
| Schema reference لأي animation_plan.json | أحدث ملف في `src/data/*/animation_plan.json` |
| Subtitle editor features (keyboard shortcuts، buttons، store actions) | `subtitle-editor/src/components/KeyboardHandler.tsx` + `Toolbar.tsx` + `store/useSubtitleStore.ts` |

### 0.2 — القراءة الإجبارية قبل أي شغل

اقرا الملفات دي **كاملة** قبل ما تبدأ Phase 1:

1. `AGENTS.md`
2. `brands/rs/BRAND.md`
3. `feedback/style_evolution.md`
4. `docs/scene-validation-rules.md`
5. `docs/phase-6-animation-planning.md` (فيه خوارزمية الـ caption_style_ranges auto-assignment)
6. `docs/phase-7-remotion-components.md`

### 0.3 — Discovery الـ "القوائم" (كل session)

قبل ما تكتب animation_plan، اكتشف الـ unions المتاحة حالياً:

```bash
# Scene types + caption styles + overlay types + micro event types
# (اقرا `src/types.ts` واستخلص الـ unions)
```

أو استخدم Grep بـ pattern:

```
export type SceneType = ...
export type CaptionStyle = ...
export type OverlayType = ...
export type MicroEventType = ...
```

أو Glob للـ components الفعلية:

```
src/components/scenes/*.tsx
src/components/WordCaption*.tsx
src/components/overlays/*.tsx
src/components/micro/*.tsx
```

**القاعدة:** ما تفترضش إن scene type معين موجود. اتأكد منه من `types.ts` أو من الـ file glob.

### 0.4 — Discovery الـ packages

اقرا `package.json` وشوف أي packages من `@remotion/*` متاحة. دي هتستخدمها في الـ polish. الـ list بتتغير لما Omar يضيف packages جديدة.

```javascript
// Example: list installed @remotion packages
const pkg = require('./package.json');
const remotion = Object.keys({...pkg.dependencies, ...pkg.devDependencies})
  .filter(k => k.startsWith('@remotion/') || k === 'remotion');
```

---

## 🎬 Step 1: Phase 1 — Preprocessing

شغّل الـ CLI كما هو موثق في `rs-reels.mjs`. الـ command الحالي:

```bash
node rs-reels.mjs phase1 "<video_path>"
```

لو الـ flags اتغيرت — اقرا `rs-reels.mjs` أول السطر 1-20 (الـ usage docstring) أو شغّل بدون args.

- شغّلها في الـ background
- بعد الـ notification: اقرا آخر الـ output للتأكد من نجاح كل الخطوات (audio + scale + metadata + face_map + energy)

---

## 🎙️ Step 2: Phase 2 — Transcription + Egyptian Fix

```bash
node rs-reels.mjs make "<video_path>" --lecturer "<name>" --workshop "<workshop>" --dry
```

- `--dry` بيوقف بعد الـ fix من غير render
- شغّلها في الـ background
- بعد ما تخلص: اعرض على Omar عدد الـ segments + أي أخطاء transcription واضحة شفتها

---

## ✂️ Step 3: Phase 3/4 — Subtitle Editor Review

```bash
node rs-reels.mjs edit "<video_path>"
```

- شغّلها في الـ background واقرا الـ output للحصول على الـ URL
- اعرض الـ URL على Omar

**Editor features:** قبل ما تشرح للـ user أي feature من الـ editor، **اقرا الملفات دي عشان تعرف الـ features المتاحة حالياً** (ممكن تكون اتحدّثت من آخر session):

- `subtitle-editor/src/components/KeyboardHandler.tsx` — كل الـ keyboard shortcuts
- `subtitle-editor/src/components/Toolbar.tsx` — كل الأزرار (rechunk, follow-playback, import/export, إلخ)
- `subtitle-editor/src/store/useSubtitleStore.ts` — كل الـ actions المتاحة

بعد ما Omar يخلّص ويضغط Approve:
1. هيـ download ملفين لـ `C:/Users/PUZZLE/Downloads/`
2. انقلهم لجنب الفيديو:
   - `<name>.captions.json` → `<video_dir>/<name>.mp4.captions.json` (لاحظ `.mp4` في النص)
   - `<name>.srt` → `<video_dir>/<name>.srt`

---

## 📖 Step 4: Phase 5 — Content Analysis (in-context)

**أنت اللي بتعمل التحليل.** مفيش API call.

### اعمل الفولدر

```bash
mkdir -p "src/data/<basename>"
```

الـ basename = اسم الفيديو من غير extension.

### اقرا الـ inputs

- `<video>.mp4.captions.json` — segments + word timings (كبير — اقرا بـ offset/limit أو اقرا الـ `.srt` الأصغر للـ full text)
- `<video>.1080x1920.mp4.metadata.json`
- `<video>.1080x1920.mp4.face_map.json`
- `<video>.16k.wav.energy.json`

### اكتب `src/data/<basename>/content_analysis.json`

**ما تخترعش schema.** افتح أحدث content_analysis.json موجود في `src/data/*/` كـ reference. كل الحقول اللي موجودة فيه محتاجها. لو فيه حقول جديدة طلعت بعدها في سياقات تانية، اقرا `docs/phase-5-content-analysis.md` للتفاصيل.

---

## 🎭 Step 5: Phase 6 — Animation Plan (in-context)

**أنت اللي بتكتب الخطة.**

### القواعد الإجبارية

الـ spacing + duration + count rules بتاعت scenes / zooms / overlays / chapter dividers **موجودة كلها في `docs/scene-validation-rules.md`**. اقرا الملف ده واتبعه حرفياً. لو الـ rules اتغيرت فيه، اتّبع الجديد مش القديم.

الـ caption_style_ranges auto-assignment algorithm موجودة في `docs/phase-6-animation-planning.md`. **ما تستخدمهاش بشكل افتراضي.** الـ default هو `caption_style: "hormozi"` بدون أي `caption_style_ranges`. اتّبع الـ auto-assignment فقط لو Omar طلب صراحةً mixing في الـ captions نفسها (مش variety عامة في الـ scenes/overlays — شوف الـ "Trap شائع" في قسم الـ Inputs فوق).

### اكتب `src/data/<basename>/animation_plan.json`

**ما تخترعش schema.** افتح أحدث animation_plan.json في `src/data/*/` كـ reference. التزم بالحقول الموجودة فيه.

### القوائم اللي محتاج تعرفها قبل كتابة الخطة

- **Scene types** اللي تقدر تستخدمها → اقرا `src/types.ts` (`SceneType`, `SceneElement`). كل element type مدعوم من scene component موجود في `src/components/scenes/`.
- **Caption styles** المتاحة → `src/types.ts` (`CaptionStyle`).
- **Overlay types** المتاحة → `src/types.ts` (`OverlayType`).
- **Scene components implementation** → لو محتاج تعرف فيه ازاي تقدر تحط element، اقرا الـ component نفسه في `src/components/scenes/<Name>Scene.tsx`.

### Scene elements schema

لكل scene، الـ `elements[]` array بيحدد اللي يظهر فيها. الـ element types + props المتاحة في `src/types.ts` (`StepCardElement`, `TimelineElement`, `ComparisonTwoPathsElement`, `BigMetaphorElement`, `DefinitionElement`, `EquationElement`, `CounterElement`، إلخ). لو Omar ضاف scene element جديد، هيكون في نفس المكان.

### Tagline في الـ outro

**لا تـ hardcode الـ tagline في الـ skill.** اقراها من:
1. `src/tokens.ts` → `tokens.outro.tagline` (source of truth للـ runtime)
2. `brands/rs/BRAND.md` (source of truth للـ brand doc)

الـ قيمتين لازم يتطابقوا. لو اختلفوا → Omar المفروض يحسم، لكن `tokens.ts` أقرب للـ render.

### Zoom center sampling

```javascript
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('<face_map_path>','utf8'));
const avg=(t)=>{
  const n=d.faces.filter(f=>Math.abs(f.time-t)<2&&f.confidence>0.5);
  if(!n.length) return null;
  return {
    cx:(n.reduce((a,f)=>a+f.face_center_x,0)/n.length).toFixed(3),
    cy:(n.reduce((a,f)=>a+f.face_center_y,0)/n.length).toFixed(3),
    conf:(n.reduce((a,f)=>a+f.confidence,0)/n.length).toFixed(3)
  };
};
console.log(avg(<zoom_start_sec>));"
```

---

## 🎨 Step 6: Phase 6.5 — Micro Events (auto-generator)

```bash
node scripts/generate_micro_events.mjs "<basename>"
```

لو الـ script اتحدث وأصبح محتاج flags إضافية، شغّله بدون args عشان تشوف الـ usage. اقرا `docs/phase-6.5-micro-events.md` لو محتاج تفاصيل الخوارزمية.

---

## 🎞️ Step 7: Phase 7/8 — Render

```bash
node rs-reels.mjs make "<video_path>" --lecturer "<name>" --workshop "<workshop>" --skip-audio --skip-transcribe
```

- بيقرا الـ animation_plan من `src/data/<basename>/` تلقائياً
- شغّلها في الـ background والاستنى notification
- بعد النجاح: اقرا آخر سطور من الـ output للتأكد من path الـ output

**Components + polish:** ما تـ hardcodeش قايمة الـ components المطبّقة. لو Omar سألك "إيه الموجود"، اعمل glob على:

- `src/components/**/*.tsx` — كل الـ components
- `src/components/scenes/*.tsx` — scenes فقط
- `src/components/WordCaption*.tsx` — caption styles
- `src/components/overlays/*.tsx` — overlays
- `src/components/micro/*.tsx` — micro events

ولـ polish libs: اقرا `package.json` وشوف الـ `@remotion/*` packages اللي حواليها.

---

## 💬 Step 8: Phase 9 — Feedback + Logs

اقرا `docs/phase-9-feedback.md` للـ full workflow. الأساسيات:

1. اعرض على Omar: path الريل + الـ stats من الـ `animation_plan.json` (scenes/zooms/overlays counts)
2. اطلب feedback:
   - تقييم عام من 5
   - أي scene شغّال / أي واحدة محتاجة شغل
   - التوقيت — هل فيه scene بدأت بدري أو متأخر عن الـ anchor
   - أي bugs بصرية (overlap، clipping، drift، labels متعشمة، عنصر خارج الـ frame)
   - **اطلب screenshots صراحةً لو Omar قال "scene بايظة"** — الـ screenshots بتكشف bugs مستحيل تتشاف من الـ JSON (زي flex layout bugs من wrappers، text clipping، label overlap). في الـ session اللي اتعمل فيها ثاني فيديو، كل scene bugs الرئيسية اتشافت من screenshots من Omar وتم تصليحها في 10 دقائق.
3. لو تعديلات → عدّل الملفات وأعد render
4. لو تمام:
   - حدّث `feedback/log.json`
   - حدّث `feedback/style_evolution.md` لو طلعت قواعد جديدة
   - لو قاعدة brand → `brands/rs/BRAND.md`
   - لو قيمة tokens → `src/tokens.ts`
   - لو preference متراكم → memory file في `~/.Codex/projects/.../memory/` + pointer في `MEMORY.md`

5. **نقل الملفات**: Omar غالباً هيطلب ينقل ملفات الفيديو لفولدر `Video N - <theme>`. احسب الـ N من عدد الفولدرات الموجودة في نفس الـ directory بتاعة الفيديو. الـ theme = الـ core message باختصار بالعربي.

---

## 🚨 قواعد تشغيل

1. **Paths فيها مسافات + عربي** — double quotes دايماً
2. **Shell = bash on Windows** — forward slashes في paths
3. **Long commands** (phase1, transcribe, render) → `run_in_background: true`
4. **TypeScript check** — بعد أي تعديل على `src/` أو `subtitle-editor/src/`: `npx tsc --noEmit` من المكان المناسب
5. **ما تعمل git commit** إلا لو Omar طلب صراحةً
6. **Phase 5 + 6 كبيرة** — استخدم أحدث content_analysis + animation_plan كـ schema reference
7. **captions.json كبير** (>10000 tokens عادةً) — اقرا بـ offset/limit أو اقرا `.srt` للـ full text
8. **ما تفترضش snapshots** — أي قايمة "الموجود حالياً" (scene types، caption styles، packages، rules) اقراها من الـ source of truth قبل ما تستخدمها

---

## 🎬 ابدأ

عندك الـ inputs كلها → **Step 0 فوراً** (اقرا الـ context files). بعد ما تخلّص، ابدأ Step 1.
ناقص input → سؤال واحد واضح.
ما تعرضش خطة كاملة قبل البداية — ابدأ تنفيذ، وبلّغ Omar بـ sentence واحد بعد كل phase.
