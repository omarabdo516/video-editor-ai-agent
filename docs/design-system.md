# Design System — RS Lecturer Reels

> **اقرأ الملف ده قبل كتابة أي component في Phase 7.**
>
> ⚠️ **الملف ده مش المصدر للقيم.** القيم الفعلية (اللي بتحصل في runtime) موجودة في
> [`src/tokens.ts`](../src/tokens.ts). الملف ده بيشرح **الـ "ليه"** والـ **"امتى"** والقواعد
> اللي ما تظهرش من الأرقام لوحدها.
>
> **ترتيب الأولوية عند التعارض:**
> 1. [`brand/RS_BRAND.md`](../brand/RS_BRAND.md) — القواعد الثابتة (أعلى أولوية)
> 2. [`feedback/style_evolution.md`](../feedback/style_evolution.md) — تفضيلات عمر المتراكمة
> 3. الملف ده (`design-system.md`) — الـ defaults
> 4. [`src/tokens.ts`](../src/tokens.ts) — الـ runtime values (تنعكس من الثلاثة فوق)

---

## 🎨 الألوان

القيم في [`src/tokens.ts`](../src/tokens.ts) → `tokens.colors`.

| Token | Hex | متى تستخدمه |
|-------|-----|-------------|
| `primary` | `#10479D` | باكجراوند outro + lower-third bar + chapter dividers + scene backgrounds الغامقة. **ما يبقاش خلف نص ذهبي** (contrast بيبهت). |
| `accent` | `#FFB501` | الكلمة الحالية في الكابشن، keyword overlays، outro tagline، أي highlight واحد في الـ frame. **قاعدة:** accent واحد بس في الـ frame في أي لحظة. |
| `dark` | `#0D1F3C` | overlay شفافة (0.85) فوق الفيديو، caption background لو الحاجة (غالباً مش محتاجة — text-shadow كفاية)، backgrounds للـ scenes الغامقة. |
| `white` | `#FFFFFF` | الكابشنز العادية، text فوق backgrounds داكنة. |
| `overlay` | `rgba(13, 31, 60, 0.85)` | الشكل الشفاف لـ `dark` — بيستخدم كـ scrim خلف النص لو الفيديو فيه contrast عالي. |

### قواعد إجبارية
- **مفيش ألوان تانية.** مفيش أخضر، أحمر، بنفسجي. لو محتاج "نجاح" → accent. لو محتاج "تحذير" → accent + weight أعلى + stamp icon.
- **accent واحد في الـ frame.** لو في كلمة highlighted في الكابشن + overlay ذهبي فوق → واحد منهم يبقى primary أو white.
- **مفيش gradients شعاعية.** الـ scenes الـ backgrounds لو gradient → linear 135deg dark → darker (مش radial).

---

## 🔤 الخطوط

القيم في `tokens.fonts`.

| الاستخدام | Family | Weight | Size (1080×1920) |
|-----------|--------|--------|------------------|
| Scene title / Chapter divider | **Cairo** | 700 (Bold) | 72-96px |
| Scene body text | **Cairo** | 400 (Regular) | 40-48px |
| Label / sublabel | **Cairo** | 600 (SemiBold) | 28-32px |
| رقم كبير (counter) | **Cairo** | 800 (ExtraBold) | 120-160px |
| Keyword highlight overlay | **Cairo** | 700 (Bold) | 72px |
| Caption (Highlighted Phrase) | **Tajawal** | 800 (ExtraBold) | 56px |
| Lower-third name | **Cairo** | 700 (Bold) | 72px |
| Lower-third workshop | **Tajawal** | 800 (ExtraBold) | 44px |
| Outro tagline | **Cairo** | 700 (Bold) | 56px |

### قواعد
- **RTL إجباري** على أي نص عربي (`direction: 'rtl'`).
- **Text shadow إجباري** لما النص فوق الفيديو الخام (مش فوق solid background):
  ```css
  textShadow: '0 0 12px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,1)'
  ```
- **الأرقام:** دايماً إنجليزية (`1, 2, 3`) — مش هندية (`١، ٢، ٣`). السبب: corporate look.
- **مفيش italic.** Tajawal و Cairo مش مصممين italic للعربي.

---

## 📐 الـ Composition

القيم في `tokens.comp`.

