# Phase 4: مراجعة الكابشنز عبر الـ UI

> **ملاحظة:** الـ default workflow من دلوقتي عبر الـ Dashboard UI — شوف [`docs/dashboard-workflow.md`](dashboard-workflow.md). الملف ده بيوصف الـ underlying caption review flow اللي الـ Dashboard Edit button بيـ trigger-ه.

## Input
- `data/subtitles_processed.srt` — الكابشنز المصححة
- `input/video.mp4` — الفيديو
- Subtitle Editor UI شغال (Phase 3)

## Output
- `src/data/subtitles_approved.json` — الكابشنز المعتمدة

## Success Criteria
- [ ] المستخدم فتح الـ Editor وشاف الكابشنز مع الفيديو
- [ ] المستخدم عدّل اللي محتاج تعديل
- [ ] المستخدم ضغط "Approve"
- [ ] ملف `subtitles_approved.json` موجود ومش فاضي
- [ ] كل subtitle فيه: id, index, startTime, endTime, text, words (لو متاح)

---

## الخطوات

### Step 4.1: تشغيل الـ Editor

```bash
cd subtitle-editor
npm run dev
```

### Step 4.2: تحميل الملفات

قول للمستخدم:
```
Claude Code:
  ✅ الـ Editor شغال على http://localhost:5173
  
  📝 محمّل [X] كابشن
  ⚠️ [Y] كابشن أقل من 5 كلمات
  ⚠️ [Z] كابشن أكتر من 7 كلمات
  ⚠️ [N] كابشن فيه [unclear]
  
  افتح الـ Editor وراجع الكابشنز.
  لما تخلص اضغط "Approve & Continue".
```

### Step 4.3: استنى الموافقة

- لما المستخدم يقول "خلصت" أو "عملت approve"
- اقرأ الملف الناتج: `subtitles_approved.json`
- تأكد إنه valid JSON وفيه subtitles

### Step 4.4: ملخص

```
Claude Code:
  ✅ الكابشنز معتمدة:
  - عدد الكابشنز: [X]
  - المدة الكلية: [Y]
  - متوسط الكلمات: [Z] كلمة/كابشن
  
  نبدأ Phase 5 (تحليل المحتوى)؟
```

### Step 4.5: Git Commit

```bash
git add .
git commit -m "v4: captions approved - [X] subtitles"
```
