import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { tokens } from './tokens';
import './utils/fonts';
import previewProps from './preview-props.json';
import type { CaptionsData, ReelProps } from './types';

const EMPTY_CAPTIONS: CaptionsData = {
  language: 'ar',
  totalDuration: 10,
  segmentCount: 0,
  segments: [],
};

// Pull preview props from src/preview-props.json — the `rs-reels studio`
// command writes the currently selected video + captions there so Studio
// loads with real content instead of a blank stub.
const DEFAULT_PROPS: ReelProps = {
  videoSrc: (previewProps as ReelProps).videoSrc || '',
  captions:
    ((previewProps as ReelProps).captions?.segments?.length ?? 0) > 0
      ? (previewProps as ReelProps).captions
      : EMPTY_CAPTIONS,
  lecturer: (previewProps as ReelProps).lecturer || 'محمد ريان',
  workshop: (previewProps as ReelProps).workshop || 'ورشة الشامل',
  zoomPlan: (previewProps as ReelProps).zoomPlan ?? null,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        fps={tokens.comp.fps}
        width={tokens.comp.width}
        height={tokens.comp.height}
        durationInFrames={30}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={async ({ props }) => {
          const totalSec =
            (props.captions?.totalDuration ?? EMPTY_CAPTIONS.totalDuration) +
            tokens.outro.durationSec;
          return {
            durationInFrames: Math.max(1, Math.round(totalSec * tokens.comp.fps)),
          };
        }}
      />
    </>
  );
};
