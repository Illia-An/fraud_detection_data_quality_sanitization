import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useEffect, useId, useRef } from 'react';

import { useT } from '../i18n';
import type { TargetRect } from './resolveTarget';
import type { OnboardingStepId, TourPlacement } from './tourConfig';

const CARD_WIDTH = 340;
const GAP = 12;
const VIEW_PAD = 12;

interface TourCardProps {
  stepId: OnboardingStepId;
  title: string;
  body: string;
  progressLabel: string;
  placement: TourPlacement;
  target: TargetRect | null;
  canGoBack: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  onExit: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computePosition(
  placement: TourPlacement,
  target: TargetRect | null,
  cardHeight: number,
): { top: number; left: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  if (placement === 'center' || target == null) {
    return {
      top: Math.max(VIEW_PAD, (vh - cardHeight) / 2),
      left: Math.max(VIEW_PAD, (vw - CARD_WIDTH) / 2),
    };
  }

  let top = target.top;
  let left = target.left;

  switch (placement) {
    case 'right':
      left = target.right + GAP;
      top = target.top;
      break;
    case 'left':
      left = target.left - CARD_WIDTH - GAP;
      top = target.top;
      break;
    case 'bottom':
      left = target.left;
      top = target.bottom + GAP;
      break;
    case 'top':
      left = target.left;
      top = target.top - cardHeight - GAP;
      break;
    default:
      break;
  }

  left = clamp(left, VIEW_PAD, vw - CARD_WIDTH - VIEW_PAD);
  top = clamp(top, VIEW_PAD, vh - cardHeight - VIEW_PAD);
  return { top, left };
}

export function TourCard({
  stepId,
  title,
  body,
  progressLabel,
  placement,
  target,
  canGoBack,
  primaryLabel,
  onPrimary,
  onBack,
  onExit,
}: TourCardProps) {
  const t = useT();
  const theme = useTheme();
  const titleId = useId();
  const descId = useId();
  const paperRef = useRef<HTMLDivElement | null>(null);
  const cardHeight = paperRef.current?.offsetHeight ?? 220;
  const { top, left } = computePosition(placement, target, cardHeight);

  useEffect(() => {
    const node = paperRef.current;
    if (!node) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    node.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [stepId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  return (
    <Paper
      ref={paperRef}
      elevation={8}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      data-testid="onboarding-tour-card"
      data-step={stepId}
      // Physical top/left via style — Emotion RTL would flip sx.left and misplace the card.
      style={{
        position: 'fixed',
        top,
        left,
        width: CARD_WIDTH,
        maxWidth: `calc(100vw - ${VIEW_PAD * 2}px)`,
        zIndex: theme.zIndex.modal + 1,
      }}
      sx={{
        p: 2,
        outline: 'none',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {progressLabel}
            </Typography>
            <Typography id={titleId} variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {title}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onExit}
            aria-label={t('onboarding.exit')}
            data-testid="onboarding-exit"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Typography id={descId} variant="body2" color="text.secondary">
          {body}
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          {canGoBack ? (
            <Button size="small" onClick={onBack} data-testid="onboarding-back">
              {t('onboarding.back')}
            </Button>
          ) : null}
          {stepId === 'welcome' ? (
            <Button size="small" color="inherit" onClick={onExit} data-testid="onboarding-skip">
              {t('onboarding.skipTour')}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="contained"
            onClick={onPrimary}
            data-testid="onboarding-primary"
          >
            {primaryLabel}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