| Field | Value | السبب |
|-------|-------|-------|
| Width | 1080 | Instagram/TikTok Reels standard |
| Height | 1920 | 9:16 |
| FPS | 30 | متوافق مع معظم مصادر الفيديو. 60fps بيضاعف وقت الريندر بدون فرق بصري ملحوظ في الـ talking head. |

### Safe Areas (من `brand/RS_BRAND.md`)
| المنطقة | المقدار | السبب |
|---------|--------|-------|
| Top | `220px` | مكان للـ logo bug + مسافة عن الـ platform UI (status bar, profile header) |
| Bottom | `420px` | مكان للكابشنز + مساحة للـ action buttons بتاعة Instagram/TikTok |
| Left | `100px` | margin أفقي |
| Right | `100px` | margin أفقي |

⚠️ أي نص مهم **لازم** يقع جوه الـ safe area — وإلا Instagram/TikTok هيقصه.

---

## 💬 الكابشنز

القيم في `tokens.captions`.

| Field | Value | السبب |
|-------|-------|-------|
| `fontSize` | 56 | قراءة مريحة على موبايل، مش صغيرة ومش غالبة على الفيديو |
| `lineHeight` | 1.35 | مسافة كافية بين السطرين في حالة wrap |
| `maxWidth` | 820 | يسيب margins 130px كل جنب — عشان الـ safe zone |
| `position.y` | 1420 | أسفل منتصف الشاشة، فوق الـ bottom safe area بـ 80px |
| `wordsPerChunk` | 6 | Sweet spot — أقل من 6 بيبقى choppy، أكتر بيبقى زحمة |
| `activeColor` | `#FFB501` (accent) | الكلمة الحالية highlighted |
| `inactiveColor` | `#FFFFFF` (white) | باقي الكلمات في الـ segment |

### قواعد Phase 7 (لما نبني caption styles متعددة)
- لو الجملة أقل من 3 كلمات → **ما تقسّمش**، سيبها segment واحد.
- لو الـ word timings من Whisper غير دقيقة (gap > 0.3s) → redistribute proportionally بنفس الـ logic بتاعة `fix-captions.js`.
- **ما تعرضش** segment مدته أقل من 0.3 ثانية — ادمجه مع اللي قبله أو بعده.
- الـ transition بين segments: fade (frames خروج، 4 frames دخول) — **مش** pop/cut.

### Word Highlight Animation
- الكلمة الحالية: `transform: scale(1.06)` + لون accent
- Transition: `transform 80ms ease-out` — سريع، ما يخلقش delay ملحوظ
- **ممنوع bounce spring على الحروف** — الـ reaction time لازم تبقى أقل من 100ms

---

## 🎯 Logo Bug

القيم في `tokens.logoBug`.

| Field | Value | السبب |
|-------|-------|-------|
| `position.x` | 540 | وسط الشاشة أفقياً |
| `position.y` | 143 | أعلى الشاشة، جوه الـ top safe area |
| `width` | 170 | ظاهر بس مش غالب |
| `opacity` | 0.9 | كامل تقريباً — brand presence واضح |

### قواعد
- **Top-center** (مش bottom-right). قرار مخصص للـ reels لأن الـ bottom فيها الكابشنز والـ platform UI.
- يختفي أثناء: **Full-Screen Scenes + Outro**.
- Drop-shadow خفيف: `drop-shadow(0 4px 18px rgba(0,0,0,0.4))`.
- ممنوع: stretch، rotation، outlines، glow.

---

## 🪪 Lower Third

القيم في `tokens.lowerThird`.

| Field | Value | السبب |
|-------|-------|-------|
| `durationSec` | 4 | كفاية يقرأ الاسم + الورشة. أكتر من كده مزاحم. |
| `startDelaySec` | 0.5 | يدي المشاهد نص ثانية يستوعب الفيديو قبل ما يظهر |
| `slideDurationSec` | 0.4 | سلس مش مفاجئ |
| `y` | 1100 | وسط-أسفل، فوق الكابشنز |
| `nameSize` | 60 | كبير + واضح — اتصغّر من 72 عشان التناسب مع العرض الأضيق |
| `titleSize` | 38 | أصغر شوية — hierarchy — اتصغّر من 44 |
| `barWidth` | 640 | أضيق من الكابشنز عشان ما يبقاش dominant — كان 820 |
| `barPaddingV` | 28 | auto height بـ padding بدل fixed barHeight 180 — الكلام يتنفس |

