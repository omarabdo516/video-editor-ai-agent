import { staticFile } from 'remotion';
import { continueRender, delayRender } from 'remotion';

/**
 * Load Cairo + Tajawal from local woff2 files (public/fonts/).
 * This replaces @remotion/google-fonts to work offline (no DNS needed).
 *
 * Cairo is a variable font — one file covers all weights (400-800).
 * Tajawal is static — separate files per weight.
 */

const fontFaces = [
  // ─── Cairo (variable, all weights) ──────────────────────────
  {
    family: 'Cairo',
    weight: '100 900',
    style: 'normal',
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC',
    src: staticFile('fonts/Cairo-arabic.woff2'),
  },
  {
    family: 'Cairo',
    weight: '100 900',
    style: 'normal',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    src: staticFile('fonts/Cairo-latin.woff2'),
  },

  // ─── Tajawal 400 ────────────────────────────────────────────
  {
    family: 'Tajawal',
    weight: '400',
    style: 'normal',
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC',
    src: staticFile('fonts/Tajawal-Regular-arabic.woff2'),
  },
  {
    family: 'Tajawal',
    weight: '400',
    style: 'normal',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    src: staticFile('fonts/Tajawal-Regular-latin.woff2'),
  },

  // ─── Tajawal 500 ────────────────────────────────────────────
  {
    family: 'Tajawal',
    weight: '500',
    style: 'normal',
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC',
    src: staticFile('fonts/Tajawal-Medium-arabic.woff2'),
  },
  {
    family: 'Tajawal',
    weight: '500',
    style: 'normal',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    src: staticFile('fonts/Tajawal-Medium-latin.woff2'),
  },

  // ─── Tajawal 700 ────────────────────────────────────────────
  {
    family: 'Tajawal',
    weight: '700',
    style: 'normal',
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC',
    src: staticFile('fonts/Tajawal-Bold-arabic.woff2'),
  },
  {
    family: 'Tajawal',
    weight: '700',
    style: 'normal',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    src: staticFile('fonts/Tajawal-Bold-latin.woff2'),
  },

  // ─── Tajawal 800 ────────────────────────────────────────────
  {
    family: 'Tajawal',
    weight: '800',
    style: 'normal',
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC',
    src: staticFile('fonts/Tajawal-ExtraBold-arabic.woff2'),
  },
  {
    family: 'Tajawal',
    weight: '800',
    style: 'normal',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    src: staticFile('fonts/Tajawal-ExtraBold-latin.woff2'),
  },
];

// Register all @font-face rules and wait for them to load before rendering.
const waitForFonts = delayRender('Loading local fonts');

if (typeof document !== 'undefined') {
  try {
    const promises = fontFaces.map((f) => {
      const face = new FontFace(f.family, `url('${f.src}') format('woff2')`, {
        weight: f.weight,
        style: f.style,
        unicodeRange: f.unicodeRange,
      });
      document.fonts.add(face);
      return face.load();
    });

    Promise.all(promises)
      .then(() => continueRender(waitForFonts))
      .catch((err) => {
        console.error('Font loading failed:', err);
        continueRender(waitForFonts);
      });
  } catch (err) {
    console.error('Font setup failed:', err);
    continueRender(waitForFonts);
  }
} else {
  continueRender(waitForFonts);
}
