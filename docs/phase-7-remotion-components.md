# Phase 7: Remotion Components

> **آخر تحديث:** 2026-04-14 — اتعدل بعد أول full render. الملف ده بيعكس الـ architecture الفعلي، مش الخطة القديمة.

## Input

- [`src/data/<basename>/animation_plan.json`](../src/data/) — الخطة المعتمدة (Phase 6 + 6.5)
- `<video>.mp4.captions.json` — الكابشنز المعتمدة (Phase 2 → 4)
- `<video>.1080x1920.mp4.face_map.json` — إحداثيات الوش (للـ SmartZoom)
- [`docs/design-system.md`](design-system.md) — قيم التصميم
- [`brands/rs/BRAND.md`](../brands/rs/BRAND.md) — هوية RS
- [`feedback/style_evolution.md`](../feedback/style_evolution.md) — تفضيلات المتراكمة **إلزامي**
- [`feedback/best_components/`](../feedback/best_components/) — أفضل components محفوظة

## Output

- كل الـ Remotion components شغّالة وبيرسموا الـ plan
- [`src/Reel.tsx`](../src/Reel.tsx) — الـ Composition الرئيسي
- `node rs-reels.mjs make <video>` بيريندر بدون errors

---

## 🏛️ الـ Architecture (3-tier event system)

Phase 7 مبني على تقسيم الأحداث لـ **3 مستويات** حسب الحجم والـ retention goal:

```
Tier 1 — Major events        ← impact (Phase 6 output)
  • Full-screen scenes       (1 كل 45s min)
  • Smart zooms (1.4x)       (1 كل 30s min + face conf ≥ 0.5)
  • Big overlays             (1 كل 20s min)

Tier 2 — Micro events        ← retention rhythm (Phase 6.5 output)
  • word_pop (in-caption boost — handled by WordCaption)
  • caption_underline
  • mini_zoom (1.08x, merged into SmartZoom plan)
  • accent_flash

Tier 3 — Continuous motion   ← "alive" base layer
  • VideoBreathing (1.5% scale oscillation, 5s period)
  • Word-by-word caption highlighting (Hormozi)
  • Logo bug (always visible)
```

**القاعدة الذهبية:** كل 4 ثواني لازم يحصل حاجة على الأقل — ده الـ reels retention rule. الـ Tier 2 هو اللي بيحقق ده.

---

## 🧱 الـ Components اللي موجودة

### Core layout
| File | Dep | الوصف |
|------|-----|-------|
| [`Reel.tsx`](../src/Reel.tsx) | — | الـ Composition. بيقرا `animationPlan` + بيوزع كل element على Sequence. |
| [`Root.tsx`](../src/Root.tsx) | — | Remotion registration + preview-props from `src/preview-props.json`. |
| [`types.ts`](../src/types.ts) | — | TypeScript types لـ كل الـ plan shape. |
| [`tokens.ts`](../src/tokens.ts) | — | Design tokens (colors + fonts + comp + scenes + overlays + springs). |

### Lecture layer (Tier 3 base)
| File | الوصف |
|------|-------|
| [`VideoTrack.tsx`](../src/components/VideoTrack.tsx) | الـ video via OffthreadVideo |
| [`VideoBreathing.tsx`](../src/components/VideoBreathing.tsx) | **NEW** — wrapper بيطبق slow scale oscillation (1.0 ↔ 1.015) على الفيديو |
| [`SmartZoom.tsx`](../src/components/SmartZoom.tsx) | Wrapper بيقرا `smart_zoom_plan.moments` (big + mini مدموجين) + بيطبق transform على الوش |
| [`WordCaption.tsx`](../src/components/WordCaption.tsx) | Hormozi-style word-by-word + **`emphasisTimes` prop** بيكبّر الكلمة الحالية 1.28x + glow لو في emphasis beat active |
| [`LogoBug.tsx`](../src/components/LogoBug.tsx) | Top-center، **بيفضل ظاهر طول الوقت** (z-index فوق الـ scenes) |
| [`LowerThird.tsx`](../src/components/LowerThird.tsx) | Name + workshop bar (0.5s → 4.5s) |
| [`Outro.tsx`](../src/components/Outro.tsx) | Closing logo + tagline (2.5s) |

