# Round 3: Visual Polish

## الهدف
رفع الجودة البصرية — motion backgrounds + transitions + intro animation.

## المدة المتوقعة
60-90 دقيقة

## ⚠️ قبل ما تبدأ
- تأكد إن Round 2 خلصت و committed
- **استخدم الـ Design Skills** (frontend-design + motion-design + taste-skill)

---

### Feature 5: Motion Backgrounds للـ Scenes

**المشكلة:** Full-Screen Scenes ليها static gradient — بتبان flat.

**الحل:** الـ gradient angle بيتحرك ببطء + subtle color shift.

**التنفيذ:**

```tsx
// src/components/scenes/MotionBackground.tsx
// - gradient angle بيتحرك 3° كل ثانية
// - color position بيعمل sine wave خفيف
// - Motion intensity: 3-4 (subtle — مش ملحوظ)
```

**قواعد من الـ Design Skills:**
- **taste-skill:** motion intensity 3-4 للـ backgrounds (خفيف)
- **frontend-design:** الـ background يدي depth مش يشتت
- **motion-design:** لا تستخدم linear rotation — استخدم ease curve

**التكامل:** استبدل الـ static background في `FullScreenScene.tsx`.

**الملفات المتأثرة:**
- `src/components/scenes/MotionBackground.tsx` (جديد)
- `src/components/scenes/FullScreenScene.tsx` (تعديل — استخدام MotionBackground)

**Success Criteria:**
- [ ] الـ gradient بيتحرك ببطء (مش سريع)
- [ ] بيدي إحساس بالعمق بدون ما يشتت عن المحتوى
- [ ] `git commit -m "feat: motion backgrounds for full-screen scenes"`

---

### Feature 12: Transition Effects

**المشكلة:** كل الـ scenes بتعمل fade in/out بس — ممل.

**الحل:** transition effects متنوعة باستخدام `@remotion/transitions`.

**الخطوة 1:**

```bash
npm install @remotion/transitions
```

**الخطوة 2: أنواع الـ Transitions**

```typescript
type TransitionType = 'fade' | 'slide_right' | 'slide_up' | 'scale' | 'blur';
```

**الخطوة 3: كل scene في animation_plan يحدد الـ transition**

```json
{
  "id": "scene_1",
  "type": "definition",
  "transition_in": "slide_right",
  "transition_out": "fade"
}
```

**Default:** لو مش محدد → `fade`.

**قواعد من الـ Design Skills:**
- **motion-design:** الـ transition المفروض يخدم الـ narrative
  - `slide_right`: محتوى جديد بيدخل (process step)
  - `scale`: تكبير لنقطة مهمة (definition)
  - `fade`: انتقال هادي (default)
- **taste-skill:** transition duration 12-18 frames (مش أطول)

**الملفات المتأثرة:**
- `package.json` (إضافة @remotion/transitions)
- `src/components/scenes/FullScreenScene.tsx` (تعديل — transition logic)
- `src/types.ts` (إضافة TransitionType)

**Success Criteria:**
- [ ] 3+ أنواع transitions شغالين
- [ ] كل scene ممكن يحدد الـ transition بتاعه
- [ ] Default fade لو مش محدد
- [ ] `git commit -m "feat: transition effects using @remotion/transitions"`

---

### Feature 6: Intro Animation

**المشكلة:** الفيديو بيبدأ مباشرة بدون intro — مش professional.

**الحل:** 3.5 ثانية intro: logo + workshop name + lecturer name.

**التنفيذ:**

```tsx
// src/components/IntroCard.tsx
// Frame 0-15: Logo scale-up من 0.8 لـ 1.0 مع spring
// Frame 15-30: Workshop name slide-up مع fade
// Frame 30-45: Lecturer name fade-in
// Frame 75-105: كل حاجة fade-out + transition للفيديو
```

**قواعد من الـ Design Skills:**
- **frontend-design:** مش generic — اللوجو يكون ليه presence
- **motion-design:** spring physics للـ logo (damping 15, stiffness 100)
- **taste-skill:** motion intensity 6 (بين الهادي والحماسي)

**في tokens.ts:**

```typescript
intro: {
  durationSec: 3.5,
  logoScaleFrom: 0.8,
  logoScaleTo: 1.0,
  textDelaySec: 0.5,
  spring: { damping: 15, stiffness: 100, mass: 1.0 },
}
```

**التكامل مع Reel.tsx:**

```tsx
const introFrames = Math.round(tokens.intro.durationSec * fps);
// IntroCard قبل الـ lecture Sequence
// الـ lecture Sequence يبدأ from={introFrames}
```

**الملفات المتأثرة:**
- `src/components/IntroCard.tsx` (جديد)
- `src/Reel.tsx` (تعديل — إضافة Intro Sequence)
- `src/tokens.ts` (إضافة intro config)
- `src/types.ts` (تعديل ReelProps لو محتاج)

**Success Criteria:**
- [ ] Logo بيظهر بـ spring animation
- [ ] Workshop name + lecturer name بيظهروا بالترتيب
- [ ] Transition ناعم للفيديو
- [ ] الألوان والخطوط من الـ brand
- [ ] `git commit -m "feat: intro animation card"`

---

## تأكيد نهائي

```
اعمل preview لأول 15 ثانية:
- الـ intro (3.5s)
- transition للفيديو
- أول scene مع motion background + transition effect

ورّيني "جاهز للجولة 4".
```
