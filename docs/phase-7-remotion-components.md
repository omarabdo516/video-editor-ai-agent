# Phase 7: كتابة Remotion Components

## Input
- `src/data/animation_plan.json` — الخطة المعتمدة
- `src/data/subtitles_approved.json` — الكابشنز
- `src/data/face_map.json` — إحداثيات الوش
- `docs/design-system.md` — قيم التصميم
- `brand/RS_BRAND.md` — هوية RS
- `feedback/style_evolution.md` — تفضيلات سابقة (لو موجود)
- `feedback/best_components/` — أفضل components محفوظة (لو موجود)

## Output
- كل الـ Remotion components مكتوبة وشغالة
- `src/MainVideo.tsx` — الـ Composition الرئيسي
- Remotion Studio بيعرض الفيديو بدون أخطاء

## Success Criteria
- [ ] `npx remotion studio` بيفتح بدون أخطاء
- [ ] الفيديو الأصلي ظاهر
- [ ] الكابشنز ظاهرة بالستايل المختار
- [ ] الـ Explainer Scenes ظاهرة في أوقاتها
- [ ] الـ Overlays ظاهرة في أوقاتها
- [ ] Smart Zoom شغال في الأوقات المحددة
- [ ] Chapter Dividers ظاهرة
- [ ] اللوجو ظاهر (bottom-right)
- [ ] الألوان من الـ brand
- [ ] RTL والخط Cairo شغالين

---

## الخطوات

### Step 7.0: اقرأ الأساسيات

**إجباري قبل كتابة أي كود:**
1. اقرأ `docs/design-system.md` — القيم (spacing, fonts, shadows, animations)
2. اقرأ `brand/RS_BRAND.md` — الألوان واللوجو
3. اقرأ `feedback/style_evolution.md` (لو موجود) — تفضيلات المستخدم
4. شوف `feedback/best_components/` (لو موجود) — استخدمهم كـ base
5. **استخدم الـ Remotion Agent Skills** — هي اللي هتوجهك للـ API الصح

### Step 7.1: Caption System (باستخدام @remotion/captions)

**لا تبني logic التوقيت والتقسيم من الصفر — استخدم `@remotion/captions`.**

#### 7.1.1: حوّل WhisperX output لـ Remotion Caption format

```typescript
// utils/convert-captions.ts
import type { Caption } from '@remotion/captions';

// حوّل subtitles_approved.json لـ Remotion Caption[]
function convertToRemotionCaptions(subtitles): Caption[] {
  const captions: Caption[] = [];
  for (const sub of subtitles) {
    if (sub.words) {
      // لو فيه word-level timestamps (من WhisperX)
      for (const word of sub.words) {
        captions.push({
          text: ' ' + word.word,  // مهم: مسافة قبل كل كلمة
          startMs: word.start * 1000,
          endMs: word.end * 1000,
          timestampMs: ((word.start + word.end) / 2) * 1000,
          confidence: 1,
        });
      }
    } else {
      // لو مفيش word-level → سطر كامل
      captions.push({
        text: sub.text,
        startMs: sub.startTime * 1000,
        endMs: sub.endTime * 1000,
        timestampMs: ((sub.startTime + sub.endTime) / 2) * 1000,
        confidence: 1,
      });
    }
  }
  return captions;
}
```

#### 7.1.2: استخدم createTikTokStyleCaptions() للتقسيم

```typescript
import { createTikTokStyleCaptions } from '@remotion/captions';

const { pages } = createTikTokStyleCaptions({
  captions,
  combineTokensWithinMilliseconds: 800,
  // عالي (1200+) = كلمات كتير في الصفحة (Classic/Karaoke)
  // واطي (400-) = كلمة كلمة (Hormozi/Pop)
});
```

#### 7.1.3: كل ستايل = ملف React واحد

**البنية:**
```
src/components/captions/
├── CaptionRenderer.tsx         ← بياخد pages + style name → يعرض الصح
└── styles/
    ├── HormoziStyle.tsx        ← كلمة كلمة + bounce + highlight أصفر
    ├── ClassicStyle.tsx        ← سطر كامل + خلفية شفافة
    ├── KaraokeStyle.tsx        ← كل الكلمات ظاهرة + اللون بيمشي
    ├── PopStyle.tsx            ← كلمة واحدة كبيرة + scale
    ├── BoxStyle.tsx            ← مربع بيقفز بين الكلمات
    └── TypewriterStyle.tsx     ← كلمات بتظهر واحدة واحدة
```

