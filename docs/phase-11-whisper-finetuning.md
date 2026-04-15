# Whisper Fine-Tuning Plan — Egyptian Accounting Arabic

> **Status:** Data collection only. No training yet.
>
> **Goal:** Reduce the volume of manual caption fixes Omar has to apply
> after each new lecturer video, specifically for Egyptian dialect +
> accounting terminology that the stock `large-v3` model mis-transcribes.

---

## Why we track corrections

Every reel passes through the subtitle editor before render. Omar's
edits there are the single best signal we have for **what the model
got wrong in dialect + domain**:

- Stock `large-v3` handles MSA well but wobbles on Egyptian pronunciation
  (ض ↔ د, ث ↔ س, ة/ه at word-end, إدغام, plus words that vanish into
  connected speech).
- Accounting jargon ("رؤوس حسابات", "مستنَد قبض", "ميزان المراجعة")
  appears rarely enough in training data that the model hedges.
- `fix-captions.js` already handles the most common substitutions, but
  the list is hand-curated and lags reality. It's triage, not a model.

Every correction Omar makes is **free training data** — it just needs
to land somewhere persistent. That's what this tracker does.

---

## How the tracker works

One-way data flow, zero extra effort from Omar:

```
transcribe.py  →  captions.json
                      │
                fix-captions.js (automatic substitutions)
                      │
                      ▼
           captions.raw.json    ← baseline snapshot (one-time, gitignored)
                      │
              Omar edits in subtitle editor
                      │
             Approve → POST /save/captions.json
                      │
                      ▼
           captions.json (approved)
                      │
              scripts/diff_captions.mjs
                      │   (greedy word alignment, ±0.2s timing match,
                      │    skips punctuation/diacritic-only changes)
                      ▼
       feedback/whisper_corrections.jsonl    ← aggregated, committed
```

Each JSONL line is one word-level correction:

```json
{
  "original": "المصروف",
  "corrected": "المصاريف",
  "context_before": "حساب",
  "context_after": "الفحص",
  "time_sec": 45.2,
  "project": "محمد علاء - ورشة المحاسب المالي",
  "date": "2026-04-15"
}
```

### Important properties

- **The raw snapshot is taken ONCE per video.** If phase 2 reruns, the
  baseline stays put. We compare against the first model output, not
  against Omar's half-edited state.
- **`fix-captions.js` runs before the snapshot.** The snapshot captures
  the "post-fix, pre-review" state, so the corrections we log are the
  ones the substitution map did NOT already know about. That's the
  signal worth learning.
- **Punctuation + diacritics are filtered.** The subtitle editor does
  its own punctuation normalization; those edits are UX choices, not
  dialect signal.
- **Fire-and-forget on save.** `diff_captions.mjs` runs in a detached
  child process after the HTTP save succeeds — so a broken diff cannot
  break the editor's save button.
- **Raw snapshots are gitignored.** Only the aggregated JSONL lives in
  the repo. One .captions.raw.json per video would bloat the tree.

---

## When to fine-tune (threshold)

Start a training run once **both** of the following are true:

- **≥ 500 corrections** in `whisper_corrections.jsonl`, **OR**
- **≥ 30 distinct projects** contributing corrections.

500 is low for full fine-tuning but plenty for LoRA adapter training on
a narrow dialect/domain target — and the marginal value of each
additional correction drops off fast once you have a few hundred
examples per recurring pattern.

Before training, skim the JSONL:

- If **one word accounts for > 15% of entries**, it's probably a
  pronunciation class the stock model cannot hear — good candidate.
- If most corrections are **unique one-off typos**, hold off. The model
  will memorize noise.
- If a **specific phoneme pair** dominates (ض→د, ث→س), that's the
  clearest win and the target LoRA config should upweight acoustic
  examples over text augmentation.

---

## LoRA approach (planning, not implementation)

Full fine-tuning of `large-v3` is overkill and expensive. The plan is
to train a **LoRA adapter** on the encoder + decoder attention layers
using Hugging Face PEFT.

Reference: https://huggingface.co/docs/peft/task_guides/lora_based_methods

### Rough training pipeline (when the time comes)

1. **Dataset prep**
   - Pull every `.captions.raw.json` + approved captions pair Omar
     still has on disk (plus whatever the JSONL references that we can
     reconstruct from `feedback/log.json`).
   - Re-extract the 16kHz mono wavs per project (already preprocessed).
   - Slice each wav by approved segment, pair with the approved text.
   - Output HF `Dataset` shape: `{audio: {array, sampling_rate},
     sentence: str}`.

2. **LoRA config**
   - Target modules: `q_proj`, `v_proj` on the decoder cross-attention
     + a smaller rank on the encoder self-attention.
   - `r=8`, `alpha=16`, dropout 0.05 — standard Whisper-LoRA starting
     point.
   - Freeze everything else.

3. **Training**
   - 1-3 epochs, learning rate 1e-4, cosine schedule.
   - Eval split: hold out ~10% of projects (not random segments —
     whole projects, so we measure cross-lecturer generalization).
   - Metric: WER on held-out projects. Target: beat stock large-v3 by
     ≥ 15% WER on Egyptian+accounting content while staying within
     0.5% WER of baseline on MSA.

4. **Deployment**
   - Save the LoRA adapter (~30MB).
   - `scripts/transcribe.py` loads stock large-v3 + applies the adapter
     at model init time via `peft.PeftModel.from_pretrained`.
   - Keep `fix-captions.js` as a post-pass — it handles stylistic
     normalizations the LoRA will never touch (punctuation, spacing).

5. **Monitoring**
   - Re-run `diff_captions.mjs` after every new reel. If the rate of
     logged corrections doesn't drop meaningfully after adapter
     deployment, the training data wasn't good enough and we go back
     to step 1.

---

## Non-goals for Phase 11

- No training code in this phase. Just the data pipeline.
- No dataset cleanup / augmentation UI. The JSONL is plain text; if
  Omar wants to curate it, he can open it in an editor.
- No automatic trigger. Crossing the 500/30 threshold just means
  "consider starting a fine-tune session" — it's a prompt for a human
  decision, not a cron job.
