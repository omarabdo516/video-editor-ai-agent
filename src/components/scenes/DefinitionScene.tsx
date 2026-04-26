import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, DefinitionElement } from '../../types';

type Props = { scene: Scene };

/**
 * DefinitionScene â€” "the term" above + body text below + optional icon.
 * Used for concept explanations ("Ø§Ù„Ø£ØµÙˆÙ„ Ø§Ù„Ø«Ø§Ø¨ØªØ© = ...", "IFRS = ...").
 *
 * Animation order:
 *   1. Icon scales in with bounce
 *   2. Term fades in + slides up (with accent glow pulse after)
 *   3. Term_sub fades in underneath (if present)
 *   4. Definition body fades in word-by-word
 *   5. Example fades in at the bottom (if present)
 */
export const DefinitionScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const el = scene.elements.find(
    (e): e is DefinitionElement => e.type === 'definition',
  );
  if (!el) return null;

  // Background atmosphere
  const bgPulse = (Math.sin(frame * 0.05) + 1) / 2;

  // Stagger delays
  const iconDelay = 0;
  const termDelay = 10;
  const termSubDelay = 22;
  const defDelay = 30;
  const exampleDelay = 48;

  const iconProgress = spring({
    frame: Math.max(0, frame - iconDelay),
    fps,
    config: tokens.springs.bounce,
  });
  const termProgress = spring({
    frame: Math.max(0, frame - termDelay),
    fps,
    config: tokens.springs.bounce,
  });
  const termSubProgress = spring({
    frame: Math.max(0, frame - termSubDelay),
    fps,
    config: tokens.springs.enter,
  });
  const defProgress = spring({
    frame: Math.max(0, frame - defDelay),
    fps,
    config: tokens.springs.enter,
  });
  const exampleProgress = spring({
    frame: Math.max(0, frame - exampleDelay),
    fps,
    config: tokens.springs.enter,
  });

  // Continuous pulse glow on the term (starts after its entrance)
  const pulseT = Math.max(0, frame - termDelay - 16);
  const pulse = (Math.sin(pulseT * 0.13) + 1) / 2;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280, // logo clearance
        paddingBottom: 80,
        gap: 20,
      }}
    >
      {/* Background atmosphere */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 48%, rgba(255,181,1,${0.08 + bgPulse * 0.06}) 0%, transparent 55%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Icon (optional) */}
      {el.icon && (
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #FFCB47, ${tokens.colors.accent})`,
            border: `4px solid ${tokens.colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
            color: tokens.colors.dark,
            boxShadow: `0 16px 40px rgba(255,181,1,${0.4 + pulse * 0.2}), 0 0 0 ${8 + pulse * 10}px rgba(255,181,1,0.08)`,
            transform: `scale(${0.3 + iconProgress * 0.7})`,
            opacity: iconProgress,
            marginBottom: 8,
          }}
        >
          {el.icon}
        </div>
      )}

      {/* Term (big accent) */}
      <div
        style={{
          fontFamily: tokens.fonts.body,
          fontWeight: 700,
          fontSize: 110,
          color: tokens.colors.accent,
          textAlign: 'center',
          lineHeight: 1.05,
          letterSpacing: '-2px',
          opacity: termProgress,
          transform: `translateY(${(1 - termProgress) * 30}px) scale(${0.82 + termProgress * 0.18})`,
          textShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 ${40 + pulse * 30}px rgba(255,181,1,${0.3 + pulse * 0.2}), 0 2px 6px rgba(0,0,0,0.7)`,
          padding: '0 60px',
          margin: 0,
        }}
      >
        {el.term}
      </div>

      {/* Term_sub (smaller accent sub-text under the term) */}
      {el.term_sub && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 600,
            fontSize: 36,
            color: 'rgba(255,181,1,0.75)',
            textAlign: 'center',
            opacity: termSubProgress,
            transform: `translateY(${(1 - termSubProgress) * 12}px)`,
            letterSpacing: '0.2px',
            marginTop: -4,
            marginBottom: 12,
          }}
        >
          {el.term_sub}
        </div>
      )}

      {/* Divider line (subtle) */}
      <div
        style={{
          width: 280,
          height: 3,
          background: `linear-gradient(90deg, transparent, rgba(255,181,1,0.5), transparent)`,
          borderRadius: 2,
          opacity: termProgress * 0.7,
          margin: '4px 0 8px',
        }}
      />

      {/* Definition body */}
      <div
        style={{
          fontFamily: tokens.fonts.heading,
          fontWeight: 500,
          fontSize: 44,
          color: tokens.colors.white,
          textAlign: 'center',
          lineHeight: 1.35,
          maxWidth: 860,
          opacity: defProgress,
          transform: `translateY(${(1 - defProgress) * 20}px)`,
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          padding: '0 60px',
        }}
      >
        {el.definition}
      </div>

      {/* Example (optional, smaller, italic-feel) */}
      {el.example && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 400,
            fontSize: 32,
            color: 'rgba(255,255,255,0.75)',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 780,
            opacity: exampleProgress * 0.9,
            transform: `translateY(${(1 - exampleProgress) * 12}px)`,
            marginTop: 16,
            padding: '14px 32px',
            border: '1.5px dashed rgba(255,255,255,0.25)',
            borderRadius: 12,
          }}
        >
          {el.example}
        </div>
      )}
    </div>
  );
};
