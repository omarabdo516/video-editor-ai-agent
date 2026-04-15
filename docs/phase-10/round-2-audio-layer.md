# Round 2: Audio Layer

## الهدف
إضافة طبقة صوتية احترافية — SFX + background music + audio ducking.

## المدة المتوقعة
60-90 دقيقة

## ⚠️ قبل ما تبدأ
- تأكد إن Round 1 خلصت و committed
- تأكد إن الـ preview شغال بدون أخطاء

---

### Feature 1: SFX Layer (Sound Effects)

**المشكلة:** الفيديو ساكت بصرياً — الأحداث البصرية بتحصل بدون أي إشارة صوتية.

**الحل:** أصوات خفيفة عند كل event. **المشاهد مش المفروض يلاحظها — بيحس بيها بس.**

**الخطوة 1: الملفات الصوتية**

```
public/sfx/
├── whoosh-soft.mp3       ← دخول/خروج scene (0.5-1s)
├── pop-subtle.mp3        ← keyword highlight (0.2-0.3s)
├── rise-gentle.mp3       ← smart zoom بيبدأ (0.5s)
├── tick-soft.mp3         ← chapter divider (0.3s)
├── click-micro.mp3       ← word emphasis (0.1-0.2s)
├── swoosh-soft.mp3       ← outro (0.5s)
└── transition-slide.mp3  ← transition بين scenes (0.3s)
```

**مصادر مجانية (اختر واحد):**
- https://mixkit.co/free-sound-effects/ (بدون attribution)
- https://pixabay.com/sound-effects/ (بدون attribution)
- أو ولّدهم بـ Tone.js (synthesized — بدون copyright)

**الخطوة 2: الـ Component**

```tsx
// src/components/SfxLayer.tsx

const SFX_CONFIG = {
  scene_enter:  { file: 'sfx/whoosh-soft.mp3',      volume: 0.15 },
  scene_exit:   { file: 'sfx/whoosh-soft.mp3',      volume: 0.12 },
  keyword:      { file: 'sfx/pop-subtle.mp3',       volume: 0.12 },
  zoom_start:   { file: 'sfx/rise-gentle.mp3',      volume: 0.10 },
  chapter:      { file: 'sfx/tick-soft.mp3',        volume: 0.15 },
  word_pop:     { file: 'sfx/click-micro.mp3',      volume: 0.06 },
  outro:        { file: 'sfx/swoosh-soft.mp3',      volume: 0.15 },
  transition:   { file: 'sfx/transition-slide.mp3', volume: 0.12 },
} as const;

// كل event في الفيديو → Audio Sequence عند الـ timestamp بتاعه
```

**الخطوة 3: التكامل مع Reel.tsx**
- scenes → scene_enter + scene_exit
- overlays (keyword) → keyword
- zoom plan moments → zoom_start
- chapter dividers → chapter
- micro events (word_pop) → word_pop
- outro start → outro

**الخطوة 4: tokens.ts**

```typescript
sfx: {
  enabled: true,
  globalVolume: 1.0,  // multiplier (0.0 - 1.0)
}
```

**الملفات المتأثرة:**
- `public/sfx/*.mp3` (7 ملفات جديدة)
- `src/components/SfxLayer.tsx` (جديد)
- `src/Reel.tsx` (إضافة SfxLayer)
- `src/tokens.ts` (إضافة sfx config)

**Success Criteria:**
- [ ] 7 ملفات SFX موجودة في `public/sfx/`
- [ ] كل event ليه صوت مناسب
- [ ] الأصوات مش مزعجة (volume < 20%)
- [ ] `sfx.enabled = false` بيقفّلهم كلهم
- [ ] `git commit -m "feat: SFX layer with 7 sound effects"`

---

### Feature 2: Background Music

**المشكلة:** سكوت بين كلام المحاضر بيحسس بالفراغ.

**الحل:** ambient loop خفيف جداً (3% volume).

**الخطوة 1: الملف**

```
public/music/
└── ambient-soft.mp3    ← loop 30-60 ثانية، مجاني
```

مصدر: https://pixabay.com/music/search/ambient%20loop/

**الخطوة 2: الـ Component**

```tsx
// src/components/BackgroundMusic.tsx
// - volume: 0.03 (3%)
// - fade in: 2 ثواني في البداية
// - fade out: 3 ثواني في النهاية
// - loop: true
```

**الخطوة 3: tokens.ts**

```typescript
music: {
  enabled: true,
  volume: 0.03,
  fadeInSec: 2,
  fadeOutSec: 3,
}
```

**Success Criteria:**
- [ ] الميوزك بتشتغل طول الفيديو
- [ ] مش ملحوظة — بتحس بيها بس
- [ ] fade in/out ناعم
- [ ] `music.enabled = false` بيقفّلها
- [ ] `git commit -m "feat: background music with fade in/out"`

---

### Feature 17: Audio Ducking

**المشكلة:** أثناء Full-Screen Scenes، صوت المحاضر بيتنافس مع الـ SFX والمحتوى البصري.

**الحل:** صوت المحاضر ينزل لـ 70% أثناء الـ scenes مع smooth fade.

**التنفيذ:**

```tsx
// في Reel.tsx:
// 1. الفيديو بيبقى muted:
<OffthreadVideo src={videoSrc} muted />

// 2. أوديو منفصل مع ducking:
<Audio
  src={audioSrc}
  volume={(f) => duckVolume(f, fps, scenes)}
/>

// 3. الـ ducking function:
function duckVolume(frame: number, fps: number, scenes: Scene[]): number {
  const fadeFrames = 10;
  for (const scene of scenes) {
    const start = scene.start_sec * fps;
    const end = scene.end_sec * fps;
    // fade down قبل الـ scene
    if (frame >= start - fadeFrames && frame < start) {
      return interpolate(frame, [start - fadeFrames, start], [1.0, 0.7]);
    }
    // during scene
    if (frame >= start && frame < end) return 0.7;
    // fade up بعد الـ scene
    if (frame >= end && frame < end + fadeFrames) {
      return interpolate(frame, [end, end + fadeFrames], [0.7, 1.0]);
    }
  }
  return 1.0;
}
```

**⚠️ مهم:** محتاج audio file منفصل — استخدم الـ `.16k.wav` اللي Phase 1 عملته، أو استخرج الأوديو من الفيديو الـ pre-scaled.

**الملفات المتأثرة:**
- `src/Reel.tsx` (تعديل VideoTrack + إضافة Audio)
- `src/components/VideoTrack.tsx` (إضافة muted prop)

**Success Criteria:**
- [ ] صوت المحاضر بينزل أثناء scenes
- [ ] الـ fade ناعم (مش قطع)
- [ ] بيرجع 100% بعد الـ scene
- [ ] `git commit -m "feat: audio ducking during full-screen scenes"`

---

## تأكيد نهائي

```
اعمل preview 30 ثانية فيها:
- scene واحدة على الأقل
- keyword overlay واحد
- smart zoom واحد

عشان أسمع: SFX + music + ducking مع بعض.
ورّيني "جاهز للجولة 3".
```
