import React from 'react';
import type { MicroEvent } from '../../types';
import { CaptionUnderline } from './CaptionUnderline';
import { AccentFlash } from './AccentFlash';
import { CornerSweep } from './CornerSweep';
import { BorderPulse } from './BorderPulse';

type Props = { event: MicroEvent };

/**
 * Switches by micro-event type.
 *  - `mini_zoom`  — handled upstream (merged into smart_zoom_plan.moments)
 *  - `word_pop`   — handled by WordCaption via `emphasisBeats`, which
 *                   picks a variant for whichever word is currently active.
 *                   No standalone element to render here.
 *  - Everything else — rendered here as an overlay sibling of the caption.
 *
 * Phase 10 Round A Tier 2 — A7: added `corner_sweep` and `border_pulse`.
 */
export const MicroEventHost: React.FC<Props> = ({ event }) => {
  switch (event.type) {
    case 'caption_underline':
      return <CaptionUnderline event={event} />;
    case 'accent_flash':
      return <AccentFlash event={event} />;
    case 'corner_sweep':
      return <CornerSweep event={event} />;
    case 'border_pulse':
      return <BorderPulse event={event} />;
    case 'word_pop':
    case 'mini_zoom':
      return null;
    default:
      return null;
  }
};
