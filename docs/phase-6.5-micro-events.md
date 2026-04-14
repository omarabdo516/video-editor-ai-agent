# Phase 6.5: Micro-Events (Tier 2 Retention Rhythm)

> **Added:** 2026-04-14. الـ phase دي اتضافت بعد Phase 6 الأول لما لاحظنا إن الـ major events (scenes/zooms/overlays) لوحدهم بيسيبوا gaps كبيرة في الفيديو (~10-30s بدون أي حاجة بتحصل) وده بيخلي المشاهد يمل.

## الفكرة

في صناعة الـ reels، القاعدة: **كل 4 ثواني لازم يحصل حاجة بصرية جديدة**. من غير كده، retention بيسقط.

Phase 6 بيطلّع ~14 major event في 209s (cadence ~15s) — بعيد جداً عن الـ 4s المطلوبة. **Phase 6.5** بيضيف طبقة تانية من micro events مبنية على الـ emphasis_moments الموجودين في `content_analysis.json` عشان يملا الـ gaps.

## Input

- [`src/data/<basename>/content_analysis.json`](../src/data/) — Phase 5 output (فيه 30-40 emphasis_moment)
- [`src/data/<basename>/animation_plan.json`](../src/data/) — Phase 6 output (scenes + zooms + overlays — الـ occupied windows)
- `<video>.mp4.captions.json` — للـ word-level timings
- `<video>.1080x1920.mp4.face_map.json` — للـ face positions في mini zooms

## Output

`src/data/<basename>/animation_plan.json` — بيتحدّث في نفس الملف بـ:
```json
{
  "micro_events": [
    { "id": "micro_1", "type": "word_pop", "start_sec": 0.30, "end_sec": 0.90, "word": "بقى", ... },
    { "id": "micro_2", "type": "caption_underline", "start_sec": 12.31, "end_sec": 13.51, ... },
    { "id": "micro_3", "type": "mini_zoom", "start_sec": 36.60, "end_sec": 37.80, "zoom_level": 1.08, ... },
    ...
  ],
  "micro_events_stats": {
    "total": 30,
    "cadence_sec": 6.97,
    "by_type": { "word_pop": 20, "caption_underline": 7, "mini_zoom": 3 }
  }
}
```

## Success Criteria

- [ ] Total events (Tier 1 + Tier 2) يعطي cadence قريب من 4s
- [ ] مفيش micro event يعمل overlap مع major event (scene/overlay/big zoom)
- [ ] Min 3s بين كل micro event والـ micro event اللي بعده
- [ ] الـ mini_zoom يكون face conf ≥ 0.5
- [ ] Gap filling: أي gap > 6s يتملا synthetically

## Usage

```bash
node scripts/generate_micro_events.mjs "<video_basename>"
```

مثال:
```bash
node scripts/generate_micro_events.mjs "محمد ريان - ورشة الشامل"
```

الـ script بيقرأ `src/data/<basename>/` + الـ paths من `plan.source` + `analysis.source` + بيكتب `micro_events` inplace في `animation_plan.json`.

---

## الـ 4 Micro-Event Types

### 1. `word_pop` — In-Caption Word Boost

**مش component منفصل.** بيشتغل من خلال [`WordCaption.tsx`](../src/components/WordCaption.tsx):
- Reel.tsx بيمرر `emphasisTimes` array لكل WordCaption
- WordCaption بتشوف لو في emphasis time خلال ±0.15-0.30s من nowSec
- لو آه، الكلمة الـ active في اللحظة دي بتتكبر 1.28x + rotate -2° + glow accent أقوى
- الـ duration الفعّال: ~0.45s per boost

**ليه in-caption مش floating pill؟** جرّبنا الـ floating pill الأول وكان بيتعارض مع الـ lower-third والكابشنز. الـ in-caption أنظف + أذكى + بيربط الانتباه بالكلمة اللي بتُسمع فعلاً.

**الاختيار:** medium intensity emphasis (alternating مع caption_underline).

---

### 2. `caption_underline` — Accent Line Under Captions

Component: [`micro/CaptionUnderline.tsx`](../src/components/micro/CaptionUnderline.tsx)

- خط accent (gradient) بيترسم من اليمين لليسار (RTL) تحت الكابشن
- Glow pulse مستمر بعد ما الخط يخلص
- Fade out في الآخر
- المدة: ~1.2s total
- المكان: y ≈ 1450 (تحت الكابشن مباشرة)

**الاختيار:** medium intensity emphasis (alternating مع word_pop).

---

### 3. `mini_zoom` — Small Face Zoom

**مش component منفصل.** بيندمج في الـ `smart_zoom_plan.moments` upstream:
- `Reel.tsx > mergeMiniZoomsIntoPlan()` بتاخد الـ mini_zooms من `micro_events` وتضيفهم للـ smart_zoom_plan
- الـ SmartZoom الموجود بيرسمهم بنفس الـ logic
- الفرق الوحيد: `zoomLevel: 1.08` بدل 1.4، والـ duration 1.2s بدل 4s

**الاختيار:** strong intensity emphasis (اللي مش مستخدم كـ big zoom).

**Face centering:** الـ generator بيحسب avg face position من face_map.json للـ window المطلوبة (مع confidence filter ≥ 0.5).

---

### 4. `accent_flash` — Edge Bar Flash

Component: [`micro/AccentFlash.tsx`](../src/components/micro/AccentFlash.tsx)

