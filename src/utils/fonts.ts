import { loadFont as loadTajawal } from '@remotion/google-fonts/Tajawal';
import { loadFont as loadCairo } from '@remotion/google-fonts/Cairo';

// Load all weights we actually use so Remotion caches them before render.
// `subsets: ['arabic', 'latin']` ensures Arabic glyphs are embedded.
loadTajawal('normal', {
  weights: ['400', '500', '700', '800'],
  subsets: ['arabic', 'latin'],
});

loadCairo('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['arabic', 'latin'],
});
