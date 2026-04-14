import { Config } from '@remotion/cli/config';

// Tuned for: Intel i7-14700K (28 threads) + RTX 5060 Ti (16 GB) + 32 GB DDR5
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(14);
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('./src/index.ts');
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setOffthreadVideoCacheSizeInBytes(12 * 1024 * 1024 * 1024);
// NOTE: Remotion does not support H.264 NVENC on Windows. `if-possible` falls
// back to libx264 on CPU (the i7-14700K handles it well at concurrency=14).
Config.setHardwareAcceleration('if-possible');
