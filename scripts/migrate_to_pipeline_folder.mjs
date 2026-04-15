#!/usr/bin/env node
//
// Migrate a video folder from the old flat layout to the new
// _pipeline/<basename>/ + Output/ layout.
//
// Before:
//   <video-dir>/
//     <basename>.mp4
//     <basename>.1080x1920.mp4
//     <basename>.1080x1920.mp4.face_map.json
//     <basename>.1080x1920.mp4.metadata.json
//     <basename>.16k.wav
//     <basename>.16k.wav.energy.json
//     <basename>.mp4.captions.json
//     <basename>.mp4.captions.raw.json
//     <basename>.mp4.speech_rhythm.json
//     <basename>.srt
//     <basename>-reel.mp4
//
// After:
//   <video-dir>/
//     <basename>.mp4                        ← source (unchanged)
//     _pipeline/
//       <basename>/
//         scaled.1080x1920.mp4
//         scaled.1080x1920.mp4.face_map.json
//         scaled.1080x1920.mp4.metadata.json
//         audio.16k.wav
//         audio.16k.wav.energy.json
//         captions.json
//         captions.raw.json
//         speech_rhythm.json
//         captions.srt
//     Output/
//       <basename>-reel.mp4
//
// Usage:
//   node scripts/migrate_to_pipeline_folder.mjs <video.mp4> [<video.mp4> ...]
//   node scripts/migrate_to_pipeline_folder.mjs --folder <dir>    (migrate all .mp4 in dir, non-recursive)
//   node scripts/migrate_to_pipeline_folder.mjs --folder <dir> --recursive
//   node scripts/migrate_to_pipeline_folder.mjs --dry-run <video.mp4>
//
// Safe to re-run: files already in the new layout are skipped.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pendingMigrations, migrateFile, videoBasename } from '../lib/paths.mjs';

const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);

function printUsage() {
  console.log(`
migrate_to_pipeline_folder.mjs — reorganize a video folder into the
new _pipeline/ + Output/ layout.

Usage:
  node scripts/migrate_to_pipeline_folder.mjs <video.mp4> [more...]
  node scripts/migrate_to_pipeline_folder.mjs --folder <dir>
  node scripts/migrate_to_pipeline_folder.mjs --folder <dir> --recursive
  node scripts/migrate_to_pipeline_folder.mjs --dry-run [videos or --folder ...]

Examples:
  node scripts/migrate_to_pipeline_folder.mjs "D:/videos/lecture.mp4"
  node scripts/migrate_to_pipeline_folder.mjs --folder "D:/Work/.../First Bulk"
`);
}

function parseArgs(argv) {
  const args = { videos: [], folder: null, recursive: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--recursive' || a === '-r') args.recursive = true;
    else if (a === '--folder') {
      args.folder = argv[++i];
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      args.videos.push(a);
    }
  }
  return args;
}

function discoverVideos(folder, recursive) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.error(`[scan] ${dir}: ${e.message}`);
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && entry.name !== '_pipeline' && entry.name !== 'Output') {
          walk(full);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXT.has(ext)) continue;
      // Skip derived videos
      if (/\.1080x1920\./i.test(entry.name)) continue;
      if (/-reel\.mp4$/i.test(entry.name)) continue;
      found.push(full);
    }
  };
  walk(folder);
  return found.sort((a, b) => a.localeCompare(b, 'ar'));
}

function migrateOne(videoPath, { dryRun }) {
  const pending = pendingMigrations(videoPath);
  const slug = videoBasename(videoPath);

  if (pending.length === 0) {
    console.log(`✓ ${slug} — already in new layout (or nothing to migrate)`);
    return { videoPath, moved: 0, skipped: true };
  }

  console.log(`\n📦 ${slug}`);
  console.log(`   video: ${videoPath}`);
  console.log(`   ${pending.length} file(s) to move:`);
  let moved = 0;
  for (const m of pending) {
    const fromRel = path.relative(path.dirname(videoPath), m.from);
    const toRel = path.relative(path.dirname(videoPath), m.to);
    if (dryRun) {
      console.log(`     [dry-run] ${m.kind.padEnd(14)} ${fromRel} → ${toRel}`);
      continue;
    }
    try {
      const ok = migrateFile(m.from, m.to);
      if (ok) {
        console.log(`     ✓ ${m.kind.padEnd(14)} ${fromRel} → ${toRel}`);
        moved++;
      } else {
        console.log(`     ⚠ ${m.kind.padEnd(14)} skipped (target already exists?)`);
      }
    } catch (e) {
      console.error(`     ✗ ${m.kind.padEnd(14)} ${e.message}`);
    }
  }
  return { videoPath, moved, skipped: false };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.folder && args.videos.length === 0) {
    printUsage();
    process.exit(1);
  }

  let videos = [...args.videos];
  if (args.folder) {
    try {
      const s = statSync(args.folder);
      if (!s.isDirectory()) {
        console.error(`Not a directory: ${args.folder}`);
        process.exit(1);
      }
    } catch (e) {
      console.error(`Cannot read folder: ${args.folder} (${e.message})`);
      process.exit(1);
    }
    const found = discoverVideos(args.folder, args.recursive);
    console.log(`Scanning ${args.folder}${args.recursive ? ' (recursive)' : ''}: found ${found.length} video(s)`);
    videos.push(...found);
  }

  if (videos.length === 0) {
    console.log('No videos found to migrate.');
    return;
  }

  if (args.dryRun) {
    console.log('\n🟡 DRY RUN — no files will be moved.\n');
  }

  const results = videos.map((v) => migrateOne(v, { dryRun: args.dryRun }));

  const totalMoved = results.reduce((s, r) => s + r.moved, 0);
  const skipped = results.filter((r) => r.skipped).length;

  console.log(`\n─────────────────────────────────────`);
  console.log(`Done. Videos scanned: ${results.length}`);
  console.log(`  - Already migrated: ${skipped}`);
  console.log(`  - Files moved:      ${totalMoved}`);
  if (args.dryRun) console.log('  (dry-run — nothing was actually moved)');
}

main();
