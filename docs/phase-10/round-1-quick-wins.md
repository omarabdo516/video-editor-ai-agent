# Round 1: Quick Wins

## الهدف
3 تعديلات صغيرة بتأثير كبير — كلهم في الكابشنز.

## المدة المتوقعة
30-45 دقيقة

## الـ Features

---

### Feature 7: Dynamic Font Size

**المشكلة:** كل الكابشنز بنفس حجم الخط — الطويلة مزحومة والقصيرة ضايعة.

**الحل:** حجم الخط يتناسب مع عدد الكلمات.

**التنفيذ:**
عدّل كل caption style component (WordCaption, WordCaptionPop, إلخ):

```typescript
const wordCount = segment.words.length;
const baseFontSize = tokens.captions.fontSize;

const dynamicFontSize = wordCount <= 3
  ? baseFontSize * 1.2    // كلمات قليلة → أكبر 20%
  : wordCount <= 5
  ? baseFontSize           // عادي
  : wordCount <= 7
  ? baseFontSize * 0.9    // كتير شوية → أصغر 10%
  : baseFontSize * 0.8;   // كتير أوي → أصغر 20%
```

**الملفات المتأثرة:**
- `src/components/WordCaption.tsx`
- `src/components/WordCaptionPop.tsx`
- `src/components/WordCaptionKaraoke.tsx`
- `src/components/WordCaptionBox.tsx`
- `src/components/WordCaptionTypewriter.tsx`
- `src/components/WordCaptionClassic.tsx`

**Success Criteria:**
- [ ] كابشن 2 كلمات → خط أكبر بوضوح
- [ ] كابشن 7 كلمات → خط أصغر بدون ما يبقى صعب القراءة
- [ ] `git commit -m "feat: dynamic font size for captions"`

---

### Feature 3: Progress Bar

**المشكلة:** المشاهد مش عارف فين هو في الفيديو — بيأثر على الـ retention.

**الحل:** شريط رفيع (3px) أعلى الشاشة.

**التنفيذ:**

```tsx
// src/components/ProgressBar.tsx
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';

export const ProgressBar: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const progress = (frame / totalFrames) * 100;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.1)',
      zIndex: 950,
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        backgroundColor: tokens.colors.accent,
      }} />
    </div>
  );
};
```

**التكامل:** أضفه في `Reel.tsx` جوه الـ lecture Sequence.

**الملفات المتأثرة:**
- `src/components/ProgressBar.tsx` (جديد)
- `src/Reel.tsx` (إضافة)

**Success Criteria:**
- [ ] الشريط ظاهر أعلى الشاشة
- [ ] بيتحرك بسلاسة من 0% لـ 100%
- [ ] اللون من الـ brand accent
- [ ] `git commit -m "feat: progress bar component"`

---

### Feature 13: Emotion-Based Caption Color

**المشكلة:** كل الكابشنز بنفس لون الـ highlight — مفيش تمييز.

**الحل:** لون الـ highlight يتغير حسب نوع الكلام.

**الـ Logic:**

```typescript
type CaptionEmotion = 'normal' | 'emphasis' | 'question' | 'number';

function detectEmotion(text: string, isEmphasis: boolean): CaptionEmotion {
  // أسئلة
  if (text.includes('؟') || /\b(هل|ليه|إيه|ازاي|إزاي|ايه|مين|فين|امتى)\b/.test(text)) {
    return 'question';
  }
  // أرقام
  if (/\d+|%|مليون|ألف|مليار/.test(text)) {
    return 'number';
  }
  // emphasis (من audio energy)
  if (isEmphasis) {
    return 'emphasis';
  }
  return 'normal';
}
```

**الألوان:**

```typescript
const emotionColors = {
  normal: tokens.colors.accent,         // الذهبي العادي
  emphasis: tokens.colors.accent,        // ذهبي + glow أكبر
  question: tokens.colors.secondary,     // لون تاني (أخضر)
  number: tokens.colors.primary,         // أزرق
};
```

**الملفات المتأثرة:**
- `src/components/WordCaption.tsx` (وكل caption style)
- `src/utils/emotion.ts` (جديد — الـ detection logic)

**Success Criteria:**
- [ ] كابشن فيه "هل" أو "؟" → لون مختلف
- [ ] كابشن فيه أرقام → لون مختلف
- [ ] كابشن مع emphasis → glow أقوى
- [ ] `git commit -m "feat: emotion-based caption colors"`

---

## بعد ما تخلص الجولة

```
ورّيني:
1. ملخص اللي اتعمل
2. preview screenshot أو 10 ثواني render
3. "جاهز للجولة 2"
```