### Animation
- Bar: spring slide من اليمين لليسار (RTL)
- Text: fade-in بعد الـ bar بـ 0.2s (stagger)
- Exit: slide للشمال + fade (أول 0.4s من نهاية الـ duration)

---

## 🎬 Outro

القيم في `tokens.outro`.

| Field | Value | السبب |
|-------|-------|-------|
| `durationSec` | 2.5 | قصير — الـ reels الناس بتسكيب الأطراف |
| `logoWidth` | 420 | كبير — الـ brand presence قوي |
| `tagline` | `بنحقق طموحاتك المحاسبية` | الـ Arabic tagline الرسمي |
| `taglineSize` | 56 | hierarchy: اللوجو فوق (كبير) + tagline تحت (متوسط) |

### Background
- Solid `primary` (`#10479D`) — مش gradient.
- اللوجو في الـ center vertically - 100px (فوق الوسط بشوية)
- Tagline في الـ center vertically + 150px (تحت الوسط)

---

## 🎞️ Animation Curves (Remotion spring)

لما نكتب components في Phase 7، استخدم الـ presets دي بدل ما كل component يخترع قيمة:

| Name | damping | stiffness | mass | Use |
|------|---------|-----------|------|-----|
| `enter` | 20 | 100 | 1.0 | عناصر بتظهر (fade-in, scale-up) |
| `exit` | 25 | 120 | 0.8 | عناصر بتختفي (smoother, less bounce) |
| `bounce` | 12 | 150 | 1.0 | stamp / pop effect |
| `smooth` | 30 | 80 | 1.2 | zoom / long fade |

> **ملاحظة:** الـ presets دي لسه مش موجودة في `tokens.ts` — هتضاف في Phase 7 لما نبني أول scene component. لحد هناك الـ `LowerThird.tsx` بيستخدم قيم inline (damping 18).
>
> **القاعدة لـ Claude Code:** لما تضيف spring جديد، زوّد الـ preset ده في `tokens.ts` → `tokens.springs` وخلّي الـ components تقراه من هناك.

---

## 📏 Transitions

| Transition | Frames (at 30fps) | Use |
|-----------|-------------------|-----|
| Scene enter (fade) | 15 | Full-screen scenes بيظهروا |
| Scene exit (fade) | 12 | Full-screen scenes بيختفوا |
| Element stagger delay | 9 | بين عناصر في نفس الـ scene (stagger reveal) |
| Caption fade | 6 enter / 4 exit | بين caption segments |

---

## 📦 Spacing (للـ Scenes في Phase 7)

| Name | px | Use |
|------|-----|-----|
| `xs` | 8 | بين عناصر صغيرة ملتصقة |
| `sm` | 16 | padding داخلي للـ cards |
| `md` | 32 | بين أقسام في نفس الـ scene |
| `lg` | 64 | padding خارجي للـ scene |
| `xl` | 96 | margins كبيرة (nav, header) |

---

## 🌗 Scene Backgrounds (للـ Full-Screen Scenes في Phase 7)

| Name | Gradient |
|------|---------|
| `default` | `linear-gradient(135deg, #0D1F3C 0%, #10479D 100%)` |
| `dark` | `linear-gradient(135deg, #0D1F3C 0%, #0A1628 100%)` |
| `blue` | `linear-gradient(135deg, #10479D 0%, #0D1F3C 100%)` |
| `accent-wash` | `linear-gradient(135deg, #10479D 0%, #FFB501 100%)` — **استخدم بحذر**، accent كخلفية مبالغ فيه |

⚠️ ما تعملش scene background بلون `accent` solid. الـ accent للـ highlights مش للـ backgrounds.

---

## 🔄 Evolution Flow

لما Phase 9 يطلع feedback بيقول "غيّر قيمة":
1. عدّل القيمة في `src/tokens.ts`
2. عدّل القيمة في الملف ده + أضف سطر شرح ليه
3. أضف entry في `feedback/style_evolution.md` → "📐 القيم المعدّلة" بالتاريخ والسبب
4. Commit

**مهم:** لو القيمة في `brand/RS_BRAND.md` → ما تغيرهاش. الـ brand rules ثابتة.
