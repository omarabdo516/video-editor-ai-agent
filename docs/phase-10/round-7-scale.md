# Round 7: Scale

## الهدف
تقسيم الفيديو الطويل لريلز قصيرة — content multiplication.

## المدة المتوقعة
60-90 دقيقة

---

### Feature 4: Auto-Reels Splitter

**المشكلة:** فيديو 15 دقيقة = ريل واحد. بس ممكن يكون = 5 ريلز بمحتوى مختلف.

**الحل:** تقسيم أوتوماتيك بناءً على الأقسام في content_analysis.

**الخطوة 1: CLI Command**

أضف في `rs-reels.mjs`:

```bash
node rs-reels.mjs split <video> \
  --max-duration 90 \
  --min-duration 45 \
  [--lecturer "..."] \
  [--workshop "..."]
```

**الخطوة 2: الـ Logic**

```
1. اقرأ content_analysis.json → sections
2. اجمع sections في مجموعات (45-90 ثانية لكل ريل)
3. لو section أطول من max-duration → قسّمه عند أقرب pause
4. لكل ريل:
   a. اقطع الفيديو (ffmpeg)
   b. اقطع الكابشنز
   c. اقطع الـ face_map + energy
   d. اعمل animation plan مستقل
   e. أضف intro + outro مستقل
   f. ريندر
```

**الخطوة 3: Output**

```
output/
├── split_plan.json              ← خطة التقسيم
├── lecture-reel-01.mp4          (00:00 - 01:15)  "الميزانية العمومية"
├── lecture-reel-02.mp4          (01:15 - 02:30)  "معادلة المحاسبة"
├── lecture-reel-03.mp4          (02:30 - 03:30)  "أنواع الأصول"
└── split_summary.md             ← ملخص كل ريل
```

**split_plan.json:**

```json
{
  "source": "lecture.mp4",
  "total_duration_sec": 210,
  "reels": [
    {
      "index": 1,
      "title": "الميزانية العمومية",
      "start_sec": 0,
      "end_sec": 75,
      "duration_sec": 75,
      "sections": ["المقدمة", "تعريف الميزانية"],
      "key_moments": 3,
      "output_file": "lecture-reel-01.mp4"
    },
    {
      "index": 2,
      "title": "معادلة المحاسبة",
      "start_sec": 75,
      "end_sec": 150,
      "duration_sec": 75,
      "sections": ["معادلة المحاسبة", "أمثلة عملية"],
      "key_moments": 4,
      "output_file": "lecture-reel-02.mp4"
    }
  ]
}
```

**الخطوة 4: كل ريل مستقل**

كل ريل بياخد:
- intro خاص (نفس اللوجو + اسم مختلف لكل ريل)
- caption style نفسه
- animation plan مستقل (scenes + zooms + overlays)
- outro (نفسه لكل الريلز)
- SFX + music + ducking

**الخطوة 5: Approval Flow**

```
Claude Code:
  📋 Split Plan — 3 ريلز:
  
  Reel 1: "الميزانية العمومية" (75s)
    sections: المقدمة + تعريف الميزانية
    key_moments: 3
  
  Reel 2: "معادلة المحاسبة" (75s)
    sections: معادلة المحاسبة + أمثلة عملية
    key_moments: 4
  
  Reel 3: "أنواع الأصول" (60s)
    sections: أنواع الأصول + الخاتمة
    key_moments: 2
  
  موافق على التقسيم؟ عايز تعدل حاجة؟
```

**بعد الموافقة → يبدأ يريندر واحد واحد.**

**الملفات المتأثرة:**
- `rs-reels.mjs` (إضافة `split` subcommand)
- ممكن يحتاج utility functions لقطع الكابشنز والـ face_map

**Success Criteria:**
- [ ] `split` command بيقسّم صح بناءً على الـ sections
- [ ] كل ريل بـ intro + outro مستقل
- [ ] كل ريل ليه animation plan مستقل
- [ ] split_plan.json بيتكتب قبل الريندر
- [ ] المستخدم بيوافق على الخطة قبل الريندر
- [ ] `git commit -m "feat: auto-reels splitter"`

---

## تأكيد نهائي

```
ورّيني:
1. split_plan.json على فيديو RS حقيقي
2. أول ريل مريندر (preview 30 ثانية)

🎉 Phase 10 خلصت!
حدّث CLAUDE.md بالـ features الجديدة كلها.
git commit -m "phase-10: all 17 enhancement features complete"
```
