import { Box, Button, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import {
  STORE_MIX_QUESTIONS,
  type StoreMixQuestionId,
} from '../../schemas/storeMixQuestions';

interface StoreMixQuestionCardsProps {
  disabled: boolean;
  disabledTip: string;
  pendingId: StoreMixQuestionId | null;
  onApply: (id: StoreMixQuestionId) => void;
}

const MIX_COPY: Record<StoreMixQuestionId, { title: MessageKey; blurb: MessageKey }> = {
  lift_behind: {
    title: 'planner.mix.liftBehind.title',
    blurb: 'planner.mix.liftBehind.blurb',
  },
  rebalance_flat: {
    title: 'planner.mix.rebalance.title',
    blurb: 'planner.mix.rebalance.blurb',
  },
};

/** Preset store-mix questions — one click redistributes draft (session only). */
export function StoreMixQuestionCards({
  disabled,
  disabledTip,
  pendingId,
  onApply,
}: StoreMixQuestionCardsProps) {
  const t = useT();

  return (
    <Stack spacing={1} data-testid="store-mix-questions">
      <Typography variant="caption" fontWeight={600}>
        {t('planner.mix.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {t('planner.mix.sub')}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        data-testid="store-mix-recipe-summary"
        sx={{ fontSize: '0.68rem', lineHeight: 1.35 }}
      >
        {t('planner.mix.recipeSummary')}
      </Typography>
      {STORE_MIX_QUESTIONS.map((q) => {
        const copy = MIX_COPY[q.id];
        const busy = pendingId === q.id;
        const otherBusy = pendingId != null && pendingId !== q.id;
        return (
          <Box
            key={q.id}
            data-testid={`store-mix-${q.id}`}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              px: 1,
              py: 0.75,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                {t(copy.title)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.68rem', lineHeight: 1.3 }}
              >
                {t(copy.blurb)}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                disabled={disabled || otherBusy}
                onClick={() => onApply(q.id)}
                data-testid={`store-mix-apply-${q.id}`}
                title={disabled ? disabledTip : undefined}
              >
                {busy ? t('common.runningDots') : t('planner.mix.apply')}
              </Button>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
