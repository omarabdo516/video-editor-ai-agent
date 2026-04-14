export const tokens = {
  comp: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  colors: {
    primary: '#10479D',
    accent: '#FFB501',
    dark: '#0D1F3C',
    white: '#FFFFFF',
    overlay: 'rgba(13, 31, 60, 0.85)',
  },
  fonts: {
    heading: 'Cairo',
    body: 'Tajawal',
    headingWeight: 700,
    bodyWeight: 800,
  },
  captions: {
    fontSize: 56,
    lineHeight: 1.35,
    maxWidth: 820,
    position: { x: 540, y: 1420 },
    wordsPerChunk: 6,
    activeColor: '#FFB501',
    inactiveColor: '#FFFFFF',
  },
  logoBug: {
    position: { x: 540, y: 143 },
    width: 170,
    opacity: 0.9,
  },
  lowerThird: {
    durationSec: 4,
    startDelaySec: 0.5,
    slideDurationSec: 0.4,
    y: 1100,
    nameSize: 72,
    titleSize: 44,
    barWidth: 820,
    barHeight: 180,
  },
  outro: {
    durationSec: 2.5,
    logoWidth: 420,
    tagline: 'بنحقق طموحاتك المحاسبية',
    taglineSize: 56,
  },
  springs: {
    enter: { damping: 20, stiffness: 100, mass: 1.0 },
    exit: { damping: 25, stiffness: 120, mass: 0.8 },
    bounce: { damping: 12, stiffness: 150, mass: 1.0 },
    smooth: { damping: 30, stiffness: 80, mass: 1.2 },
  },
  scenes: {
    // Default fade transitions for full-screen scenes
    fadeInFrames: 15,
    fadeOutFrames: 12,
    // Where the scene title sits (from top of comp)
    titleY: 380,
    titleDefaultSize: 76,
    // Padding from edges of safe area
    safePaddingX: 100,
    safePaddingY: 220,
    // Defaults for backgrounds when scene.background is missing
    defaultBackground: 'linear-gradient(135deg, #0D1F3C 0%, #10479D 100%)',
    // Step card defaults (process_stepper)
    stepCardWidth: 760,
    stepCardHeight: 200,
    stepCardGap: 32,
    stepCardRadius: 24,
    stepCardLabelSize: 64,
    stepCardNumberSize: 80,
    // Timeline defaults (process_timeline)
    timelineNodeSize: 120,
    timelineLabelSize: 44,
    timelineConnectorThickness: 6,
  },
  overlays: {
    // Overlays live in the bottom third near the captions (which sit at
    // y=1280-1460 with current tokens). Default y puts the overlay just
    // above the caption text — feedback: keyword overlays must NOT compete
    // with the lecturer's face at the top of the frame.
    defaultY: 1140,
    defaultPaddingX: 36,
    defaultPaddingY: 20,
    defaultRadius: 12,
    defaultPrimarySize: 64,
    defaultSecondarySize: 32,
    fadeFrames: 8,
    slideOffsetPx: 24,
  },
} as const;
