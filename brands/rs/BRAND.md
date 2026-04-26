# RS Financial Services — Brand Profile

> **قبل ما تكتب أي component أو نص يظهر في فيديو لـ RS — اقرأ الملف ده.**
> القواعد هنا إجبارية ولها أولوية على أي `docs/design-system.md` أو `feedback/style_evolution.md`.
>
> 🔒 **القواعد القابلة للتنفيذ آلياً** (الـ hard constraints + soft preferences) موجودة في
> [`brand-rules.json`](brand-rules.json) — ده الـ machine-readable source of truth اللي
> الـ brand validator + Claude planner بيقروه. الملف ده (BRAND.md) بيشرح الـ "ليه" + السياق
> البشري؛ الـ JSON بيحمل الأرقام والقواعد الـ enforceable. لو فيه تعارض بين الاتنين —
> الـ JSON بيكسب لأنه اللي بيتنفّذ في الكود.
>
> ⚠️ ده الـ brand profile لـ **RS Financial Services**. لو هتشتغل على برند تاني، أنشئ
> `brands/<client>/BRAND.md` + `brands/<client>/brand-rules.json` جديدين ووصّل الـ tokens
> المناسبة في `src/tokens.ts` (multi-brand support هيتضاف في refactor مستقبلي).

---

## 🏢 مين RS؟

**RS Financial Services (Rising Star)** — مؤسسة تدريبية متخصصة في المحاسبة والمالية، مقرها القاهرة، تأسست **2014**. بتدرّب **أكتر من 50,000 محاسب** من يومها.

- **Tagline:** `We Achieve Your Accounting Ambition` — "بنحقق طموحك المحاسبي"
- **Value Prop:** في RS، مش بنشرح دورة محاسبية — **هتشتغل فعلاً** على مستندات وملفات من شركات حقيقية.
- **Social Proof:** أكتر من 50,000 محاسب اتدربوا معانا من 2014

---

## 🎭 الشخصية + الصوت

### الـ 3 كلمات الجوهرية
**Trustworthy · Expert · Approachable**

### الـ Archetype
**"الخبير الصريح الواثق"** — محاسب قانوني مصري خبرة 10+ سنين، اشتغل في الخليج ورجع. جاد، صريح، محترم، مش بيضيع وقتك، بيقولك الحقيقة في وجهك.

### ✅ We Are / ❌ We Are Not

| ✅ احنا | ❌ مش احنا |
|---------|-----------|
| عمليون — شغل بالإيد على ملفات حقيقية | نظريون — شرح كتاب أو محاضرة جامعة |
| واثقون — منطق وخبرة حقيقية | متعجرفون — ادعاءات فاضية |
| واقعيون — الحقيقة كما هي | وعود فاضية ("هتبقى غني في أسبوع") |
| قريبون — بنكلمك كصاحبك | متعالون — جمل برّاقة فارغة |
| محترفون — لغة مالية دقيقة | سطحيون — فيلر بدون هدف |

### اللهجة
**مصري عامي** — مش سوقي ومش رسمي زيادة. جمل قصيرة. بدون مبالغة. بدون emojis في الـ on-screen text إلا لو السياق لطيف جداً (رسالة شكر مثلاً).

---

## 🎨 الألوان (للـ Reels)

القيم الفعلية اللي بتحصل في runtime موجودة في [`src/tokens.ts`](../../src/tokens.ts). الجدول ده بيشرح الـ **ليه** والـ **امتى**.

| الاسم | Hex | RGB (0-1) | الاستخدام |
|-------|-----|-----------|-----------|
| **Primary** | `#10479D` | `0.063, 0.278, 0.616` | باكجراوند outro، lower-third bar، chapter dividers، backgrounds الغامقة للـ scenes |
| **Accent** | `#FFB501` | `1.0, 0.71, 0.004` | الكلمة الحالية في الكابشن (highlight)، keyword overlays، tagline، أي highlight تاني |
| **Dark** | `#0D1F3C` | `0.051, 0.122, 0.235` | overlay شفافة فوق الفيديو، caption background (عند الحاجة)، scene backgrounds |
| **White** | `#FFFFFF` | `1.0, 1.0, 1.0` | الكابشنز العادية (الكلمات اللي لسه أو بعد الحالية) |

