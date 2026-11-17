import { Box, Stack, Typography } from '@mui/material';

import { useT } from '../../../i18n';
import type { DirectedPlan, MetricScorePanel } from '../../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../../schemas/planMonitoring';
import type { CumulativeSlopeStoreLayers } from '../cumulativeSlopeLayers';
import { CumulativeSlopeHeroChart } from '../CumulativeSlopeHeroChart';
import { StoreHeroEvaluationChart } from '../StoreHeroEvaluationChart';
import {
  SANDBOX_OVERLAY_GAP_PX,
  SANDBOX_SUMMARY_RESERVE_PX,
  STORE_HERO_IN_DIALOG_MIN_PX,
  STORE_SLOPE_IN_DIALOG_MIN_PX,
} from './storeAuditLayout';

export interface StoreAuditHeroProps {
  plan: DirectedPlan;
  storeId: number;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  draftLast: number | null;
  slopeLayers: CumulativeSlopeStoreLayers | null;
  yAxisTitle?: string;
  tickSuffix?: string;
}

/** Inspect hero: dual-panel Slope chart when layers exist, else legacy store evaluation. */
export function StoreAuditHero({
  plan,
  storeId,
  panel,
  insights,
  draftLast,
  slopeLayers,
  yAxisTitle,
  tickSuffix,
}: StoreAuditHeroProps) {
  const t = useT();

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: slopeLayers != null ? STORE_SLOPE_IN_DIALOG_MIN_PX : 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        pb: {
          xs: 0,
          md: `${SANDBOX_SUMMARY_RESERVE_PX + SANDBOX_OVERLAY_GAP_PX}px`,
        },
      }}
    >
      {slopeLayers != null ? (
        <Stack spacing={0.35} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
          <Typography
            sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2, flexShrink: 0 }}
          >
            {t('planner.storeHero.title')}
          </Typography>
          <CumulativeSlopeHeroChart
            layers={slopeLayers}
            yAxisTitle={yAxisTitle ?? '5% Score'}
          />
        </Stack>
      ) : (
        <StoreHeroEvaluationChart
          plan={plan}
          storeId={storeId}
          panel={panel}
          insights={insights}
          draftLast={draftLast}
          plotHeightPx={STORE_HERO_IN_DIALOG_MIN_PX}
          fillParent
          yAxisTitle={yAxisTitle}
          tickSuffix={tickSuffix}
        />
      )}
    </Box>
  );
}
