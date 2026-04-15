# Performance Insights

> **Source of truth:** [`performance_data.json`](performance_data.json) — every `rs-reels.mjs performance` call appends one entry.
>
> **How Phase 6 uses this file:** at the start of Phase 6 planning, Claude Code reads this file and tailors animation-plan decisions to observed patterns (hook type, visual pacing, caption variant, scene count). Patterns require ≥3 data points to be trustworthy — below that, insights stay marked "(not enough data)".

## Last updated
_(no data yet — run `node rs-reels.mjs performance <video> --views N ...` after publishing)_

## Measured reels
**0**

---

## Patterns

### Hook
_(not enough data — need ≥3 reels)_

### Caption style
_(not enough data — need ≥3 reels)_

### Visual pacing
_(not enough data — need ≥3 reels)_

### Scene complexity
_(not enough data — need ≥3 reels)_

### Audio layer (SFX + BGM)
_(not enough data — need ≥3 reels)_

---

## How to record a new measurement

Wait at least 24 hours after publishing. Then:

```bash
node rs-reels.mjs performance "<project_name_or_video_basename>" \
  --views 12500 \
  --reach 18000 \
  --saves 95 \
  --shares 22 \
  --retention 0.65 \
  --drop-off 22 \
  --platform instagram
```

Optional flags:
- `--platform`: `instagram` | `tiktok` | `youtube_shorts` (default: `instagram`)
- `--notes "free-text notes"`: anecdotal observations
- `--posted-date 2026-04-20`: override the auto-set posted date (default: today)

The command appends a new entry to `performance_data.json` with the metrics
plus a snapshot of the reel details (duration, scene count, zoom count,
caption style, SFX/music enabled) pulled from the project's
`animation_plan.json`.

Once you have ≥3 entries, ask Claude Code to re-read this file and update
the Patterns section above.
