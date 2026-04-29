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

### Overlays — body zone (y ≈ 900), no background card
- **القاعدة (المحدّثة 2026-04-15):** Keyword overlays بتعيش في الـ body zone عند y=900 (فوق الـ lower-third/captions). **مفيش background pill** — الـ text بيعوم مباشرة مع layered drop shadow قوي (4 طبقات: 3 سوداء + 1 gold halo).
- **السبب:** اتجربت قيمة y=1140 في ريل "محمد علاء - ورشة المحاسب المالي" — Omar قال "الباكجراوند بتاعها مغطي علي التيسكت": الـ dark pill card (rgba 0.85) كان بيغطي على الكابشنز اللي تحته، وy=1140 بيتداخل مع caption zone (1280-1460). الحل: نقل لـ y=900 (body zone) + إزالة الـ card كلياً.
- **المصدر (تاريخياً):** "محمد ريان - ورشة الشامل" (Apr 2026) — كانت y=1140 مع pill
- **المصدر (المحدث):** "محمد علاء - ورشة المحاسب المالي" (2026-04-15) — y=900 بلا card

### In-caption word boost (retention rhythm pattern)
- **القاعدة:** لـ Tier 2 retention beats، ما تعملش floating element. بدل كده، boost الكلمة الـ active حالياً في الـ WordCaption نفسها: scale 1.28 + rotate -2° + glow أقوى + شدة لمدة ~0.45s.
- **السبب:** Omar جرّب الـ floating pill (WordPop) وقال "نشيله خالص أفضل ونستبدله بحاجه أذكي". الـ in-caption boost validated فوراً: "تمام احسن". السبب: الـ caption هو الـ focal point الطبيعي للمشاهد، مفيش collision، بيربط الانتباه بالكلمة اللي بتُسمع فعلاً.
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Retention rhythm — target cadence 4s/event
- **القاعدة:** أي reel لازم يكون فيه event (Tier 1 أو Tier 2) كل ~4 ثواني على الأكتر. من غير كده retention بيسقط.
- **السبب:** Omar ملاحظة: "طبيعة الريلز ان مهم يكون في حاجة بتحصل كل 4 ثواني مثلا عشان المشاهد ميملش فازاي نظبط حاجة زي كدا؟" — الحل: 3-tier event system (major / micro / continuous).
- **المصدر:** "محمد ريان - ورشة الشامل" (Apr 2026)

### Single caption style per reel (unless explicitly asked)
- **القاعدة:** استخدم `caption_style` واحد طول الريل. ما تحطّش `caption_style_ranges` إلا لما Omar يطلب صراحةً "غيّر الـ style جوه الفيديو".
- **السبب:** Omar جرّب mixed styles (typewriter/box/karaoke/pop/classic/hormozi على نفس الريل) وقال "لا خلتها مزعجة خلينا بستايل واحد أفضل". الـ mixing بيعمل noise للمشاهد — كل ما الـ renderer يتغير، دماغه لازم تعيد الـ parse للـ visual، وده بيبعد الانتباه عن المحتوى.
- **نقطة مهمة:** لما Omar قال "استخدم أكتر من استايل بذكاء" أول المشروع، كان يقصد الـ scenes والـ overlays والـ animations — مش الـ caption renderer نفسه. الكابشن هو الـ constant اللي المشاهد بيركز عليه، فأي تغيير فيه بيبقى mini-disruption.
- **الاستثناء الوحيد:** لو Omar طلب صراحةً mixing (مش variety عامة).
- **Default:** `hormozi` (الـ proven baseline).
- **المصدر:** "المحاسب الشامل - محمد ريان - اسئلة ما بعد المحاضرة" (Apr 2026)

### Leading black frames must be trimmed in Phase 1
- **القاعدة:** الـ `prepareVideo` في `rs-reels.mjs` لازم يكشف الـ leading black في أول 3 ثواني من الـ source ويقصّه باستخدام `-ss <black_end>` قبل `-i` في الـ ffmpeg command. الـ audio extraction لازم يحصل من الـ scaled video بعد الـ trim مش من الـ source، عشان الـ captions والـ energy والـ face_map يفضلوا متزامنين مع الـ trimmed visual.
- **السبب:** Omar لاحظ إن الفيديو بيفتح على frame أسود (common في camera recordings — sensor warm-up). blackdetect بيأكد إن الـ source MP4 بيبدأ بـ 1-2 frame أسود. لو ما اتقصّش، الريل بيبدأ بلحظة سوداء قبل الـ content.
- **الأثر:** الفيديوهات اللي اتبنى لها `.1080x1920.mp4` قبل April 14 مش هتتأثر (cache). الفيديوهات الجديدة بس.
- **المصدر:** "المحاسب الشامل - محمد ريان - اسئلة ما بعد المحاضرة" (Apr 2026)

