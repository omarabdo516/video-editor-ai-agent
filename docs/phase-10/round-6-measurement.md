# Round 6: Measurement

## الهدف
ربط الأداء الفعلي بالقرارات — عشان كل ريل يبقى أحسن من اللي قبله.

## المدة المتوقعة
30-45 دقيقة

---

### Feature 19: Performance Feedback Loop

**المشكلة:** بنعمل قرارات (zoom, scenes, captions) بناءً على حدس — مش data.

**الحل:** بعد كل ريل يتنشر — ندخل الأرقام ← Claude Code يتعلم.

**الخطوة 1: أنشئ الملفات**

```json
// feedback/performance_data.json
[]
```

```markdown
// feedback/performance_insights.md
# Performance Insights

## آخر تحديث: (لسه مفيش data)
## عدد الريلز المقاسة: 0

---

## Patterns (هتتملأ بعد 3+ ريلز)

### Hook
(لسه مفيش data كافية)

### Content Type  
(لسه مفيش data كافية)

### Visual Pacing
(لسه مفيش data كافية)

### Caption Style
(لسه مفيش data كافية)
```

**الخطوة 2: CLI Command**

أضف في `rs-reels.mjs`:

```bash
node rs-reels.mjs performance <video> \
  --views 12500 \
  --reach 18000 \
  --saves 95 \
  --shares 22 \
  --retention 0.65 \
  --drop-off 22 \
  --platform instagram
```

**الـ command بيعمل:**

1. يقرأ `feedback/performance_data.json`
2. يلاقي المشروع المرتبط بالفيديو
3. يضيف entry جديدة:

```json
{
  "project": "lecture-name",
  "platform": "instagram",
  "posted_date": "2026-04-16",
  "measured_date": "2026-04-23",
  "metrics": {
    "views": 12500,
    "reach": 18000,
    "saves": 95,
    "shares": 22,
    "retention_rate": 0.65,
    "drop_off_sec": 22
  },
  "reel_details": {
    "duration_sec": 85,
    "caption_style": "hormozi",
    "num_scenes": 3,
    "num_zooms": 4,
    "hook_type": "question",
    "has_sfx": true,
    "has_music": true
  }
}
```

4. يعرض ملخص

**الخطوة 3: Insights Update**

بعد 3+ entries — Claude Code يقدر يحدّث `performance_insights.md` بالـ patterns:

```markdown
## Patterns المكتشفة

### Hook
- أعلى retention: ريلز بدأت بسؤال (avg 72%)
- أقل retention: ريلز بدأت بـ "النهارده هنتكلم عن" (avg 45%)

### Visual Pacing
- Drop-off بعد 18-22 ثانية بدون visual event
- أعلى retention: event كل 12-15 ثانية
```

**الخطوة 4: التكامل مع Phase 6**

في بداية Phase 6 — Claude Code بيقرأ `performance_insights.md` ويعدّل قراراته:

```
Claude Code:
  📊 بناءً على Performance Data:
  - هبدأ بسؤال (retention أعلى 60%)
  - scene spacing: 15s بدل 45s
  - هضيف equation scene (saves أعلى 3x)
```

**الملفات المتأثرة:**
- `feedback/performance_data.json` (جديد)
- `feedback/performance_insights.md` (جديد)
- `rs-reels.mjs` (إضافة `performance` subcommand)

**Success Criteria:**
- [ ] CLI command شغال وبيسجّل data
- [ ] الملفات بتتكتب صح
- [ ] Claude Code بيقرأ الـ insights في Phase 6
- [ ] `git commit -m "feat: performance feedback loop"`

---

## تأكيد نهائي

```
ورّيني:
1. الـ CLI command شغال (جرّبه بأرقام وهمية)
2. performance_data.json فيه entry
ورّيني "جاهز للجولة 7".
```
