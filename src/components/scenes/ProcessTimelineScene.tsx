import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens, getStaggerDelay } from '../../tokens';
import type { Scene, TimelineElement, FooterCaptionElement } from '../../types';

type Props = { scene: Scene };

/**
 * Horizontal timeline of nodes, vertically centered. Each node:
 *  - lands with a bounce (scale 0.3 → 1.0)
 *  - the "done" node gets a continuous pulse glow
 *  - the connecting line draws progressively as each node arrives
 */
export const ProcessTimelineScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const timeline = scene.elements.find(
    (e): e is TimelineElement => e.type === 'timeline_horizontal',
  );
  const footer = scene.elements.find(
    (e): e is FooterCaptionElement => e.type === 'footer_caption',
  );

  const titleProgress = spring({ frame, fps, config: tokens.springs.bounce });

  if (!timeline) return null;

  const items = timeline.items;
  // Dynamic stagger (Phase 10 Round A) — fewer items get wider spacing
  // so a 2-node timeline still feels deliberate, and 5+ nodes tighten.
  const stagger = timeline.stagger_per_item_frames ?? getStaggerDelay(items.length);
  const nodeSize = tokens.scenes.timelineNodeSize;
  // Gap must be wide enough for Arabic labels ("ميزان مراجعة" ~ 280px at 48px/800)
  // so adjacent labels don't overlap. At 3 nodes with nodeSize=120 + gap=230:
  // totalWidth = 3*120 + 2*230 = 820px, fits inside 1080 with room to spare.
  const gap = 230;
  const labelSlotWidth = nodeSize + gap - 20;
  const totalWidth = items.length * nodeSize + (items.length - 1) * gap;
  void width;

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
        gap: 80,
      }}
    >
      {/* Title block (title + subtitle) */}
      <div
        style={{
          textAlign: 'center',
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * 36}px) scale(${0.88 + titleProgress * 0.12})`,
        }}
      >
        <div
          style={{
            fontFamily: scene.title_font ?? tokens.fonts.heading,
            fontWeight: scene.title_weight ?? 700,
            fontSize: scene.title_size ?? 76,
            color: tokens.colors.white,
            letterSpacing: '-1.2px',
            textShadow: '0 2px 14px rgba(0,0,0,0.5), 0 0 40px rgba(255,181,1,0.18)',
            lineHeight: 1.1,
          }}
        >
          {scene.title}
        </div>
        {scene.subtitle && (
          <div
            style={{
              marginTop: 14,
              fontFamily: tokens.fonts.body,
              fontWeight: 500,
              fontSize: 40,
              color: tokens.colors.accent,
              opacity: 0.95,
              letterSpacing: '0.3px',
            }}
          >
            {scene.subtitle}
          </div>
        )}
      </div>

      {/* Timeline row container */}
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          height: nodeSize + 120,
        }}
      >
        {/* Connecting line — animated fill */}
        {items.length > 1 && (() => {
          // Progress from 0..1 across how many nodes have "landed"
          const maxLineFill = items.length > 1 ? 1 : 0;
          const lastNodeArriveFrame = (items.length - 1) * stagger;
          const lineProgress = Math.max(
            0,
            Math.min(maxLineFill, (frame - 6) / Math.max(1, lastNodeArriveFrame)),
          );
          const lineWidth = (totalWidth - nodeSize) * lineProgress;
          return (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: nodeSize / 2 - tokens.scenes.timelineConnectorThickness / 2,
                  left: nodeSize / 2,
                  width: totalWidth - nodeSize,
                  height: tokens.scenes.timelineConnectorThickness,
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: nodeSize / 2 - tokens.scenes.timelineConnectorThickness / 2,
                  left: nodeSize / 2,
                  width: lineWidth,
                  height: tokens.scenes.timelineConnectorThickness,
                  background: `linear-gradient(90deg, ${tokens.colors.accent}, rgba(255,181,1,0.4))`,
                  borderRadius: 4,
                  boxShadow: `0 0 16px rgba(255,181,1,0.5)`,
                }}
              />
            </>
          );
        })()}

        {items.map((item, idx) => {
          const localFrame = Math.max(0, frame - idx * stagger);
          const progress = spring({
            frame: localFrame,
            fps,
            config: tokens.springs.bounce,
          });
          const isDone = item.status === 'done';
          const isNext = item.status === 'next';

          // Pulse for the "done" node (continuous after entrance)
          const pulseT = Math.max(0, localFrame - 12);
          const pulse = isDone ? (Math.sin(pulseT * 0.12) + 1) / 2 : 0;

          const nodeCenterX = idx * (nodeSize + gap) + nodeSize / 2;

          return (
            <React.Fragment key={idx}>
              {/* Node circle — positioned at its slot */}
              <div
                style={{
                  position: 'absolute',
                  left: idx * (nodeSize + gap),
                  top: 0,
                  width: nodeSize,
                  height: nodeSize,
                  borderRadius: '50%',
                  background: isDone
                    ? `radial-gradient(circle at 35% 30%, #FFCB47, ${tokens.colors.accent})`
                    : isNext
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(255,255,255,0.06)',
                  border: isDone
                    ? `4px solid ${tokens.colors.accent}`
                    : isNext
                    ? `4px solid ${tokens.colors.accent}`
                    : '3px solid rgba(255,255,255,0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: tokens.fonts.heading,
                  fontWeight: 800,
                  fontSize: 60,
                  color: isDone ? tokens.colors.dark : tokens.colors.white,
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 24}px) scale(${0.3 + progress * 0.7})`,
                  boxShadow: isDone
                    ? `0 14px 36px rgba(255,181,1,${0.45 + pulse * 0.3}), 0 0 0 ${10 + pulse * 14}px rgba(255,181,1,${0.08 + pulse * 0.12})`
                    : isNext
                    ? '0 10px 28px rgba(0,0,0,0.5)'
                    : 'none',
                }}
              >
                {item.status_text || (idx + 1)}
              </div>

              {/* Label — independent absolute container, wider than the node
                  so long Arabic labels don't collide with neighbors */}
              <div
                style={{
                  position: 'absolute',
                  left: nodeCenterX - labelSlotWidth / 2,
                  top: nodeSize + 28,
                  width: labelSlotWidth,
                  fontFamily: tokens.fonts.body,
                  fontWeight: 800,
                  fontSize: tokens.scenes.timelineLabelSize + 4,
                  color:
                    isDone || isNext ? tokens.colors.white : 'rgba(255,255,255,0.48)',
                  textAlign: 'center',
                  lineHeight: 1.15,
                  letterSpacing: '-0.3px',
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 20}px)`,
                  textShadow: isDone
                    ? '0 2px 10px rgba(255,181,1,0.4), 0 2px 8px rgba(0,0,0,0.5)'
                    : '0 2px 8px rgba(0,0,0,0.5)',
                }}
              >
                {item.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer caption — fades in after all timeline nodes land */}
      {footer && (() => {
        const fdelay = footer.delay_frames ?? 60;
        const fProgress = spring({
          frame: Math.max(0, frame - fdelay),
          fps,
          config: tokens.springs.enter,
        });
        return (
          <div
            style={{
              fontFamily: footer.font || tokens.fonts.body,
              fontWeight: footer.weight || 500,
              fontSize: footer.size || 38,
              color: footer.color === 'accent' ? tokens.colors.accent : tokens.colors.white,
              opacity: fProgress * 0.9,
              transform: `translateY(${(1 - fProgress) * 16}px)`,
              textAlign: 'center',
              padding: '0 100px',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {footer.text}
          </div>
        );
      })()}
    </div>
  );
};
