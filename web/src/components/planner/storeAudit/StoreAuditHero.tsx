import { Box, Stack, Typography } from '@mui/material';

import { useT } from '../../../i18n';
import type { DirectedPlan, MetricScorePanel } from '../../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../../schemas/planMonitoring';
import type { CumulativeSlopeStoreLayers } from '../cumulativeSlopeLayers';
import { SlopeCumulativePanel } from '../SlopeCumulativePanel';
import { NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX } from '../slopeHeroShared';
import { StoreHeroEvaluationChart } from '../StoreHeroEvaluationChart';
import {
  SANDBOX_OVERLAY_GAP_PX,
  SANDBOX_SUMMARY_RESERVE_PX,
  STORE_HERO_IN_DIALOG_MIN_PX,
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

/**
 * Inspect hero: Figma §4.2 — compact cumulative Slope only (no network monthly duplicate).
 * Falls back to legacy store evaluation when Slope layers are absent.
 */
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
        flex: '0 0 auto',
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
        <Stack spacing={0.35} sx={{ width: '100%' }}>
          <Typography
            sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2, flexShrink: 0 }}
          >
            {t('planner.storeHero.title')}
          </Typography>
          <Box
            data-testid="inspect-slope-cumulative"
            sx={{
              height: NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX,
              width: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <SlopeCumulativePanel layers={slopeLayers} yAxisTitle={yAxisTitle ?? '5% Score'} />
          </Box>
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