### Scene components must avoid layout-breaking wrappers
- **القاعدة:** ما تغلّفش flex children بـ `<Trail>` من `@remotion/motion-blur` — الـ Trail بتكسر الـ flex sizing فالـ child بياخد zero height ويطلع على top الـ container بدل ما يتوسّط. نفس المبدأ ينطبق على أي wrapper بيعمل `position: absolute` internally (motion-blur ghosts, ribbons, إلخ). لو محتاج motion effect زي ده، اعمل absolute positioning for the whole scene body بدل flex + wrapper.
- **السبب:** BigMetaphorScene v1 كان بيغلّف الـ headline في `<Trail>` داخل flex column centered. النتيجة: الـ headline طلع على top الـ frame ومقتطع بدل ما يتوسّط. الـ fix: استبدلنا الـ flex layout بـ absolute positioning بإحداثيات واضحة (y=900 للـ headline، y=1120 للـ subline، y=1560 للـ footer).
- **Pattern عام:** أي scene component لو المحتوى كبير ومحدد الأماكن (headline + subline + footer)، الـ absolute positioning أكتر predictable من flex + wrappers.
- **المصدر:** "المحاسب الشامل - محمد ريان - اسئلة ما بعد المحاضرة" (Apr 2026)

### Timeline labels need their own wider container (not nodeSize)
- **القاعدة:** في `ProcessTimelineScene`، الـ label container لازم يبقى أوسع من الـ node (width ≥ `nodeSize + gap - 20`) ومركّز على الـ node. ما تستخدمش `whiteSpace: nowrap` مع `width: nodeSize` — Arabic labels عادةً 3-4x أعرض من الـ node.
- **السبب:** v1 كان بـ gap=90, label width=nodeSize=120, whiteSpace:nowrap. النتيجة: "ميزان مراجعة" ~350px عرض، overflow الـ container، وبتتعارض مع الـ labels المجاورة.
- **v2:** gap=230, labelSlotWidth=nodeSize+gap-20=330, labels absolute positioned وسط كل node بشكل مستقل عن الـ node itself.
- **المصدر:** "المحاسب الشامل - محمد ريان - اسئلة ما بعد المحاضرة" (Apr 2026)

### Outro = CTA card, not just a logo flash (5s duration)
- **القاعدة:** الـ outro مش مجرد logo + tagline — ده آخر لحظة قبل ما المشاهد يسكيب، ولازم يحمل CTA واضح + social presence + website. الـ layout الرسمي دلوقتي: logo (y=340) → tagline (y=640) → CTA primary "احجز ورشتك الجاية" (y=820) → CTA subtext "راسلنا على رسائل الصفحة أو زور موقعنا" (y=930) → website rspaac.com بـ accent كبير (y=1110) → social icons row (y=1320): Instagram · Facebook · TikTok · LinkedIn · YouTube. الـ duration = 5s مع staggered cascade.
- **السبب:** Omar طلب صراحةً "محتاج اضيف في الفوتر ايكونز [الخمسة] وفوقيها لينك الويبسايت بتاعنا rspaac.com وكمان نضيف CTA ان المتدرب يقدر يحجز من خلال تواصل عبر رسائل الصفحة مباشرةً او من خلال موقعنا الالكتروني". الـ 2.5s outro القديم كان بيحرق آخر ثواني من الريل من غير conversion path.
- **الـ social icons:** inline SVG paths من simple-icons (CC0). موجودين في `src/components/SocialIcons.tsx` مع platform map. ما فيش PNG assets — الـ SVG بيرسم بـ fill color من الـ tokens.
- **المصدر:** "المحاسب الشامل محمد ريان - من فعاليات المحاضرة" (Apr 2026)