### Scene components (Tier 1)
| File | scene_type | الاستخدام |
|------|-----------|-----------|
| [`scenes/FullScreenScene.tsx`](../src/components/scenes/FullScreenScene.tsx) | wrapper | fade in/out + dispatcher حسب `scene_type` والـ elements |
| [`scenes/ProcessStepperScene.tsx`](../src/components/scenes/ProcessStepperScene.tsx) | process (stepper) | 3 cards مرتبة عمودياً + stagger + current-card pulse glow |
| [`scenes/ProcessTimelineScene.tsx`](../src/components/scenes/ProcessTimelineScene.tsx) | process (timeline) | nodes أفقياً + line draw + done-node pulse |
| [`scenes/ComparisonTwoPathsScene.tsx`](../src/components/scenes/ComparisonTwoPathsScene.tsx) | comparison | ✗ vs ✓ columns بـ stagger + accent column pulse |
| [`scenes/BigMetaphorScene.tsx`](../src/components/scenes/BigMetaphorScene.tsx) | tip (metaphor) | big headline + subline + impact burst |

### Overlay components (Tier 1)
| File | overlay_type | الاستخدام |
|------|-------------|-----------|
| [`overlays/Overlay.tsx`](../src/components/overlays/Overlay.tsx) | wrapper | dispatcher حسب `overlay_type` |
| [`overlays/KeywordHighlightOverlay.tsx`](../src/components/overlays/KeywordHighlightOverlay.tsx) | keyword_highlight | pill بـ accent border + badge (اختياري) + fade-slide |
| [`overlays/StampOverlay.tsx`](../src/components/overlays/StampOverlay.tsx) | stamp | bordered accent text برـ slight rotation + pop entrance |

### Micro-event components (Tier 2)
| File | micro type | الاستخدام |
|------|-----------|-----------|
| [`micro/MicroEventHost.tsx`](../src/components/micro/MicroEventHost.tsx) | wrapper | dispatcher — word_pop و mini_zoom بيرجعوا null لأنهم handled upstream |
| [`micro/CaptionUnderline.tsx`](../src/components/micro/CaptionUnderline.tsx) | caption_underline | خط accent تحت الكابشن بـ draw-in RTL + glow pulse |
| [`micro/AccentFlash.tsx`](../src/components/micro/AccentFlash.tsx) | accent_flash | vertical bar من edge الشاشة، 0.6s |

**ملاحظات مهمة:**
- `word_pop` **مش له component** — الـ boost بيحصل جوّا [`WordCaption.tsx`](../src/components/WordCaption.tsx) عن طريق الـ `emphasisTimes` prop. ده اللي اتعلمناه بعد أول تجربة: الـ floating pill كان بيتعارض مع الـ lower-third والكابشنز.
- `mini_zoom` **مش له component** — الـ generator بيدمج الـ 3 mini zooms في `smart_zoom_plan.moments` قبل الـ render، فـ SmartZoom بيرسمهم مع الـ big zooms بنفس الآلية. الفرق بس في `zoomLevel` (1.08 بدل 1.4).

---

## 📏 الـ Safe Zones (مهم جداً)

قبل ما تختار `y` لأي overlay أو micro-event جديد، اقرا الجدول ده:

| y range       | اللي فيه                           | Safe for small overlay? |
|---------------|------------------------------------|-------------------------|
| 0 – 220       | Top safe + Logo bug (y=143, w=170) | ❌                     |
| 220 – 700     | Face zone (lecturer)               | ❌                     |
| 700 – 1090    | **Body zone (empty)**              | ✅ **← use this**      |
| 1100 – 1280   | Lower-third bar (0.5-4.5s)         | ❌                     |
| 1280 – 1460   | Captions                           | ❌                     |
| 1460 – 1500   | Thin gap                           | ⚠️ (40px tight)       |
| 1500 – 1920   | Bottom safe area                   | ❌                     |

**تفصيل الـ memory:** `feedback_safe_zones.md` في user memory store.

---

## 🎬 Scene Composition Rules

1. **Vertical centering دايماً.** استخدم `<AbsoluteFill>` بـ `display: flex; justifyContent: center; alignItems: center; flexDirection: column`. الأنكر نقطة نص الشاشة (y=960).
2. **Logo clearance.** كل scene لازم يسيب `paddingTop: 280px` عشان اللوجو يفضل ظاهر من غير ما يتعارض مع الـ title.
3. **Animations layered** — مش فقط fade. كل element لازم يكون عليه على الأقل motions اتنين (scale + slide, rotate + pop, opacity + glow).
4. **Pulse glow مستمر** على الـ "current/accent" element — بـ sine wave على الـ box-shadow.
5. **Background atmosphere** — radial gradient أو subtle shimmer عشان الـ frame يبقى حي.

