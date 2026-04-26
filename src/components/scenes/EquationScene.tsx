import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { tokens, getStaggerDelay } from '../../tokens';
import type { Scene, EquationElement, EquationTerm } from '../../types';

// Horizontal connector line under the equation row, drawn with evolvePath.
// 860 wide, centered in its svg (viewBox shifts to keep stroke + glow in frame).
const CONNECTOR_PATH = 'M 0 0 L 860 0';

type Props = { scene: Scene };

/**
 * EquationScene â€” left-to-right equation builder. Tokens appear one-by-one
 * with a bounce, operators fade in between them. The "result" token gets
 * a special treatment: pop scale + accent glow pulse.
 *
 * Supports any equation shape: "A = B + C", "Ø§Ù„Ø±Ø¨Ø­ = Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯ - Ø§Ù„ØªÙƒÙ„ÙØ©",
 * "Ø£ØµÙ„ = Ø®ØµÙˆÙ… + Ø­Ù‚ÙˆÙ‚ Ø§Ù„Ù…Ù„ÙƒÙŠØ©"
 */
export const EquationScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const el = scene.elements.find(
    (e): e is EquationElement => e.type === 'equation',
  );
  if (!el) return null;

  const titleProgress = spring({ frame, fps, config: tokens.springs.bounce });
  const bgPulse = (Math.sin(frame * 0.05) + 1) / 2;

  // Dynamic term stagger â€” Phase 10 Round A. Equations with 3 tokens get
  // wide spacing (feels deliberate); 5+ tokens tighten so the reveal
  // doesn't drag past the scene budget.
  const TERM_STAGGER = getStaggerDelay(el.terms.length);
  // Title takes 15 frames before terms start
  const TERM_BASE_DELAY = 15;

  // Connector line draws in starting with the first term, finishing around
  // when the last term lands â€” visually "stitches" the equation together.
  const connectorStartFrame = TERM_BASE_DELAY + 4;
  const connectorEndFrame =
    TERM_BASE_DELAY + Math.max(1, el.terms.length) * TERM_STAGGER + 8;
  const connectorProgress = interpolate(
    frame,
    [connectorStartFrame, connectorEndFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const connectorEvolve = evolvePath(connectorProgress, CONNECTOR_PATH);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280,
        paddingBottom: 80,
        gap: 60,
      }}
    >
      {/* Background atmosphere */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,181,1,${0.06 + bgPulse * 0.05}) 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Title */}
      {el.title && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 700,
            fontSize: 64,
            color: tokens.colors.white,
            textAlign: 'center',
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 24}px) scale(${0.9 + titleProgress * 0.1})`,
            letterSpacing: '-1px',
            textShadow: '0 2px 14px rgba(0,0,0,0.5)',
            margin: 0,
            padding: '0 60px',
            lineHeight: 1.1,
          }}
        >
          {el.title}
        </div>
      )}

      {/* Equation row â€” LTR layout for math even though UI is RTL.
          Wrapped in a relative container so the animated connector line (SVG
          drawn with evolvePath) can sit behind the terms as a "number-line". */}
      <div
        style={{
          position: 'relative',
          direction: 'ltr',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          flexWrap: 'wrap',
          maxWidth: 900,
          padding: '0 40px',
        }}
      >
        {/* Accent connector â€” draws left-to-right as terms land. Sits behind
            the text (zIndex 0) with a glow filter for brand feel. */}
        <svg
          width={860}
          height={20}
          viewBox="-10 -10 880 20"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -28,
            transform: 'translateX(-50%)',
            overflow: 'visible',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 14px rgba(255,181,1,0.55))',
            zIndex: 0,
          }}
        >
          <path
            d={CONNECTOR_PATH}
            stroke={tokens.colors.accent}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={connectorEvolve.strokeDasharray}
            strokeDashoffset={connectorEvolve.strokeDashoffset}
          />
        </svg>
        {el.terms.map((term, idx) => (
          <EquationTermView
            key={idx}
            term={term}
            frame={frame}
            fps={fps}
            delayFrame={TERM_BASE_DELAY + idx * TERM_STAGGER}
          />
        ))}
      </div>

      {/* Footer */}
      {el.footer && (() => {
        const footerDelay = TERM_BASE_DELAY + el.terms.length * TERM_STAGGER + 16;
        const footerProgress = spring({
          frame: Math.max(0, frame - footerDelay),
          fps,
          config: tokens.springs.enter,
        });
        return (
          <div
            style={{
              fontFamily: tokens.fonts.heading,
              fontWeight: 500,
              fontSize: 36,
              color: 'rgba(255,255,255,0.85)',
              textAlign: 'center',
              opacity: footerProgress,
              transform: `translateY(${(1 - footerProgress) * 14}px)`,
              padding: '0 80px',
              lineHeight: 1.3,
            }}
          >
            {el.footer}
          </div>
        );
      })()}
    </div>
  );
};

const EquationTermView: React.FC<{
  term: EquationTerm;
  frame: number;
  fps: number;
  delayFrame: number;
}> = ({ term, frame, fps, delayFrame }) => {
  const localFrame = Math.max(0, frame - delayFrame);
  const progress = spring({
    frame: localFrame,
    fps,
    config: tokens.springs.bounce,
  });

  // Pulse on result terms
  const pulseT = Math.max(0, localFrame - 16);
  const pulse = term.is_result ? (Math.sin(pulseT * 0.14) + 1) / 2 : 0;

  // Operators get a lighter treatment (smaller + no label + white)
  const isOperator = /^[+\-Ã—Ã·=()]$/.test(term.text.trim());

  const fontSize = isOperator ? 88 : term.is_result ? 112 : 96;
  const color = term.is_result
    ? tokens.colors.accent
    : isOperator
    ? 'rgba(255,255,255,0.65)'
    : tokens.colors.white;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: progress,
        transform: `translateY(${(1 - progress) * 30}px) scale(${0.55 + progress * 0.45})`,
      }}
    >
      <div
        style={{
          fontFamily: tokens.fonts.body,
          fontWeight: 700,
          fontSize,
          color,
          lineHeight: 1,
          letterSpacing: '-1.5px',
          textShadow: term.is_result
            ? `0 6px 20px rgba(0,0,0,0.5), 0 0 ${30 + pulse * 24}px rgba(255,181,1,${0.35 + pulse * 0.2})`
            : '0 4px 14px rgba(0,0,0,0.5)',
          padding: term.is_result ? '4px 18px' : 0,
          background: term.is_result ? 'rgba(255,181,1,0.08)' : 'transparent',
          borderRadius: term.is_result ? 14 : 0,
          border: term.is_result
            ? `3px solid rgba(255,181,1,${0.5 + pulse * 0.3})`
            : 'none',
        }}
      >
        {term.text}
      </div>
      {term.label && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 500,
            fontSize: 26,
            color:
              term.is_result
                ? 'rgba(255,181,1,0.9)'
                : 'rgba(255,255,255,0.6)',
            marginTop: 6,
            textAlign: 'center',
            direction: 'rtl', // label can be Arabic
            whiteSpace: 'nowrap',
          }}
        >
          {term.label}
        </div>
      )}
    </div>
  );
};