### Subtitle editor: Approve writes directly to disk via POST (no Downloads roundtrip)
- **القاعدة:** الـ Approve button في الـ editor بيعمل POST للـ JSON + SRT مباشرة على الـ rs-reels HTTP server (routes: `POST /save/captions.json` + `POST /save/captions.srt`)، والـ server بيكتب الملفات جنب الفيديو مباشرة. الـ editor بيقرا `?saveBase=...` من الـ URL params ويستخدمه — لو مش موجود (لو Omar فتح الـ editor standalone)، بيرجع للـ download fallback.
- **السبب:** Omar: "هل نقدر لما ادوس Approve ينزلو في مكان تقرأهم Automatic بسرعة عشان نسرع العملية؟" — الـ download → Downloads → manual-copy round trip كان بيبطّأ كل run.
- **الملفات:** `rs-reels.mjs startFileServer` يقبل `savePaths` object الآن (optional). `runEdit` يبني `savePaths = { '/save/captions.json': jsonDestPath, '/save/captions.srt': srtDestPath }` ويبعت `saveBase` في الـ URL. `Toolbar.handleApprove` يعمل Promise.all على الـ fetch POSTs.
- **المصدر:** "المحاسب الشامل محمد ريان - من فعاليات المحاضرة" (Apr 2026)

### Single big zoom على الريلز القصيرة < 90s لما الـ face confidence غير مستقر
- **القاعدة:** لما الريل أقصر من 90s والـ face_map فيه no-face gaps (زي drift / blur / head turns)، الأفضل نختار **big zoom واحد** بس على الـ highest-impact moment بدل ما نحاول نلاقي اتنين بـ 30s spacing. Phase 6.5 mini zooms بيملوا الـ retention gap بالـ 1.08x subtle zooms.
- **السبب:** في فيديو "من فعاليات المحاضرة" (85s)، حاولت أحط zoom_1 at 14.5s ("طول ما الشركة عايشة") و zoom_2 at 46s (reveal moment). لكن face conf في نافذة 46-49.5 كانت 0.41 (أقل من 0.5 min). النقل لـ 36.5-40 (conf 0.76) كسر الـ 30s spacing مع zoom_1. الحل: drop zoom_1، keep single zoom على الـ reveal. mini zooms ملوا الفجوات.
- **Phase 6 hint:** قبل ما تخطط zooms، اعمل sweep للـ face conf على الـ candidate windows. لو أكتر من نافذة واحدة بتكسر الـ 0.5 min أو الـ 30s spacing، اقبل zoom واحد + اعتمد على mini zooms.
- **المصدر:** "المحاسب الشامل محمد ريان - من فعاليات المحاضرة" (Apr 2026)

### Scene count is content-driven + 15s min spacing (not 45s)
- **القاعدة:** عدد الـ full-screen scenes = كل الـ high/medium key_moments اللي تحترم الـ **15s** min spacing. مفيش cap ثابت زي "4-5 max".
- **الـ spacing اتغير:** من 45s → **15s** لأن معظم الريلز 60-90s، والـ 45s كان بيسيب scene واحد بس في الدقيقة اللي بيخلي المشاهد يمل.
- **السبب:**
  - "لأ انا مش عايز limit 4-5 scenes انا عايز حسب وضع الفيديو لو محتاج أكتر يبقي نضيف أكتر عادي"
  - "45s دا كتير أوي بما ان معظم الفيديوهات بتكون دقيقة ل دقيقة ونص عايزها مثلا 15 ثانية عشان نكسر الملل"
- **الأثر:** phase-6 selection loop لازم يختار greedily لحد ما يخلص key_moments اللي تحترم الـ 15s. فيديو 90s هيبقى فيه 5-6 scenes بدل 1-2. الـ smart zoom (30s) والـ overlay (20s) spacing مفيش تغيير فيهم — فقط scene.
- **Scene duration:** برضه اتغير من 5-10s → 5-8s عشان يناسب الـ reels القصيرة.
- **المصدر:** "محمد ريان - ورشة الشامل" follow-up (Apr 2026)

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

### 2. محمد علاء - ورشة المحاسب المالي (Apr 15, 2026) — 3.6/5
- **Highlights:** first reel on the full Phase 10 feature set (entrance/exit variety + motion backgrounds + dynamic font + progress bar + SFX). 5 scenes, 3 zooms, 3 overlays, 23 micro events. Content: tax-examination journal entries (809k → 722k paid → 87k remaining liability).
- **First-pass issues flagged:** (1) progress bar at y=210 felt wrong — Omar wanted bottom edge. (2) overlay pill background covered caption text underneath. (3) SFX distracting.
- **Fixes applied same session:** progress bar → bottom=25, overlays → floating text at y=900 without card, SFX → disabled by default.

