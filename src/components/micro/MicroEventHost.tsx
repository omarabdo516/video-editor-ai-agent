import React from 'react';
import type { MicroEvent } from '../../types';
import { CaptionUnderline } from './CaptionUnderline';
import { AccentFlash } from './AccentFlash';

type Props = { event: MicroEvent };

/**
 * Switches by micro-event type.
 *  - `mini_zoom`  — handled upstream (merged into smart_zoom_plan.moments)
 *  - `word_pop`   — handled by WordCaption via the `emphasisTimes` prop,
 *                   which boosts whichever word is currently active. No
 *                   standalone element to render here.
 *  - `caption_underline` / `accent_flash` — render here as overlay siblings.
 */
export const MicroEventHost: React.FC<Props> = ({ event }) => {
  switch (event.type) {
    case 'caption_underline':
      return <CaptionUnderline event={event} />;
    case 'accent_flash':
      return <AccentFlash event={event} />;
    case 'word_pop':
    case 'mini_zoom':
      return null;
    default:
      return null;
  }
};
