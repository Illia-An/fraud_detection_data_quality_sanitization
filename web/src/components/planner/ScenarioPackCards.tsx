import { Box, Button, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import type { PlanParams } from '../../schemas/plan';
import { SCENARIO_PACKS, type ScenarioPackId } from '../../schemas/scenarioPacks';
import { formatPathLeversSummary } from './plannerPathLeversSummary';

interface ScenarioPackCardsProps {
  disabled: boolean;
  disabledTip: string;
  pendingId: ScenarioPackId | null;
  pathParams: PlanParams;
  onApply: (id: ScenarioPackId) => void;
}

const PACK_COPY: Record<ScenarioPackId, { title: MessageKey; blurb: MessageKey }> = {
  close_gap: {
    title: 'planner.packs.closeGap.title',
    blurb: 'planner.packs.closeGap.blurb',
  },
  steady_grind: {
    title: 'planner.packs.steady.title',
    blurb: 'planner.packs.steady.blurb',
  },
  front_loaded: {
    title: 'planner.packs.frontLoaded.title',
    blurb: 'planner.packs.frontLoaded.blurb',
  },
};

/** Preset questions — one click sets levers and Runs; canvas is the answer. */
export function ScenarioPackCards({
  disabled,
  disabledTip,
  pendingId,
  pathParams,
  onApply,
}: ScenarioPackCardsProps) {
  const t = useT();

  return (
    <Stack spacing={1.25} data-testid="scenario-packs">
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {t('planner.packs.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
          {t('planner.packs.sub')}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        data-testid="planner-path-levers-summary"
        sx={{ fontSize: '0.68rem', lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}
      >
        {formatPathLeversSummary(pathParams, t)}
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
              borderColor: 'primary.light',
              borderRadius: 1.5,
              px: 1.25,
              py: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
                {t(copy.title)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.72rem', lineHeight: 1.35 }}
              >
                {t(copy.blurb)}
              </Typography>
              <Button
                size="medium"
                variant="contained"
                fullWidth
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
