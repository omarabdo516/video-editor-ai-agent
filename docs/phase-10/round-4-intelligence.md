# Round 4: Intelligence

## الهدف
4 features ذكية — الفيديو بيتكيّف مع المحتوى ويتنبأ بالمشاكل.

## المدة المتوقعة
90-120 دقيقة

## ⚠️ قبل ما تبدأ
- تأكد إن Round 3 خلصت و committed

---

### Feature 23: Adaptive Difficulty Scenes

**المشكلة:** كل الـ scenes بنفس التعقيد — محتوى بسيط بياخد scene مزحومة، ومحتوى معقد بياخد scene مبسّطة.

**الحل:** Claude Code بيحلل صعوبة كل key_moment ويختار complexity مناسبة.

**الخطوة 1: في Phase 5 (Content Analysis)**

كل key_moment يجيله difficulty:

```json
{
  "content": "الميزانية هي قائمة مالية",
  "difficulty": "simple",
  "difficulty_score": 1,
  "visual_complexity": "minimal"
}
```

| difficulty | متى | العناصر | المدة | الأنيميشن |
|-----------|------|---------|-------|----------|
| simple (1) | تعريف مباشر، جملة واحدة | 2-3 | 4-5s | fade |
| medium (2) | معادلة 3 عناصر، خطوات | 4-5 | 6-8s | stagger |
| complex (3) | مقارنة 4+ أبعاد، عملية طويلة | 6-8 | 8-10s | step-by-step |

**الخطوة 2: في tokens.ts**

```typescript
sceneComplexity: {
  simple: { maxElements: 3, durationSec: 4.5, staggerDelay: 0, animationType: 'fade' },
  medium: { maxElements: 5, durationSec: 7, staggerDelay: 9, animationType: 'stagger' },
  complex: { maxElements: 8, durationSec: 9, staggerDelay: 12, animationType: 'step_by_step',
             splitThreshold: 6 },
}
```

**الخطوة 3: في Phase 6 (Animation Plan)**

Claude Code بيستخدم الـ difficulty لاختيار scene type + duration + عدد العناصر.

**الملفات المتأثرة:**
- `src/tokens.ts` (إضافة sceneComplexity)
- `docs/phase-5-content-analysis.md` (تعديل — إضافة difficulty)
- `docs/phase-6-animation-planning.md` (تعديل — استخدام difficulty)

**Success Criteria:**
- [ ] كل key_moment ليه difficulty score
- [ ] simple → scene بسيطة / complex → scene مفصّلة
- [ ] `git commit -m "feat: adaptive difficulty for scenes"`

---

### Feature 20: Speech Rhythm Visualization

**المشكلة:** الـ visual effects مش متزامنة مع إيقاع كلام المحاضر.

**الحل:** تحليل الوقفات وسرعة الكلام → ربطها بالتأثيرات البصرية.

**الخطوة 1: ابني الـ script**

```python
# scripts/speech_rhythm.py
# Input: captions.json (مع word timestamps)
# Output: speech_rhythm.json

# بيحلل:
# - words_per_sec لكل segment
# - وقفات (micro < 0.4s / breath 0.4-0.8s / dramatic > 0.8s)
# - pace type (fast > 4 w/s / normal / slow_emphasis < 1.5 w/s)
```

الكود الكامل:

```python
import json, sys, numpy as np

input_file = sys.argv[1] if len(sys.argv) > 1 else "captions.json"
output_file = sys.argv[2] if len(sys.argv) > 2 else "speech_rhythm.json"

with open(input_file, 'r', encoding='utf-8') as f:
    captions = json.load(f)

segments = captions.get('segments', [])
rhythm_data = []

for i, seg in enumerate(segments):
    words = seg.get('words', [])
    if not words: continue
    
    seg_duration = seg['end'] - seg['start']
    words_per_sec = len(words) / seg_duration if seg_duration > 0 else 0
    
    pauses = []
    for j in range(1, len(words)):
        gap = words[j]['start'] - words[j-1]['end']
        if gap > 0.15:
            pauses.append({
                'start': round(words[j-1]['end'], 3),
                'end': round(words[j]['start'], 3),
                'duration': round(gap, 3),
                'type': 'dramatic' if gap > 0.8 else 'breath' if gap > 0.4 else 'micro',
                'word_after': words[j].get('word', ''),
            })
    
    pace = 'fast' if words_per_sec > 4.0 else 'normal' if words_per_sec > 2.5 else 'slow_emphasis' if words_per_sec > 1.5 else 'very_slow'
    
    rhythm_data.append({
        'segment_index': i, 'start': round(seg['start'], 3), 'end': round(seg['end'], 3),
        'pace': pace, 'words_per_sec': round(words_per_sec, 2),
        'pauses': pauses, 'has_dramatic_pause': any(p['type'] == 'dramatic' for p in pauses),
    })

output = {
    'summary': {
        'avg_words_per_sec': round(float(np.mean([r['words_per_sec'] for r in rhythm_data])), 2),
        'dramatic_pauses': sum(1 for r in rhythm_data if r['has_dramatic_pause']),
        'speaking_style': 'dynamic' if any(r['pace'] == 'fast' for r in rhythm_data) and any(r['pace'] in ('slow_emphasis','very_slow') for r in rhythm_data) else 'steady',
    },
    'segments': rhythm_data,
}

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ Speech rhythm: {len(rhythm_data)} segments, {output['summary']['dramatic_pauses']} dramatic pauses")
```

