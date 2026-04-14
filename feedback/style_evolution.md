# Style Evolution — تفضيلات عمر التراكمية

> الملف ده بيتحدث بعد كل مشروع (Phase 9).
> Claude Code بيقراه قبل Phase 6 و Phase 7 عشان يعرف التفضيلات المتراكمة.
> **القواعد هنا لها أولوية على `docs/design-system.md`** — بس أقل أولوية من `brand/RS_BRAND.md`.

---

## ✅ حاجات بيحبها

### Highlighted word captions (Tajawal ExtraBold 56px)
- **الستايل:** Hormozi-like، active word بـ accent #FFB501 + scale 1.06x، باقي الكلمات أبيض
- **السبب:** الوضوح + التوافق مع identity + سهل القراءة في 9:16
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Logo bug top-center (بدل bottom-right)
- **السبب:** الـ reels عمودية والـ bottom فيها الكابشنز والـ platform UI
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Logo bug بيفضل ظاهر طول الفيديو (حتى أثناء الـ scenes)
- **السبب:** Brand presence أهم من نظافة الـ scene composition. Omar قال صراحة "اه لازم اللوجو يظهر" لما الـ logo كان بيختفي أثناء الـ 4 scenes.
- **الطريقة:** Logo في z-index 1000 فوق كل الـ scenes. الـ scenes لازم تسيب paddingTop ≥ 280 عشان الـ title ما يتعارضش مع الـ logo. برضه الـ brand spec (`brands/rs/BRAND.md`) اتحدّث ليعكس ده.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Scene layout — vertically centered
- **القاعدة:** كل full-screen scene لازم يبقى anchored في نص الشاشة (y ≈ 960)، مش top-anchored. استخدم flexbox centering.
- **السبب:** Omar شاف الـ first version بـ top-anchor وقال "محتاج انيميشنز احسن وخلي ال Anchor point بتاعتك في نص الشاشة بالظبط".
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Scene animations — layered motion
- **القاعدة:** كل element في scene لازم يكون عليه motions اتنين على الأقل (scale + slide, rotate + pop, opacity + glow). Bounce springs بدل fade-only. Continuous pulse glow على current/accent elements. Background shimmer/radial pulse للـ atmosphere.
- **السبب:** "محتاج انيميشنز احسن" — الـ first-pass implementations كانت basic جداً (fade + slide). Reels محتاجة motion أغنى عشان retention.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Overlays — near caption zone (y ≈ 1140)
- **القاعدة:** Keyword overlays بتعيش في الـ bottom third قريب من الكابشنز، مش في top of screen.
- **السبب:** Omar قال "خليها تحت أو فوق مكان الكابشنز أفضل" لما الـ overlays كانت عند y=280 (top). الرأي: الوش في الـ upper third، والكابشنز في bottom، وoverlays at top بتنافس الوش. خليها في نفس zone الكابشنز.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### In-caption word boost (retention rhythm pattern)
- **القاعدة:** لـ Tier 2 retention beats، ما تعملش floating element. بدل كده، boost الكلمة الـ active حالياً في الـ WordCaption نفسها: scale 1.28 + rotate -2° + glow أقوى + شدة لمدة ~0.45s.
- **السبب:** Omar جرّب الـ floating pill (WordPop) وقال "نشيله خالص أفضل ونستبدله بحاجه أذكي". الـ in-caption boost validated فوراً: "تمام احسن". السبب: الـ caption هو الـ focal point الطبيعي للمشاهد، مفيش collision، بيربط الانتباه بالكلمة اللي بتُسمع فعلاً.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Retention rhythm — target cadence 4s/event
- **القاعدة:** أي reel لازم يكون فيه event (Tier 1 أو Tier 2) كل ~4 ثواني على الأكتر. من غير كده retention بيسقط.
- **السبب:** Omar ملاحظة: "طبيعة الريلز ان مهم يكون في حاجة بتحصل كل 4 ثواني مثلا عشان المشاهد ميملش فازاي نظبط حاجة زي كدا؟" — الحل: 3-tier event system (major / micro / continuous).
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

---

## ❌ حاجات مش بيحبها