### قواعد إجبارية
- **مفيش ألوان تانية خالص.** مفيش أخضر، مفيش أحمر، مفيش أزرق تاني. لو محتاج "تأكيد إيجابي" → Accent (#FFB501). لو محتاج "تنبيه" → Accent ومعاه weight أعلى.
- لو الـ scene فيها نص أبيض → الباكجراوند Primary أو Dark (عشان الـ contrast).
- لو الـ scene فيها نص ذهبي (Accent) → الباكجراوند Primary (مش Dark — عشان الـ contrast بيبهت).
- **مفيش gradients شعاعية** أو ألوان pastel. الـ brand corporate وصارم.

---

## 🔤 الخطوط

> **محدّث 2026-04-26**: الخطوط اتغيّرت من Cairo + Tajawal لـ **Alexandria + IBM Plex Sans Arabic**. الـ code migration خلصت في نفس اليوم — الـ woff2 الجديدة في `public/fonts/`، و `src/utils/fonts.ts` + `src/tokens.ts` + الـ CSS الـ dashboard + subtitle-editor كلهم محدّثين. **ملاحظة weight:** IBM Plex Sans Arabic أقصى weight 700 (Bold) مش 800 — الكابشنز كانت Tajawal ExtraBold 800، بقت IBM Plex Sans Arabic Bold 700.

| Family | Weight الأساسي | الاستخدام |
|--------|----------------|-----------|
| **Alexandria** | Bold (700) | العناوين، Chapter titles، Lower-third name، Outro tagline، Scene titles |
| **IBM Plex Sans Arabic** | ExtraBold (800) | الكابشنز (word-by-word)، أرقام كبيرة، highlight overlays |

- **Cairo و Tajawal مش معتمدين بعد دلوقتي** لأي ريل RS جديد.
- **Direction:** RTL دايماً.
- **الأرقام في النص العربي:** أرقام إنجليزية عادية (`1, 2, 3`) — الأرقام الهندية (`١، ٢، ٣`) ممنوعة لأنها بتوحي بطابع ديني/تقليدي أكتر من corporate.
- **Text shadow إجباري** لما النص فوق الفيديو — `0 0 12px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.7)` (زي اللي في `WordCaption.tsx`).

---

## 🏷️ اللوجو

### الملفات
- **الأساسي:** [`assets/logo.png`](assets/logo.png) — brand-owned copy + `public/logo.png` للـ Remotion staticFile
- **Alternative:** [`assets/logo-alt.png`](assets/logo-alt.png) — فيرجن بديل (أبيض/للباكجراوندز الغامقة جداً)

### قواعد الاستخدام في الريلز
- **Logo Bug** (اللوجو الصغير اللي بيفضل طول الفيديو):
  - المكان: أعلى منتصف الشاشة (`top-center`) — **مش** bottom-right زي المعتاد، لأن الـ reels عمودية والـ bottom فيها كابشنز.
  - العرض: `170px` (على comp 1080×1920)
  - Opacity: `0.9`
  - Drop-shadow خفيف: `drop-shadow(0 4px 18px rgba(0,0,0,0.4))`
- **Logo بيفضل ظاهر طول الفيديو** — على طول fades الـ Full-Screen Scenes والـ Smart Zooms. Brand presence أهم من نظافة الـ scene composition.
  - الاستثناء الوحيد: الـ Outro (لأن الـ outro نفسه فيه لوجو كبير في الوسط)
  - عشان كده الـ scene titles لازم تسيب مسافة أعلى الشاشة (paddingTop ~280px) عشان ما تتعارضش مع اللوجو
- **اللوجو في الـ Outro:**
  - وسط الشاشة، عرض `420px`
  - تحته مباشرة الـ tagline بـ accent color

### ممنوع
- تغيير نسب اللوجو (stretch)
- إضافة effects على اللوجو (glow, outlines, rotation)
- وضع اللوجو فوق وش المحاضر

---

## 📚 المصطلحات — إجباري

| ✅ استخدم | ❌ تجنب | السبب |
|----------|---------|-------|
| **ورشة** | كورس / دورة | "كورس" يوحي بمحتوى رخيص — RS workshops |
| **تطبيق عملي** | محتوى نظري | عكس الـ brand identity |
| **RS Financial Services** (أول مرة) / **RS** (بعدها) | الاسم الكامل كل مرة | — |
| **ملفات شركات حقيقية** | تمارين / أنشطة | قيمتنا التفضيلية |
| **هتشتغل بإيدك** | هتتعلم | التطبيق مش التعلم هو الفارق |
| **فريش / جونيور / سينيور** | طالب / متعلم | — |
| **متدرب** | طالب | — |
| **محاضر** | مدرّب / teacher | — |

---

## 🎬 قواعد خاصة بالـ Reels (1080×1920)

### الـ Safe Area
- **Top:** 220px (مكان الـ logo bug + مساحة للـ platform UI)
- **Bottom:** 420px (مكان الكابشنز + مساحة للـ platform UI — Instagram/TikTok action buttons)
- **Left:** 100px
- **Right:** 100px
- أي نص مهم **لازم** يقع جوه الـ safe area.

### الكابشنز
- **Style:** Highlighted Phrase — الكلمة الحالية بـ Accent (#FFB501) + scale 1.06x، الباقي أبيض.
- **Font:** IBM Plex Sans Arabic Bold 56px (على comp 1080×1920).
- **Max Width:** 820px (يتوسّط أفقياً).
- **Y Position:** `1420` (أسفل منتصف الشاشة، فوق الـ bottom safe area بشوية).
- **Chunk size:** 6 كلمات في الـ segment الواحد (إلا لو الجملة قصيرة).

### الـ Lower Third
- يظهر مرة واحدة في أول `0.5` ثانية، يستمر `4` ثواني، يسلد out.
- فيه اسم المحاضر (Alexandria Bold 60px أبيض) + اسم الورشة (IBM Plex Sans Arabic 38px accent).
- الباكجراوند Primary (`#10479D`).
- العرض: `640px` (اتصغّر من 820 — كان dominant بزيادة). الارتفاع: auto بـ padding.

### الـ Outro (CTA card)
- المدة: `5` ثوان (اتّزوّدت من 2.5 في Apr 2026 عشان تسع الـ CTA الكامل).
- Layout كامل من فوق لتحت:
  - **Logo** top-center، 300px، y=340
  - **Tagline** "بنحقق طموحك المحاسبي" — accent color Alexandria Bold 46px، y=640
  - **CTA Primary** "احجز ورشتك الجاية" — أبيض IBM Plex Sans Arabic Bold 68px، y=820
  - **CTA Subtext** "راسلنا على رسائل الصفحة أو زور موقعنا" — أبيض 34px مع opacity 0.9، y=930
  - **Website** `rspaac.com` — accent IBM Plex Sans Arabic Bold 60px، LTR direction، y=1110
  - **Social icons row** (y=1320، 96px each، gap 36px):
    - Instagram · Facebook · TikTok · LinkedIn · YouTube
    - SVG paths من simple-icons (CC0) في `src/components/SocialIcons.tsx`
    - كل icon في rounded-square container أبيض 8% opacity
- Cascade animation: logo (spring) → tagline → CTA primary → CTA subtext → website → icons (4-frame stagger لكل icon)
- الـ Tagline والـ CTA بالعربي دايماً. الـ website LTR.

---

## ⚠️ حالات تعارض

لو في تعارض بين الملف ده و `docs/design-system.md` → **الملف ده بيكسب**.
لو في تعارض بين الملف ده و `feedback/style_evolution.md` → **الملف ده بيكسب**.
الـ feedback بيطوّر القيم داخل الحدود اللي الملف ده بيحددها — مش بره.

---

## 📂 External Reference Material

البيانات الكاملة لـ RS (workshops, prices, full brand voice, knowledge base) **موجودة في
workspace تاني خارج الـ repo ده**. الملف ده standalone — كل اللي محتاجه لإنتاج فيديو RS موجود
هنا. لو محتاج تفاصيل أعمق:

- **RS Knowledge Base** — تفاصيل كل ورشة + الأسعار + المواعيد
- **RS Brand Voice Guidelines الكامل** — للسكريبتات الطويلة، البريد، الـ ads
- **RS Master Dataset** — كل بيانات RS

اللي محتاجه دلوقتي عشان تكتب reel — موجود فوق في الملف ده.
