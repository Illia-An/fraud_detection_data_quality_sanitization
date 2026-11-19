/** Network Hero wrapper: equal-split cumulative + monthly Slope panels. */

import { Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import { SlopeCumulativePanel } from './SlopeCumulativePanel';
import { SlopeMonthlyPanel } from './SlopeMonthlyPanel';
import { SLOPE_PANEL_MIN_HEIGHT_PX } from './slopeHeroShared';

export {
  CUMULATIVE_SLOPE_NETWORK_LEGEND,
  SLOPE_CUMULATIVE_DEFAULT_HIDDEN,
  SLOPE_CUMULATIVE_LEGEND,
  SLOPE_DEFAULT_HIDDEN_IDS,
  SLOPE_MONTHLY_LEGEND,
  SLOPE_PANEL_HEIGHT_PX,
  SLOPE_PANEL_MIN_HEIGHT_PX,
} from './slopeHeroShared';

interface CumulativeSlopeHeroChartProps {
  layers: CumulativeSlopePlotLayers;
  yAxisTitle?: string;
  /** Phase-1: drag Plan points (live recompute via parent draft). */
  planDragEnabled?: boolean;
  onCumulativePlanDragPreview?: (monthIndex: number, value: number) => void;
  onCumulativePlanDragCommit?: (monthIndex: number, value: number) => void;
  onMonthlyPlanDragPreview?: (monthIndex: number, value: number) => void;
  onMonthlyPlanDragCommit?: (monthIndex: number, value: number) => void;
  onPlanDragCancel?: () => void;
  getPlanDragGeneration?: () => number;
}

export function CumulativeSlopeHeroChart({
  layers,
  yAxisTitle = '5% Score',
  planDragEnabled = false,
  onCumulativePlanDragPreview,
  onCumulativePlanDragCommit,
  onMonthlyPlanDragPreview,
  onMonthlyPlanDragCommit,
  onPlanDragCancel,
  getPlanDragGeneration,
}: CumulativeSlopeHeroChartProps) {
  const t = useT();
  const { cutover, target } = layers;
  const cutoverCaption =
    cutover.factEndLabel != null && cutover.forecastStartLabel != null
      ? t('planner.slope.cutoverCaption', {
          factEnd: cutover.factEndLabel,
          forecastStart: cutover.forecastStartLabel,
          declaredAsOf: cutover.declaredAsOfLabel,
        })
      : t('planner.slope.cutoverCaptionNoFact', {
          forecastStart: cutover.forecastStartLabel ?? cutover.lineLabel,
          declaredAsOf: cutover.declaredAsOfLabel,
        });

  return (
    <Stack
      spacing={0.75}
      sx={{ flex: 1, height: '100%', minHeight: 0, width: '100%' }}
      data-testid="cumulative-slope-hero-chart"
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ flexShrink: 0, px: 0.5 }}
        data-testid="slope-cutover-caption"
      >
        {cutoverCaption}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ flexShrink: 0, px: 0.5, opacity: 0.9 }}
        data-testid="slope-status-hint"
      >
        {t('planner.slope.statusHint', { target: String(target) })}
      </Typography>
      {planDragEnabled ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, px: 0.5 }}
          data-testid="slope-plan-drag-hint"
        >
          {t('planner.slope.dragHint')}
        </Typography>
      ) : null}
      <Stack
        spacing={1}
        sx={{
          flex: 1,
          minHeight: SLOPE_PANEL_MIN_HEIGHT_PX * 2,
          overflow: 'hidden',
        }}
      >
        <SlopeCumulativePanel
          layers={layers}
          yAxisTitle={yAxisTitle}
          planDragEnabled={planDragEnabled}
          onPlanDragPreview={onCumulativePlanDragPreview}
          onPlanDragCommit={onCumulativePlanDragCommit}
          onPlanDragCancel={onPlanDragCancel}
          getPlanDragGeneration={getPlanDragGeneration}
        />
        <SlopeMonthlyPanel
          layers={layers}
          yAxisTitle={yAxisTitle}
          planDragEnabled={planDragEnabled}
          onPlanDragPreview={onMonthlyPlanDragPreview}
          onPlanDragCommit={onMonthlyPlanDragCommit}
          onPlanDragCancel={onPlanDragCancel}
          getPlanDragGeneration={getPlanDragGeneration}
        />
      </Stack>
    </Stack>
  );
}