### 3. أحمد عاشور - تحليل مالي (Apr 15, 2026) — 3/5
- **Highlights:** First Bulk batch — first video processed via Dashboard workflow. 5 scenes, 2 zooms, 3 overlays, 13 micro events (11 word_pop + 2 caption_underline), 18 total. 142s duration.
- **Omar feedback:** "حاسس ان الموضوع بقي مكرر ومحتاج اضيف Overlays أكتر بتنوع أكتر في الفيديوهات الجاية"
- **Takeaway:** الـ overlay types الحالية (keyword highlight + stamp) مش كفاية للـ content farming — محتاج expand الـ overlay palette (stat callouts, quote boxes, icon badges, comparison cards, etc.) عشان كل ريل يحس مختلف. برضه الـ scene/overlay selection في Phase 6 لازم يتجنب الـ repetitive patterns بين reels في نفس الـ batch.

---

## 📐 القيم المعدّلة

### tokens.overlays.defaultY (1140 → 900)
- **القيمة القديمة:** 1140 (near caption zone)
- **القيمة الجديدة:** 900 (body zone, above lower-third)
- **السبب:** Omar: "الباكجراوند بتاعها مغطي علي التيسكت" — y=1140 بيتداخل مع caption zone 1280-1460
- **التاريخ:** 2026-04-15
- **المصدر:** "محمد علاء - ورشة المحاسب المالي"

### tokens.sfx.enabled (true → false)
- **القيمة القديمة:** true
- **القيمة الجديدة:** false (default off, per-project opt-in)
- **السبب:** Omar: "شيل ال SFX خالص حاسسها مزعجة" — حتى على 12-20% volumes، noise + sine bursts حسها ميكانيكية وبتشتت
- **التاريخ:** 2026-04-15
- **المصدر:** "محمد علاء - ورشة المحاسب المالي"

### ProgressBar position (top safe area → bottom edge)
- **القيمة القديمة:** `top: 210` (تحت الـ logo bug)
- **القيمة الجديدة:** `bottom: 25` (25px من أسفل الـ 1920 comp)
- **السبب:** Omar: "محتاج ال Progress bar تحت خالص" — convention الـ video players هي الـ bottom bar، مش top
- **التاريخ:** 2026-04-15
- **المصدر:** "محمد علاء - ورشة المحاسب المالي"

### KeywordHighlightOverlay — removed background card
- **القديم:** `background: rgba(13,31,60,0.85)` + `backdropFilter: blur(10px)` + `border: 2px solid rgba(255,181,1,0.35)` + heavy boxShadow
- **الجديد:** مفيش background/border/shadow — الـ text بيعوم مباشرة مع 4-layer textShadow (3 black + 1 gold halo)
- **السبب:** نفس feedback الـ overlay background — الـ pill كان بيغطي على اللي تحته
- **التاريخ:** 2026-04-15
- **المصدر:** "محمد علاء - ورشة المحاسب المالي"

### tokens.lowerThird — narrower bar + auto-height padding
- **القديم:** barWidth=820, barHeight=180 (fixed), nameSize=72, titleSize=44, padding '0 32px'
- **الجديد:** barWidth=640, auto height via padding (barPaddingV=28, barPaddingH=48), nameSize=60, titleSize=38
- **السبب:** Omar: "العرض كبير والطول ممكن الكلام يخبط في سقف المستطيل" — الـ 820px bar كان بياخد 76% من العرض وطويل. الـ fixed height 180 كان بيزنق الكلام الطويل. Auto-padding بيخلي المستطيل يتمدد حسب المحتوى
- **التاريخ:** 2026-04-16
- **المصدر:** "أحمد علي - ورشة خبير الضرايب"

### tokens.overlays.defaultY (900 → 1080)
- **القيمة القديمة:** 900 (body zone — far from captions)
- **القيمة الجديدة:** 1080 (~240px فوق الكابشن عند y=1420 بعد حساب ارتفاع الـ overlay ~100px)
- **السبب (تطور):** y=900 كان بعيد (520px gap). أول iteration جرّبت 1200 — Omar: "لسه لازقين في بعض". الحل النهائي 1080: margin كافي بين overlay والكابشن. الـ lower-third (y=1100) بيخلص عند 4.5s، والـ overlays بتبدأ من 15s+
- **التاريخ:** 2026-04-16
- **المصدر:** "أحمد علي - ورشة خبير الضرايب"

