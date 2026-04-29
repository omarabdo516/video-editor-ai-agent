# Reference Library

Cumulative design knowledge extracted from external reference videos. Each entry is a single tactic worth replicating, adapting, or skipping — distilled from the deep-dive `analysis.md` files under `references/<name>/_analysis/`.

This file is the **synthesis layer**. The per-reference `analysis.md` files are the raw observations; this file is where patterns get named, tagged, and made actionable.

## How to use this file

- **Reading:** When designing a new RS Reels animation/scene/caption treatment, scan this file for relevant tactics before falling back to defaults.
- **Writing:** After Claude finishes analyzing a reference, promote 1–3 key tactics here. Don't dump every observation — only patterns that survive across multiple references or feel uniquely strong.
- **Tagging:** Each entry includes a status — `steal` / `adapt` / `study` / `avoid`.

## Entry template

```
### [Pattern name]

- **Status:** steal / adapt / study / avoid
- **Source:** references/<name>/ — t=00:NN
- **Pattern:** _(2-3 sentences describing the technique)_
- **Why it works:** _(the underlying mechanic — attention, contrast, surprise, rhythm)_
- **RS application:** _(concrete: which scene type / overlay / caption mode in our system uses this)_
- **Notes:** _(constraints, what to change for our brand, when NOT to use)_
```

---

## Captions & typography