**كل ستايل بيقبل نفس الـ props:**
```typescript
interface CaptionStyleProps {
  page: TikTokPage;          // الصفحة الحالية (كلمات + توقيتات)
  currentTimeMs: number;      // الوقت الحالي بالمللي ثانية
  frame: number;              // الفريم الحالي
  fps: number;                // فريمات في الثانية
}
```

**كل ستايل بيحدد:**
- لون الكلمة الحالية
- لون باقي الكلمات
- الأنيميشن (bounce / fade / scale / slide)
- المكان (نص / تحت / فوق)
- الخلفية (مفيش / شفافة / مربع ملون)
- حجم الخط
- `combineTokensWithinMilliseconds` المناسب ليه

**مهم لكل الستايلات:**
- الخط Cairo
- RTL (`direction: 'rtl'`)
- الألوان من الـ brand
- `white-space: pre` (عشان المسافات تتحفظ)

### Step 7.2: SmartZoom Component

```tsx
// يقرأ face_map.json ويعمل zoom على الوش
// التفاصيل في Phase 1 (face_map format)

// المفتاح: transformOrigin بيتحدد من face_center_x/y
// مع smoothing (moving average 15 نقطة)
// ومع spring() من Remotion
```

**القواعد:**
- لو confidence < 0.5 → fallback لوسط الشاشة
- لو حركة > 20% → إلغاء zoom
- spring damping: ابدأ بـ 18 (أو من style_evolution لو موجود)
- zoom level: من animation_plan.json (default 1.4)

### Step 7.3: Explainer Scene Components

لكل scene_type في animation_plan، اكتب component:

| scene_type | المكونات | الأنيميشن |
|-----------|---------|----------|
| definition | عنوان + تعريف + أيقونة + عناصر | stagger reveal |
| equation | معادلة + أرقام + أسهم | left-to-right build + count-up |
| comparison | عمودين + عناصر في كل عمود | side-by-side reveal |
| process | خطوات + أسهم بينهم | step-by-step reveal |
| chart | bar/pie chart + labels | grow animation |
| diagram | boxes + arrows + labels | build piece by piece |
| timeline | خط + نقاط + labels | left-to-right reveal |

**كل scene لازم:**
- باكجراوند من color_palette (gradient)
- عنوان بالخط الكبير (من design-system)
- fade-in عند البداية (15 frames)
- fade-out عند النهاية (12 frames)
- الخط Cairo + RTL
- الصوت مستمر (الـ scene بتظهر فوق الفيديو بـ opacity)

### Step 7.4: Overlay Components

| overlay_type | الوصف |
|-------------|-------|
| keyword_highlight | كلمة كبيرة أعلى الشاشة مع glow |
| counter | رقم بيعد من 0 لقيمة |
| stamp | ختم (مهم! / انتبه!) مع bounce |
| underline | خط بيترسم تحت كلمة |

### Step 7.5: Chapter Divider + Logo

- Chapter: fade to dark + عنوان القسم + fade back
- Logo: `<Img>` ثابت bottom-right, opacity 0.8, عرض 120px
- Logo يختفي أثناء Full-Screen Scenes

### Step 7.6: MainVideo.tsx — تجميع كل حاجة

```tsx
// الترتيب (من تحت لفوق):
// Layer 1: الفيديو الأصلي (مع SmartZoom في الأوقات المحددة)
// Layer 2: Full-Screen Scenes (بتغطي الفيديو مع fade)
// Layer 3: Overlays
// Layer 4: الكابشنز
// Layer 5: Chapter Dividers
// Layer 6: اللوجو
```

**اقرأ animation_plan.json وحوّل كل element لـ `<Sequence>`:**

```tsx
{plan.elements.map(el => (
  <Sequence
    key={el.id}
    from={timeToFrames(el.timestamp_start, fps)}
    durationInFrames={timeToFrames(el.timestamp_end, fps) - timeToFrames(el.timestamp_start, fps)}
  >
    {/* render the right component based on type */}
  </Sequence>
))}
```

### Step 7.7: اختبار في Remotion Studio

```bash
npx remotion studio
```

افتح في المتصفح وتأكد:
- كل العناصر ظاهرة في أوقاتها
- الأنيميشنز شغالة
- الألوان صح
- النص عربي وواضح

### Step 7.8: Git Commit

```bash
git add .
git commit -m "v7: remotion components done - [X] scenes, [Y] overlays, [Z] zooms"
```

---

## بعد ما تخلص
```
نبدأ Phase 8 (Preview + Render)؟
```