- Vertical bar accent (16px wide, 520px tall) بيظهر من edge الشاشة (يمين أو شمال)
- Slide in → hold → slide out
- المدة: ~0.6s total

**الاختيار:** low intensity emphasis (حالياً 0 events لأن الـ generator مش بيوصل للـ low — محتاج tuning).

---

## الـ Generator Algorithm

الـ script: [`scripts/generate_micro_events.mjs`](../scripts/generate_micro_events.mjs)

**Pass 1 — Occupied windows:**
```
occupied = [
  ...scenes,        // كل scene → window من start_sec → end_sec
  ...overlays,      // نفس الشيء
  ...smart_zooms    // نفس الشيء
]
```

**Pass 2 — Emphasis → candidate:**
```
for em in emphasis_moments:
  if isBlocked(em.time, occupied, buffer=1.2s):
    skip
  type = TYPE_BY_INTENSITY[em.intensity]  # strong→mini_zoom, medium→word_pop/underline, low→accent_flash
  candidates.push({ time, type, intensity, ... })
```

**Pass 3 — Enforce min gap 3s:**
```
filtered = []
for c in candidates.sorted_by_time:
  last = filtered[-1]
  if not last or c.time - last.time >= 3.0:
    filtered.push(c)
  elif stronger(c, last):
    filtered[-1] = c  # replace with stronger one
```

**Pass 4 — Gap filling (synthetic):**
```
anchors = filtered + occupied_windows  # sorted
for gap in anchors.pairs() where gap >= 6.0:
  count = floor(gap / 4)
  for i in 1..count:
    t = gap_start + (gap * i / (count+1))
    if isBlocked(t): skip
    segment = findSegmentAt(captions, t)
    word = pickLoudestWord(segment, t)
    synthetic.push({ time: t, type: 'word_pop', word, source: 'gap_fill' })
```

**Pass 5 — Merge + re-enforce gap + materialize:**
```
merged = filtered + synthetic, sorted
final = []
for c in merged:
  last = final[-1]
  if not last or c.time - last.time >= 3.0:
    final.push(c)
  elif stronger(c, last):
    final[-1] = c

# For each final event, compute start_sec, end_sec, and side data (word, face position, etc.)
return final.map(materialize)
```

---

## الـ Constants (tunable)

في [`scripts/generate_micro_events.mjs`](../scripts/generate_micro_events.mjs):

```js
const OCCUPY_BUFFER_SEC = 1.2;   // keep micro events 1.2s away from major event boundaries
const MIN_MICRO_GAP_SEC = 3.0;   // min gap between consecutive micro events
const MAX_GAP_FILL_SEC = 6.0;    // fill gaps larger than this with synthetic word_pops
const TARGET_CADENCE_SEC = 4.0;  // target cadence for reels retention
```

**لو عايز تعديل الـ rhythm:**
- أقل cadence → قلل `MIN_MICRO_GAP_SEC` (مثلاً 2.5) و `TARGET_CADENCE_SEC` (مثلاً 3.5)
- أكتر نظافة → زوّد `OCCUPY_BUFFER_SEC` (مثلاً 2.0)
- أقل gap filling → زوّد `MAX_GAP_FILL_SEC` (مثلاً 8.0)

---

## Integration مع Phase 7

الـ Reel.tsx بيقرا `animationPlan.micro_events` ويـ dispatch على النوع:

```tsx
const effectiveZoomPlan = mergeMiniZoomsIntoPlan(baseZoomPlan, microEvents);
const emphasisTimes = microEvents.filter(e => e.type === 'word_pop').map(e => midpoint(e));

// Pass emphasisTimes to each WordCaption (per-segment filtered)
<WordCaption segment={seg} emphasisTimes={segEmphasis} />

// Render non-word_pop micro events as MicroEventHost sequences
{microEvents.map(ev => (
  <Sequence><MicroEventHost event={ev} /></Sequence>
))}
```

راجع [`docs/phase-7-remotion-components.md`](phase-7-remotion-components.md) لـ الـ architecture الكامل.

---

## Example Output Stats (محمد ريان - ورشة الشامل)

```
Duration: 209.2s
Emphasis candidates: 20
After 3s spacing filter: 16
Gap-fill synthetic: 19
Final micro-events: 30

By type:
  word_pop           20
  caption_underline   7
  mini_zoom           3
  accent_flash        0   ← needs tuning (see below)

Total events (Tier 1 + Tier 2): 43
Cadence: 4.86s/event (target 4s, close enough ✓)
```

---

## Known Issues

1. **Accent flash = 0 events.** السبب: الـ emphasis_moments كلهم "strong" أو "medium" في الـ analysis الحالي، مفيش "low". المحتاج: الـ gap-fill pass يضيف الاختيار الثالث accent_flash بدل الاعتماد على الـ low intensity.

2. **Cadence 4.86 مش 4.0.** قريب بس مش مثالي. تحسين ممكن: زود الـ count في الـ gap-fill بحيث يكون `ceil(gap / 4)` بدل `floor`.

3. **Synthetic word_pops بتستخدم gap_fill source.** مش في الـ emphasis الأصلي، يعني مش بالضرورة تتطابق مع peaks صوتية. دلوقتي شغّال لكن ممكن يبقى أذكى لو الـ generator بيشوف على energy peaks صغيرة (under the analysis threshold) في الـ gap.
