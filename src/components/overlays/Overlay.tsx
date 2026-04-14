import React from 'react';
import type { OverlayItem } from '../../types';
import { KeywordHighlightOverlay } from './KeywordHighlightOverlay';
import { StampOverlay } from './StampOverlay';

type Props = { overlay: OverlayItem };

/**
 * Switches by overlay_type. Each variant uses its own enter/exit animation.
 * Frame is local to the parent <Sequence> (starts at overlay.start_sec).
 */
export const Overlay: React.FC<Props> = ({ overlay }) => {
  switch (overlay.overlay_type) {
    case 'stamp':
      return <StampOverlay overlay={overlay} />;
    case 'keyword_highlight':
    default:
      return <KeywordHighlightOverlay overlay={overlay} />;
  }
};
