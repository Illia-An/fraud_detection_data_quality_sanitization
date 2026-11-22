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
}

export function CumulativeSlopeHeroChart({
  layers,
  yAxisTitle = '5% Score',
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
      <Stack
        spacing={1}
        sx={{
          flex: 1,
          minHeight: SLOPE_PANEL_MIN_HEIGHT_PX * 2,
          overflow: 'hidden',
        }}
      >
        <SlopeCumulativePanel layers={layers} yAxisTitle={yAxisTitle} />
        <SlopeMonthlyPanel layers={layers} yAxisTitle={yAxisTitle} />
      </Stack>
    </Stack>
  );
}
