# Phase 11: Dashboard + Whisper Tracker + Bulk Mode

> **الهدف:** تحويل الـ workflow من CLI-driven + Claude-in-loop لـ Dashboard UI + Claude بس للـ Phase 5/6.
>
> **المبرر:** دلوقتي كل فيديو بيشغّل Claude session لمدة 30-40 دقيقة — معظمها scripts بتشتغل والـ context بيحرق tokens على progress output. Dashboard UI هتفصل الـ script execution عن الـ Claude thinking.

---

## الـ 3 أهداف الرئيسية

1. **Whisper Corrections Tracker** — كل مرة تعدل captions، بنسجّل الـ (raw, edited) diff عشان نجمع dataset للـ fine-tuning المستقبلي.
2. **Dashboard UI** — React + Express launcher لكل الـ phases (بدون Claude session).
3. **Bulk Mode** — select multiple videos → run phases عليهم كـ queue.

## تقسيم الـ sessions

| Session | الهدف | Effort | Dependencies |
|---------|------|--------|--------------|
| **1** | Whisper corrections tracker | 1-2h | — |
| **2** | Dashboard API backend (Express + SSE) | 3-4h | — |
| **3** | Dashboard React UI (core) | 3-4h | Session 2 |
| **4** | Dashboard polish + Claude handoff + rating | 2-3h | Session 3 |
| **5** | Bulk mode (multi-select + batch queue) | 2-3h | Session 4 |
| **6** | Docs + CLAUDE.md + memories + e2e test | 1-2h | Session 5 |

**المجموع**: ~12-18h شغل موزّع على 6 sessions.

## كيفية بدء Session جديدة

في بداية أي session:

```
اقرا docs/phase-11/README.md
اقرا docs/phase-11/session-N.md
ابدأ في تنفيذ Session N — التزم بـ non-goals.
```

ده كفاية — كل ملف session فيه الـ context كامل اللي Claude محتاجه.

## الـ artifacts اللي هتطلع

بعد ما الـ 6 sessions يخلصوا:

```
scripts/diff_captions.mjs                   ← session 1
feedback/whisper_corrections.jsonl          ← session 1 (auto-populated)
docs/phase-11-whisper-finetuning.md         ← session 1

dashboard-api/
  server.mjs                                ← session 2
  routes/{phases,videos,progress,batch}.mjs ← sessions 2+5
  state/videos.json                         ← session 2 (gitignored)
  package.json
  README.md

dashboard-ui/
  package.json                              ← session 3
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    api/client.ts
    store/useDashboardStore.ts
    components/{VideoList,VideoCard,...}.tsx ← sessions 3+4+5
    index.css

docs/dashboard-workflow.md                  ← session 6
```

---

## قواعد التنفيذ (لأي session من الستة)

1. **اقرا الـ files المحددة في أول Session قبل أي Edit/Write.** مفيش guessing.
2. **نفّذ اللي في "Files to Create" + "Files to Modify" بس.** ما تضيفش حاجات جانبية.
3. **افحص النتيجة ضد "Success Criteria" قبل ما تـ commit.**
4. **commit مرة واحدة في آخر الـ session** بالـ message في الـ session doc.
5. **حدّث CLAUDE.md + memory/ + feedback/ قبل الـ commit** (القاعدة الجديدة 2026-04-15).
6. **لو session هبت scope أكبر من اللي متوقع** — قسّمها واحفظ النص الجديد في نفس الـ doc، وقول لـ Omar قبل ما تكمل.
