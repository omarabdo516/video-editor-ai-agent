import React from 'react';
import { Img, staticFile } from 'remotion';
import { tokens } from '../tokens';

export const LogoBug: React.FC = () => {
  const { position, width, opacity } = tokens.logoBug;
  return (
    <Img
      src={staticFile('logo.png')}
      style={{
        position: 'absolute',
        left: position.x - width / 2,
        top: position.y - width / 2,
        width,
        height: width,
        opacity,
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.4))',
      }}
    />
  );
};