### Caption style cycling within a single reel

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — throughout (t=0-73)
- **Pattern:** Within ONE reel, cycle through 4-6 distinct caption visual treatments — yellow handwritten hook → blue translucent pill → plain white floating → single-word pop → inline keyword highlight → number-integrated reveal. Each style appears for 1-3 seconds before swapping. The active chapter overlay above stays stable while caption styles below cycle.
- **Why it works:** Macro-stability (chapter or persistent layer doesn't change) + micro-variety (caption refreshes every 1-3s) keeps the eye engaged without cognitive overhead. A reel that uses ONE caption style throughout feels static; a reel that uses 5+ feels rich without feeling chaotic.
- **RS application:** Our current system renders ONE caption style per project (passed as `caption_style: hormozi`). Add a `caption_style: cycle` mode where the planner can mix word-pop + plain + pill within a single render. Phase 6 [animation_plan.json](../docs/phase-6-animation-planning.md) would gain a `caption_strategy` field with `cycle` rules per scene/segment.
- **Notes:** Don't mix more than 4 styles per 30-second segment. Each style must be readable on its own. The cycling rhythm should sync with audio emphasis points from [audio_energy.json](../scripts/audio_energy.py).

### Number-integrated keyword reveal

- **Status:** adapt
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=2-7 ("سنة 2026")
- **Pattern:** When a number appears in an Arabic word (year, count, ratio), render the number MASSIVELY in yellow EMBEDDED INSIDE the surrounding Arabic word. Example: "هنبدا مع بعض **س2026نة**" — the year 2026 fills the body of the word "سنة" (year), so the eye reads both simultaneously.
- **Why it works:** Forces the reader's brain to parse the integration → micro-engagement spike. The number gets unmissable visual weight while staying grammatically embedded. More elegant than just bolding the number.
- **RS application:** Add a caption variant `numberIntegrated` to the [WordCaption.tsx](../src/components/WordCaption.tsx) family. Phase 5 content_analysis.json would flag opportunities (any year/large-number reference that's contained in a word).
- **Notes:** Only works for Arabic-Indic-readable numerals (any number). Latin acronyms (IFRS 18) get the standard yellow inline-highlight treatment instead.

### Bilingual caption support (Arabic + Latin acronyms)

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=63-64 ("طبقاً ل **IFRS 18**")
- **Pattern:** Mix Arabic and Latin tokens in the same caption naturally. Latin acronyms (IFRS, CMA, FRS, ACCA) use the SAME yellow accent treatment as Arabic keywords. Both fonts coexist on the same line without awkward spacing.
- **Why it works:** Financial/technical content has English standards names (IFRS 18, FRS, GAAP). Forcing translation breaks meaning. Embracing the bilingual reality reads naturally.
- **RS application:** Verify our caption rendering pipeline ([WordCaption.tsx](../src/components/WordCaption.tsx) and Phase 6 planner) doesn't strip Latin tokens. Both fonts (Alexandria + IBM Plex Sans Arabic) include Latin subsets. Confirm the keyword-yellow rule fires for both Arabic AND Latin emphasized tokens.
- **Notes:** No special handling needed if pipeline preserves Latin. Just don't post-process captions to remove non-Arabic.

---

## Scene compositions

### Numbered chapter overlay system

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=20-66 (chapters 1-4)
- **Pattern:** Persistent top-of-frame overlay containing (a) a numbered badge in a rounded-square outline (~120px), and (b) a yellow Arabic chapter title below (with optional white subtitle). The overlay STAYS visible for the entire chapter (~7-12 seconds) while the speaker discusses the topic. Each chapter has its own number — 1, 2, 3, 4 — creating an implicit progress indicator.
- **Why it works:** Implicit progress bar = retention magic. Viewer knows "we're at 2 of 4" without explicit countdown. Numbered structure also helps memory consolidation post-watch (saving / sharing / recalling).
- **RS application:** New scene type or overlay component. Could be `chapter_overlay` element in animation_plan.json with `{number, title, subtitle?, durationSec}`. The renderer draws the badge + title + persistent visibility while body-zone captions cycle below. Compatible with our existing `<FullScreenScene>` dispatcher pattern.
- **Notes:** Keep numerals CONSISTENT (all Latin OR all Arabic-Indic — RS BRAND.md mandates Latin "الأرقام إنجليزية"). Limit to 3-5 chapters per reel; more = pacing too slow. Best for workshop / curriculum / process content.

### Two-tier chapter title (main + subtitle)

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=29 (chapter 2)
- **Pattern:** When a chapter title benefits from elaboration, use a TWO-TIER label: main title in BIG yellow bold ("بناء ادارة الحسابات"), subtitle in smaller white below ("بناء نظام الحسابات للشركات"). Visual hierarchy through size + color contrast.
- **Why it works:** Some chapters are too dense for a one-word title. Two-tier provides the headline + the elaboration without making the headline cluttered.
- **RS application:** Optional `subtitle` field on the `chapter_overlay` element. If present, render below main title in 60% size and white color.
- **Notes:** Use sparingly. Mix with single-line titles for visual variety across chapters.

### Anticipation announcement before chapter sequence

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=16-19
- **Pattern:** Before showing chapter overlays, display an ANNOUNCEMENT: "تغطية / **اربع محاور رئيسية**" (the workshop covers 4 main axes). The announcement creates an OPEN LOOP that each chapter overlay closes one-by-one.
- **Why it works:** Open loops are the most powerful retention technique in short-form content. Telling the viewer "you're about to see 4 things" makes them compelled to watch all 4.
- **RS application:** Phase 5 content analysis should detect when the workshop curriculum has 3-5 distinct axes/chapters. Phase 6 planner should add an `announcement` scene before the first chapter overlay. Announcement text: "[العدد] محاور رئيسية" or "[العدد] خطوات" with the count yellowed.
- **Notes:** Only useful for content with 3-5 enumerable items. Don't fake it for content that doesn't naturally divide.

---

## Color & atmosphere

### RS yellow accent equivalence

- **Status:** study
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — throughout
- **Pattern:** The yellow accent used in this reel (~#FFB400) is virtually IDENTICAL to RS Accent Gold (#FFB501). Used uniformly for: caption keywords, chapter titles, number highlights, title underlines, dates, acronyms.
- **Why it works:** A single accent color used consistently builds visual brand identity. Every "important thing" lights up the same way → trains viewer eye.
- **RS application:** Validates our existing [tokens.ts](../src/tokens.ts) `accent: '#FFB501'`. No change needed — but confirms the choice is in line with what RS-adjacent content already uses.
- **Notes:** Don't add a second accent color. Single-accent discipline is what makes this work.

---

## Motion & pacing

### Audio-synced visual events at ~3-4s rhythm

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — entire reel
- **Pattern:** ~25 distinct visual events (caption changes, chapter transitions, overlay appearances) in 73.8 seconds = event every ~3 seconds. Each visual event is timed to a corresponding audio emphasis moment (high-energy beat or dramatic pause).
- **Why it works:** Matches our [feedback/style_evolution.md](../feedback/style_evolution.md) target of "event every ~4s". Aligning visual changes with audio emphasis points doubles their impact — eye + ear pulse together.
- **RS application:** Verify Phase 6 planner ([docs/phase-6-animation-planning.md](../docs/phase-6-animation-planning.md)) is using [audio_energy.json](../scripts/audio_energy.py) emphasis_moments as input for visual event placement. The 1:1 mapping (audio emphasis → visual event) is the gold standard.
- **Notes:** Density of 1 event per 3s is the upper end. For longer (60s+) content, 1 per 4-5s is more comfortable.

### Smooth multi-shot edit (no hard cuts)

- **Status:** study
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — entire reel (0 scene cuts detected at threshold 0.4)
- **Pattern:** The reel uses MULTIPLE shot framings (tight close-up, medium, wide) but DISGUISES the cuts as natural conversation framing. The transitions feel like "the camera moved with the speaker" rather than discrete cuts. The result: scene-cut detection at threshold 0.4 finds zero cuts.
- **Why it works:** Smooth perceived continuity = lower cognitive load. Viewers don't get jarred by hard cuts but still get the visual variety of shot changes.
- **RS application:** Our reels are typically rendered (not multi-cam shot), so this doesn't directly apply. BUT: when we DO smart_zoom, the spring curve we use should prefer SMOOTH interpolation (we already have `smooth_glide` curve in tokens.smartZoomCurves). Avoid overusing `crash_zoom` which introduces visual jolts.
- **Notes:** Original-source pattern, not a render technique. For rendered reels, parallel pattern is "use spring-based zooms instead of cut-based shot changes."

---

## Retention tricks

### Bookend title pattern

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=4-7 (intro) and t=67-73 (outro)
- **Pattern:** Workshop title appears MASSIVE at the intro (~140px tall, full-width, yellow underline). Shrinks to a small top-right badge during chapter content (~40px, persistent). At the outro, ALL chapter overlays vanish and the title RETURNS to massive intro size — same composition as intro. Visual rhyme = bookend.
- **Why it works:** Bookends create memorability. The viewer sees the title prominently at start, lives with it shrunken during content, and sees it BIG again at the end → triple imprint. The "rhyme" with the intro creates closure.
- **RS application:** Add `outroBookend: true` flag to Phase 6 plans. When set, the outro automatically renders the workshop/chapter title at the same scale and position as the intro title card. Compatible with our existing `<Outro>` component if extended with a "match-intro" mode.
- **Notes:** Only works if the intro had a memorable title card. For reels without a strong intro title, skip the bookend — it has nothing to rhyme with.

### Build-up brand stack pattern

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=0 (1 layer) → t=8 (5 layers)
- **Pattern:** Hook frame (t=0) is INTENTIONALLY MINIMAL — only the bottom-stamp footer is visible. No top branding, no logos. The brand layers JOIN the frame gradually over the first 5-8 seconds: caption hook (t=0) → title reveal (t=3) → workshop title shrinks + company logo joins (t=8). By t=8 the full 5-layer brand stack is established.
- **Why it works:** Reels live or die in the first 2 seconds. Viewers reject reels that LOOK like ads — and a full brand stack at t=0 looks like an ad. Starting minimal feels organic / personal, then building branding once attention is captured.
- **RS application:** Phase 6 planner should default to a "minimal hook" for the first 2-3 seconds: only the captions + speaker. Logo bug + lower third + outro elements should NOT appear at t=0. They should fade in starting around t=3-5s. Modify [tokens.ts](../src/tokens.ts) `logoBug.startSec = 3` (was 0).
- **Notes:** Keep the hook frame's visual elements PURELY about the spoken hook content. No brand interference.

---

## Hooks & openings

### Yellow handwritten/cursive caption (HOOK ONLY)

- **Status:** study (not steal)
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — t=0-2
- **Pattern:** The hook caption (first 2-3 seconds) uses a SCRIPT/HANDWRITTEN Arabic font in YELLOW, distinct from the geometric bold display font used everywhere else. Creates immediate "this feels personal / hand-crafted" vibe.
- **Why it works:** Pattern interrupt — viewers see a different font feel than other reels. Plus the cursive/script suggests "letter from a friend" rather than "production studio."
- **RS application:** **Don't directly steal — RS BRAND.md restricts fonts to Alexandria + IBM Plex Sans Arabic.** BUT the underlying principle is valid: differentiate the HOOK caption visually from the body captions. Could be done within RS brand by using Alexandria SemiBold-Italic-something for the hook (if available) or by COLORING the hook caption distinctively (e.g., all-yellow throughout instead of yellow-keyword highlights).
- **Notes:** Validate any hook-caption variant against BRAND.md before adopting.

---

## Overlays & accents

### Title underline accent (yellow stroke)

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — title cards throughout (intro + outro)
- **Pattern:** Workshop title gets a YELLOW horizontal underline accent UNDER the last word ("الشامل" gets the underline, not "المحاسب"). Underline is ~20px thick, ~80% of the word width, soft rounded ends.
- **Why it works:** A subtle accent that distinguishes the title without overwhelming it. The selective placement (only under the second word) suggests intention rather than decoration.
- **RS application:** Easy to add to existing scene title compositions. Our [Outro.tsx](../src/components/Outro.tsx) and any title-card scene could gain a `titleAccent: 'underline' | 'box' | 'none'` prop.
- **Notes:** Use only on TITLE CARDS, not on captions. Captions already have keyword-yellow treatment which is enough.

### Translucent navy pill caption background

- **Status:** steal
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — multiple captions throughout
- **Pattern:** Important value-statement captions get a translucent dark-blue/navy pill background (~rgba(20,40,90,0.55), soft rounded corners). The pill EXPANDS to fit the text width. Used for "claim" captions like value props or technical statements.
- **Why it works:** Anchors the eye. Plain floating text can disappear visually if the bg has lots of contrast; a pill creates a stable reading zone. Especially useful for longer captions (5+ words).
- **RS application:** Add `WordCaptionPill.tsx` variant or extend [WordCaption.tsx](../src/components/WordCaption.tsx) with `bgVariant: 'none' | 'pill' | 'box'` prop. Use pill for captions ≥5 words; use plain for short pop-style captions.
- **Notes:** Pill color must match the BRAND. RS doesn't have dark navy in BRAND.md — would need to either pick from RS palette (#1a1a2e is close) or propose adding navy as a "caption pill background" token.

---

## Anti-patterns (avoid)

### Overlays positioned over speaker's face

- **Status:** avoid
- **Source:** Internal failure — Alex reel render 2026-04-29 (`D:/Work/RS Academy/Videos/New Alex/2.mp4`)
- **Anti-pattern:** Choosing `y_px` for an overlay using a hardcoded default (e.g. `y_px=900`) without checking where the speaker's face actually is in this specific video. Different videos have different speaker framings — a default that worked in one reel will land on the speaker's face in another.
- **Why it's bad:** The face is the most attention-grabbing element in any talking-head reel. An overlay on top of it BOTH obscures the speaker's expression AND the overlay text becomes harder to read against the moving face. Double loss. Omar called it out directly: "ساعات ال Overlays بتيجي فوق وش اللي بيتكلم ودا غلط".
- **RS application:** Phase 6 planner MUST read `face_map.json` and compute the face bounding box (top + bottom in pixels) for each overlay's time range, then pick `y_px` from the available above/below zones — never inside the face bbox. See [docs/phase-6-animation-planning.md](../docs/phase-6-animation-planning.md) Step 6.2.1 for the exact math. Same rule documented in [feedback/style_evolution.md](style_evolution.md) "Overlays — face-aware y_px positioning".
- **Notes:** Reference reels appeared to use y=900 because their speakers sat tall in frame (face top ~y=400). For a speaker sitting at a desk (face at y=800-1100), y=900 = directly on the face. The position is video-specific, not a constant.

### Inconsistent numeral systems within one reel

- **Status:** avoid
- **Source:** `references/For RS/محمد ريان - المحاسب الشامل/` — Chapters 1-3 use Latin "1"/"2"/"3", Chapter 4 uses Arabic-Indic "٤"
- **Anti-pattern:** Mixing numeral systems (Latin "1, 2, 3" then suddenly Arabic-Indic "٤") within a single reel. Looks like an editor mistake. Breaks visual consistency.
- **Why it's bad:** Even subtle inconsistency draws the eye and creates a "something's off" feeling. RS BRAND.md mandates "الأرقام إنجليزية" (English/Latin numerals). Stick to one system per reel — and across the brand, prefer Latin per BRAND.md.
- **RS application:** Brand validator should reject any plan that mixes numeral systems within the same reel. Phase 6 planner should normalize all numbers to Latin form (per [brands/rs/BRAND.md](../brands/rs/BRAND.md)).
- **Notes:** Already a known RS rule, but worth documenting as an external observation.

---

## Index of analyzed references

| Date | Reference | Status | Key patterns extracted |
|------|-----------|--------|------------------------|
| 2026-04-29 | محمد ريان - المحاسب الشامل (workshop teaser) | analyzed | Numbered chapter overlays · Caption style cycling · Bookend title · Build-up brand stack · Anticipation announcement · Audio-synced rhythm · Bilingual support · Title underline accent |