### Floating WordPop pill above captions
- **السبب:** بيتعارض مع الـ lower-third و الكابشنز في الـ 9:16 frame. بيغطي معلومات مهمة.
- **البديل:** In-caption word boost (موضّح فوق).
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Scenes top-anchored
- **السبب:** بتسيب نص الشاشة السفلي فاضي، الـ visual balance مش جميل.
- **البديل:** Vertical centering باستخدام flexbox.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Simple fade + slide animations
- **السبب:** Reels محتاجة motion أغنى. الـ fade-only بيحسس المشاهد إنها slide deck مش reel.
- **البديل:** Spring bounce + layered motion + continuous pulses.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Overlays at top of screen (y < 800)
- **السبب:** بتتنافس مع الوش للانتباه. الـ 9:16 reel هيراركيا: الوش في upper third، الكابشنز في bottom third، والـ overlays المفروض تبقى في bottom third جنب الكابشنز.
- **البديل:** y ≈ 1140 للـ default overlays.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Small overlays at y=1100-1460
- **السبب:** ده الـ zone الـ reserved للـ lower-third (1100-1280) والكابشنز (1280-1460). Small overlays هناك بتعمل collision.
- **البديل:** Body zone y=700-1090 — ده الـ zone الآمن الوحيد لـ small floating overlays في 9:16 talking head.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

---

## 📐 القيم المعدّلة

### tokens.overlays.defaultY
- **من:** 280 → **إلى:** 1140
- **التاريخ:** 2026-04-14
- **السبب:** Omar feedback "خليها تحت أو فوق مكان الكابشنز أفضل" + `feedback_overlay_position.md` memory.
- **الأثر:** كل keyword overlays بقت في الـ bottom third بدل top of screen.

### tokens.scenes (إضافة)
- **اتضاف:** `fadeInFrames: 15, fadeOutFrames: 12, titleY: 380, defaultBackground, stepCardWidth, stepCardHeight, etc.`
- **التاريخ:** 2026-04-14
- **السبب:** Phase 7 scene components محتاجة defaults مركزية.

### tokens.overlays (إضافة)
- **اتضاف:** `defaultY, defaultPaddingX/Y, defaultRadius, defaultPrimarySize, fadeFrames, slideOffsetPx`
- **التاريخ:** 2026-04-14

### tokens.springs (إضافة)
- **اتضاف:** `enter, exit, bounce, smooth` presets
- **التاريخ:** 2026-04-14
- **السبب:** Consistent animation feel عبر الـ scenes.

---

## 🏆 أفضل مشاريع

### 1. محمد ريان - ورشة الشامل (Apr 2026) — 4/5
- **Highlights:** first full pipeline run (Phase 1 → 9). Built 8 scene/overlay/micro components from scratch. Validated the 3-tier event system. Cadence 4.86s.
- **Takeaways:** Phase 7 iteration في الـ session الجاية — scenes polish + caption styles جديدة.

---

## 🧪 Experiments للمرة الجاية

### Scene polish iterations
- الـ 4 scenes الـ base شغّالة، لكن Omar قال "هنبدأ نحسن في الفترة الجاية". خلّي الـ session الجاية تبدأ بـ مراجعة الـ full render والـ iteration على كل scene على حدة.

### Caption styles جدد (5 باقي)
- Hormozi هو الوحيد اللي موجود حالياً. الخطة الأصلية 6 styles: Karaoke, Pop, Box, Typewriter, Classic.
- Omar لسه ما جربهمش — لازم نبني واحد ونعرضه عليه الأول قبل ما نبني الـ 4 الباقيين.

### Scene types جدد
- `definition` — مصطلح + تعريف + icon
- `equation` — معادلة بـ build-up animation
- `chart` — bar/pie chart بـ grow animation
- `diagram` — boxes + arrows build piece by piece
- `counter` — big number count-up

### Accent flash tuning
- حالياً الـ generator بيطلّع 0 accent_flash events. محتاج manual rule في الـ gap-fill pass يضيف الاختيار الثالث بدل الاعتماد على الـ low intensity.

### Chapter dividers
- Component لسه مش موجود. ممكن يضاف كـ Tier 1 element في الـ plan لو الفيديو طويل ومحتاج section breaks واضحة.
