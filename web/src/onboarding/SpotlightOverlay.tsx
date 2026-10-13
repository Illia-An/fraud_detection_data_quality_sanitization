import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

import type { TargetRect } from './resolveTarget';

const PAD = 8;
const RADIUS = 10;

interface SpotlightOverlayProps {
  target: TargetRect | null;
  /** Centered modal steps — full dim without cutout. */
  dimOnly?: boolean;
  onBackdropClick?: () => void;
}

/**
 * Full-viewport dim with a cutout around the target.
 * Physical `top`/`left` MUST use inline `style` — Emotion RTL would flip `sx.left` → `right`
 * and place the hole on the wrong side of the viewport.
 */
export function SpotlightOverlay({
  target,
  dimOnly = false,
  onBackdropClick,
}: SpotlightOverlayProps) {
  const theme = useTheme();
  const dim = alpha(theme.palette.common.black, 0.55);
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (dimOnly || target == null) {
    return (
      <Box
        role="presentation"
        data-testid="onboarding-spotlight"
        onClick={onBackdropClick}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: theme.zIndex.modal,
          bgcolor: dim,
          transition: reduceMotion ? undefined : theme.transitions.create('opacity'),
        }}
      />
    );
  }

  const top = Math.max(0, target.top - PAD);
  const left = Math.max(0, target.left - PAD);
  const width = target.width + PAD * 2;
  const height = target.height + PAD * 2;

  return (
    <Box
      role="presentation"
      data-testid="onboarding-spotlight"
      sx={{ position: 'fixed', inset: 0, zIndex: theme.zIndex.modal, pointerEvents: 'none' }}
    >
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
        {/* Top */}
        <Box
          onClick={onBackdropClick}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top }}
          sx={{ bgcolor: dim }}
        />
        {/* Bottom */}
        <Box
          onClick={onBackdropClick}
          style={{
            position: 'absolute',
            top: top + height,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          sx={{ bgcolor: dim }}
        />
        {/* Left */}
        <Box
          onClick={onBackdropClick}
          style={{
            position: 'absolute',
            top,
            left: 0,
            width: left,
            height,
          }}
          sx={{ bgcolor: dim }}
        />
        {/* Right */}
        <Box
          onClick={onBackdropClick}
          style={{
            position: 'absolute',
            top,
            left: left + width,
            right: 0,
            height,
          }}
          sx={{ bgcolor: dim }}
        />
        {/* Ring around target — physical coords via style */}
        <Box
          data-testid="onboarding-spotlight-ring"
          style={{
            position: 'absolute',
            top,
            left,
            width,
            height,
            borderRadius: RADIUS,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.85)}`,
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Box>
  );
}