---

## 🎭 الـ 3-tier Event Flow في [`Reel.tsx`](../src/Reel.tsx)

```tsx
<AbsoluteFill>
  <Sequence from={0} durationInFrames={lectureFrames}>
    {/* Tier 3: Video + breathing + smart zoom */}
    <SmartZoom plan={effectiveZoomPlan}>
      <VideoBreathing>
        <VideoTrack />
      </VideoBreathing>
    </SmartZoom>

    {/* Tier 3: Lower third */}
    <LowerThird />

    {/* Tier 3 + 2: Captions with emphasis boost */}
    {visibleCaptions.map(seg => (
      <WordCaption segment={seg} emphasisTimes={segEmphasis} />
    ))}

    {/* Tier 2: Micro events (underlines, flashes) */}
    {microEvents.map(ev => <MicroEventHost event={ev} />)}

    {/* Tier 1: Big overlays */}
    {overlays.map(ov => <Overlay overlay={ov} />)}

    {/* Tier 1: Full-screen scenes */}
    {scenes.map(s => <FullScreenScene scene={s} />)}

    {/* Tier 3: Logo (last, so it sits ABOVE scenes) */}
    <LogoBug />
  </Sequence>

  <Sequence from={lectureFrames}>
    <Outro />
  </Sequence>
</AbsoluteFill>
```

**الترتيب مهم**: الـ scenes لازم تكون قبل الـ LogoBug عشان اللوجو يفضل ظاهر فوقها. الـ captions بتتفلتر مسبقاً علشان تختفي أثناء الـ scenes.

---

## 🚧 اللي لسه محتاج يتبني

- [ ] **Caption styles (5 باقي)**: Karaoke, Pop, Box, Typewriter, Classic — كل واحد ليه فايل في `src/components/captions/styles/`
- [ ] **Scene types جدد**: definition, equation, chart, diagram, counter — plus helper primitives
- [ ] **ChapterDivider** component — fade-to-dark + section title
- [ ] **@remotion/captions** integration — لما نبني الـ 6 caption styles
- [ ] **Accent flash generator tuning** — حالياً الـ generator بيطلّع 0 accent_flash events لأنه بيدي الأولوية للـ strong → mini_zoom، medium → word_pop/underline. محتاج manual rule يضيف accent_flash في الـ gaps اللي لسه موجودة.
- [ ] **Scene polish** — الـ iteration اللي المستخدم قال "هنبدأ نحسنها أكتر" عليها. جاي في الـ session الجاي.

---

## 📝 قواعد لما تضيف component جديد

1. اقرأ [`brands/rs/BRAND.md`](../brands/rs/BRAND.md) و [`feedback/style_evolution.md`](../feedback/style_evolution.md) **قبل** ما تكتب أي كود
2. استخدم القيم من [`src/tokens.ts`](../src/tokens.ts) — مفيش hardcoded values
3. الخط Cairo للعناوين، Tajawal للجسم (الكابشنز + الكلمات الكبيرة). كلهم RTL.
4. Spring animations من `tokens.springs` (enter / exit / bounce / smooth)
5. Scene بتكون vertically centered. Overlay بتكون في safe zone.
6. اللوجو ظاهر دايماً — خلّي paddingTop ≥ 280 في الـ scenes.
7. أي element جديد لازم يتفلتر لو بيـ overlap مع scene (زي ما captions/micro events بيعملوا).
8. Test check بـ `npx tsc --noEmit` قبل الريندر.

---

## 🎯 Success Criteria (للـ session الحالية)

- [x] `node rs-reels.mjs make <video>` بيريندر بدون errors
- [x] الـ full 3:29 video اتريندر (265 MB) مع الـ 4 scenes + 4 zooms + 5 overlays + 30 micro events
- [x] اللوجو ظاهر طول الوقت
- [x] الـ captions بتختفي أثناء الـ scenes
- [x] الـ micro events بتختفي أثناء الـ scenes
- [x] Cadence ~4.86s/event (target 4s) ✓ قريب
- [x] RTL + Cairo + Tajawal شغّالين
- [x] Omar confirmed: "تمام كويس"

بعد ما يخلص الـ feedback loop: نبدأ polish iteration على الـ scenes والـ caption styles الجديدة.
