import { useEffect, useState } from 'react';

import { PLANNER_COLLAPSED_PLAY_REVEAL_MS } from './plannerShell';

/**
 * `true` once the rail has been collapsed for `PLANNER_COLLAPSED_PLAY_REVEAL_MS`.
 * The delay keeps the collapse click from ghost-hitting the collapsed Play button.
 */
export function useCollapsedPlayReveal(controlsOpen: boolean): boolean {
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);

  useEffect(() => {
    if (controlsOpen) {
      setShowCollapsedPlay(false);
      return;
    }
    const timerId = window.setTimeout(
      () => setShowCollapsedPlay(true),
      PLANNER_COLLAPSED_PLAY_REVEAL_MS,
    );
    return () => window.clearTimeout(timerId);
  }, [controlsOpen]);

  return showCollapsedPlay;
}
