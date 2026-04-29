import { Config } from '@remotion/cli/config';
import os from 'node:os';

// Auto-scaled to host. Defaults to (cores - 1), max 14.
// Tuned ceiling for: i7-14700K (28 threads) + RTX 5060 Ti + 32 GB DDR5.
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(Math.max(1, Math.min(14, os.cpus().length - 1)));
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('./src/index.ts');
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setOffthreadVideoCacheSizeInBytes(12 * 1024 * 1024 * 1024);
// NOTE: Remotion does not support H.264 NVENC on Windows. `if-possible` falls
// back to libx264 on CPU (the i7-14700K handles it well at concurrency=14).
Config.setHardwareAcceleration('if-possible');
