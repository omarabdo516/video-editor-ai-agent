import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
} from 'remotion';
import { VideoTrack } from './components/VideoTrack';
import { WordCaption } from './components/WordCaption';
import { LogoBug } from './components/LogoBug';
import { LowerThird } from './components/LowerThird';
import { Outro } from './components/Outro';
import { SmartZoom } from './components/SmartZoom';
import { rechunkCaptions } from './utils/chunk';
import { tokens } from './tokens';
import type { ReelProps } from './types';

export const Reel: React.FC<ReelProps> = ({
  videoSrc,
  captions,
  lecturer,
  workshop,
  zoomPlan,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const chunked = React.useMemo(
    () => rechunkCaptions(captions, tokens.captions.wordsPerChunk, 3),
    [captions],
  );

  const lectureFrames = Math.round(captions.totalDuration * fps);
  const outroFrames = Math.round(tokens.outro.durationSec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Main lecture section */}
      <Sequence from={0} durationInFrames={lectureFrames}>
        <SmartZoom plan={zoomPlan}>
          <VideoTrack src={videoSrc} />
        </SmartZoom>
        <LogoBug />
        <LowerThird name={lecturer} title={workshop} />

        {chunked.segments.map((seg, idx) => {
          const fromFrame = Math.round(seg.start * fps);
          const segDurFrames = Math.max(1, Math.round((seg.end - seg.start) * fps));
          return (
            <Sequence
              key={idx}
              from={fromFrame}
              durationInFrames={segDurFrames}
              name={`cap_${idx}`}
            >
              <WordCaption segment={seg} timeOffset={seg.start} />
            </Sequence>
          );
        })}
      </Sequence>

      {/* Outro */}
      <Sequence from={lectureFrames} durationInFrames={outroFrames}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
