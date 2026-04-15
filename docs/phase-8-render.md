# Phase 8: Preview + Full Render

> **ملاحظة:** الـ default workflow من دلوقتي عبر الـ Dashboard UI — شوف [`docs/dashboard-workflow.md`](dashboard-workflow.md). الملف ده بيوصف الـ CLI render اللي بيشتغل خلف الـ Render button في الـ Dashboard.

## Input
- كل الـ Remotion components من Phase 7
- `src/MainVideo.tsx` — الـ Composition الرئيسي

## Output
- `output/preview.mp4` — أول 30 ثانية (جودة منخفضة)
- `output/final.mp4` — الفيديو النهائي (جودة عالية)

## Success Criteria
- [ ] Preview بيتريندر بدون أخطاء
- [ ] المستخدم وافق على الـ Preview
- [ ] Full render بيتريندر بدون أخطاء
- [ ] الفيديو النهائي بالجودة والأبعاد المطلوبة

---

## الخطوات

### Step 8.1: تقدير وقت الريندر

قبل ما تبدأ، احسب واعرض:

```
Claude Code:
  📊 تقدير الريندر:
  ─────────────────────────────
  مدة الفيديو:          [XX:XX]
  Full-Screen Scenes:    [X]
  Overlays:              [Y]
  Smart Zooms:           [Z]
  ─────────────────────────────
  Preview (30s):         ~20 ثانية
  Full Render:           ~[N] دقايق
  المساحة المتوقعة:     ~[M] MB
  ─────────────────────────────
  نبدأ بالـ Preview؟
```

### Step 8.2: Quick Preview

```bash
npx remotion render MainVideo output/preview.mp4 \
  --frames=0-900 \
  --scale=0.5 \
  --codec=h264 \
  --crf=28
```

**بعد الريندر:**
```
Claude Code:
  ✅ Preview جاهز: output/preview.mp4
  ⏱️ وقت الريندر: [X] ثانية
  📦 الحجم: [Y] MB
  
  اتفرج عليه وقولي:
  - ✅ كويس → نكمل full render
  - 🔄 عايز تعديل → قولي إيه
```

### Step 8.3: تعديلات (لو محتاج)

لو المستخدم قال "الموشن في 00:15 كبير" أو "الزووم بطيء":
1. عدّل الكود المعني
2. أعد الـ Preview (الجزء المعني بس لو ممكن)
3. اعرض تاني

### Step 8.4: Full Render

```bash
npx remotion render MainVideo output/final.mp4 \
  --codec=h264 \
  --crf=18 \
  --fps=30
```

**أثناء الريندر اعرض progress:**
```
Claude Code:
  🎬 Full Render...
  ⏳ 10%... 25%... 50%... 75%... 100%
  ✅ الفيديو النهائي جاهز!
  
  📦 output/final.mp4
  ⏱️ وقت الريندر: [X] دقيقة
  📐 الأبعاد: 1920x1080
  🎞️ المدة: [XX:XX]
  💾 الحجم: [Y] MB
  
  اتفرج عليه. نبدأ Phase 9 (التقييم)؟
```

### Step 8.5: Git Commit

```bash
git add . # (بدون ملفات الفيديو الكبيرة)
git commit -m "v8: render complete"
```

---

## ⚠️ Error Recovery

| المشكلة | الحل |
|---------|------|
| Render failed: composition not found | تأكد إن `src/Root.tsx` فيه `<Composition id="MainVideo">` |
| Out of memory | قلل `--concurrency=2` أو `--scale=0.5` |
| Video file not found | تأكد إن `input/video.mp4` موجود و `staticFile()` صح |
| Audio out of sync | تأكد إن FPS في الـ composition = FPS الفيديو الأصلي |
| Font not loading | أضف Cairo في `remotion.config.ts` أو حمّله من Google Fonts |