### KeywordHighlightOverlay — subtle accent underline
- **الجديد:** gradient gold underline تحت الـ primary text (3px، 70% opacity، left/right 15% inset)
- **السبب:** Omar: "نظبط شكل ال Overlay أفضل من كدا" — الـ floating text بدون card كان plain بزيادة
- **التاريخ:** 2026-04-16
- **المصدر:** "أحمد علي - ورشة خبير الضرايب"

### Scenes — vertical layout preferred for long Arabic labels
- **القاعدة:** لما الـ labels عربية وطويلة (زي أسماء نماذج/إقرارات)، استخدم `process_stepper` (عمودي) بدل `process_timeline` (أفقي). الأفقي بيخلي الـ labels تتداخل في 1080px.
- **السبب:** Omar: "مش لازم كل حاجة تتعرض بالعرض ممكن تتعرض بالطول بردو عادي" + الـ timeline scene كانت الـ node circles بتـ overflow بالنص الطويل
- **التاريخ:** 2026-04-16
- **المصدر:** "أحمد علي - ورشة خبير الضرايب"

### Overlays — face-aware y_px positioning (إجباري)
- **القاعدة:** كل overlay y_px لازم يتحسب من face_map.json — مش default ثابت. الـ planner يقرا الـ face bounding box في الـ time range بتاع الـ overlay، ويختار y_px في زون فاضي (above face أو below face)، **مش جوّاه**.
- **الـ math**:
  - face_top_px = (min(face_center_y) - max(face_height)/2) × 1920
  - face_bottom_px = (max(face_center_y) + max(face_height)/2) × 1920
  - Above zone: `[220, face_top_px - 80]` — اختار لو room ≥ 200px
  - Below zone: `[face_bottom_px + 80, 1500]` — اختار لو room ≥ 200px
  - لو الزونتين tight، اختار اللي أبعد عن face center
- **السبب:** Omar: "في مشكلة ان ساعات ال Overlays بتيجي فوق وش اللي بيتكلم ودا غلط محتاجه يختار مكان مناسب". 2026-04-29 render للـ Alex reel: الـ speaker face في y=759-1128 (قاعد على مكتب)، وأنا (Claude) حطّيت y_px=900 على الـ overlays بناء على default من reel سابق فيه speaker face عالي. النتيجة: "6-6-2026" + "نقابة المهندسين" نزلوا على وش المتكلم.
- **Edge cases:**
  - لو `no_face_percentage > 30%` في time range الـ overlay → fallback default y=900
  - لو الـ face range > 200px → استخدم MIN top + MAX bottom للحساب
  - لو لازم top zone (مثلاً bookend title)، احفظ على top بس قلّل الـ primary_size لو room ضيق
- **التاريخ:** 2026-04-29
- **المصدر:** الـ Alex reel (D:/Work/RS Academy/Videos/New Alex/2.mp4) — render أول كان فيه عيب overlay-on-face

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

### Overlay variety expansion (أولوية عالية)
- الـ overlay types الحالية 2 بس (KeywordHighlight + Stamp). على scale، كل ريل بيحس نفس الشكل.
- **مطلوب:** stat callout (رقم كبير + label)، quote box (اقتباس مهم)، icon badge (✓/✗/⚠ مع نص قصير)، comparison mini-card (قبل/بعد)، list peek (2-3 bullet points quick flash).
- **السبب:** Omar بعد أحمد عاشور: "حاسس ان الموضوع بقي مكرر ومحتاج اضيف Overlays أكتر بتنوع أكتر"
- **المصدر:** "أحمد عاشور - تحليل مالي" (Apr 2026) — 3/5

### Accent flash tuning
- حالياً الـ generator بيطلّع 0 accent_flash events. محتاج manual rule في الـ gap-fill pass يضيف الاختيار الثالث بدل الاعتماد على الـ low intensity.

### Chapter dividers
- Component لسه مش موجود. ممكن يضاف كـ Tier 1 element في الـ plan لو الفيديو طويل ومحتاج section breaks واضحة.
