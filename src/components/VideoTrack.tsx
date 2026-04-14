import React from 'react';
import { AbsoluteFill, OffthreadVideo, useVideoConfig } from 'remotion';

type Props = {
  src: string;
};

export const VideoTrack: React.FC<Props> = ({ src }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo
        src={src}
        style={{
          width,
          height,
          objectFit: 'cover',
          objectPosition: 'center',
        }}
        muted={false}
      />
    </AbsoluteFill>
  );
};
