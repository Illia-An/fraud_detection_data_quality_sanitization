import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { SCENARIO_PACKS, type ScenarioPackId } from '../../schemas/scenarioPacks';

interface ScenarioPackCardsProps {
  disabled: boolean;
  disabledTip: string;
  pendingId: ScenarioPackId | null;
  onApply: (id: ScenarioPackId) => void;
}

const PACK_COPY: Record<
  ScenarioPackId,
  { title: MessageKey; blurb: MessageKey; effect: MessageKey }
> = {
  close_gap: {
    title: 'planner.packs.closeGap.title',
    blurb: 'planner.packs.closeGap.blurb',
    effect: 'planner.packs.closeGap.effect',
  },
  rebalance: {
    title: 'planner.packs.rebalance.title',
    blurb: 'planner.packs.rebalance.blurb',
    effect: 'planner.packs.rebalance.effect',
  },
  steady_grind: {
    title: 'planner.packs.steady.title',
    blurb: 'planner.packs.steady.blurb',
    effect: 'planner.packs.steady.effect',
  },
};

/** One-click scenario recipes — Run (+ optional surplus post-pass). */
export function ScenarioPackCards({
  disabled,
  disabledTip,
  pendingId,
  onApply,
}: ScenarioPackCardsProps) {
  const t = useT();

  return (
    <Stack spacing={1} data-testid="scenario-packs">
      <Typography variant="caption" fontWeight={600}>
        {t('planner.packs.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {t('planner.packs.sub')}
      </Typography>
      {SCENARIO_PACKS.map((pack) => {
        const copy = PACK_COPY[pack.id];
        const busy = pendingId === pack.id;
        const otherBusy = pendingId != null && pendingId !== pack.id;
        return (
          <Box
            key={pack.id}
            data-testid={`scenario-pack-${pack.id}`}
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
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={0.5}
                useFlexGap
                flexWrap="wrap"
              >
                <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.25 }}>
                  {t(copy.title)}
                </Typography>
                <Chip
                  size="small"
                  label={t(copy.effect)}
                  color={
                    pack.id === 'close_gap'
                      ? 'success'
                      : pack.id === 'rebalance'
                        ? 'default'
                        : 'info'
                  }
                  variant={pack.id === 'rebalance' ? 'outlined' : 'filled'}
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    '& .MuiChip-label': { px: 0.6 },
                  }}
                />
              </Stack>
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
                startIcon={<ScienceRoundedIcon />}
                disabled={disabled || otherBusy}
                onClick={() => onApply(pack.id)}
                data-testid={`scenario-pack-apply-${pack.id}`}
                title={disabled ? disabledTip : undefined}
              >
                {busy ? t('common.runningDots') : t('planner.packs.apply')}
              </Button>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