**الخطوة 2: أضفه في الـ pipeline**

في `rs-reels.mjs` — بعد الـ transcription:

```bash
python scripts/speech_rhythm.py <captions.json> <speech_rhythm.json>
```

**الخطوة 3: في Phase 6**

| إيقاع الكلام | التأثير البصري |
|-------------|--------------|
| وقفة طويلة (>0.8s) + كلمة بعدها | dramatic reveal (scale + glow) |
| تحوّل من سريع لبطيء | Smart Zoom بيبدأ |
| كلام سريع (>4 w/s) | captions أسرع + accent flashes |
| كلام بطيء (<1.5 w/s) | كل كلمة تاخد وقتها |

**الملفات المتأثرة:**
- `scripts/speech_rhythm.py` (جديد)
- `rs-reels.mjs` (إضافة في الـ pipeline)

**Success Criteria:**
- [ ] الـ script بيشتغل وبيطلع JSON صحيح
- [ ] dramatic pauses بتتحدد صح
- [ ] `git commit -m "feat: speech rhythm analysis script"`

---

### Feature 21: Retention Heatmap Prediction

**المشكلة:** مش عارفين فين المشاهد ممكن يعمل drop-off إلا بعد النشر.

**الحل:** retention score لكل 5 ثواني — قبل الريندر.

**الـ Scoring:**

```
+20: hook/سؤال/statement مثير
+15: full-screen scene
+10: smart zoom
+8:  overlay/keyword
+5:  micro event
+5:  رقم/إحصائية
+3:  dramatic pause + reveal
-10: 10+ ثواني بدون visual event
-15: 15+ ثواني بدون visual event
-20: 20+ ثواني بدون visual event (DROP ZONE)
```

**التنفيذ:** Claude Code بيحسبها في Phase 6 بعد الـ animation plan.

**العرض:**

```
🔮 Retention Prediction:
00-05s  █████████████████████ 95%  hook ✅
05-10s  ████████████████████░ 85%  scene ✅
10-15s  ███████████████░░░░░░ 75%  normal
15-20s  ███████████░░░░░░░░░░ 55%  ⚠️ gap
20-25s  ████████░░░░░░░░░░░░░ 40%  🔴 DROP ZONE
```

**Auto-Fix:** لو score < 50 → يقترح إضافة micro event أو notification.

**الملفات المتأثرة:**
- `docs/phase-6-animation-planning.md` (إضافة retention prediction step)

**Success Criteria:**
- [ ] كل animation plan فيه retention prediction
- [ ] Drop zones بتتحدد
- [ ] Fixes بتتقترح
- [ ] `git commit -m "feat: retention heatmap prediction in Phase 6"`

---

### Feature 9: Hook Detector

**المشكلة:** ريلز كتير بتبدأ بـ "النهارده هنتكلم عن..." — ده بيخسر 50% من المشاهدين.

**الحل:** Claude Code يحلل أول 3 ثواني ويقترح بداية أقوى.

**التنفيذ في Phase 5:**

```json
{
  "hook_analysis": {
    "first_3_seconds_text": "النهارده هنتكلم عن...",
    "hook_strength": "weak",
    "suggestion": "ابدأ من ثانية 15 — فيها سؤال مثير",
    "alternative_start_sec": 15.2,
    "suggested_text_hook": "هل تعرف الفرق بين الأصول والخصوم؟",
    "visual_suggestions": ["zoom 1.6x أول ثانيتين", "accent flash"]
  }
}
```

**لو المستخدم وافق:**
- Smart Zoom 1.6x أول 2 ثانية
- Text hook overlay (2 ثانية)
- AccentFlash على أول كلمة

**الملفات المتأثرة:**
- `docs/phase-5-content-analysis.md` (إضافة hook_analysis)

**Success Criteria:**
- [ ] Claude Code بيحلل أول 3 ثواني
- [ ] بيقترح بداية أقوى لو ضعيفة
- [ ] `git commit -m "feat: hook detector in Phase 5"`

---

## تأكيد نهائي

```
ورّيني:
1. speech_rhythm.json output على فيديو RS حقيقي
2. retention heatmap لنفس الفيديو
3. hook analysis لنفس الفيديو
ورّيني "جاهز للجولة 5".
```
