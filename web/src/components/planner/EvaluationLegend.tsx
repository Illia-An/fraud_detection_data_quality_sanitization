/** Shared Evaluation-view legend with hover tips (Plotly legend has no i18n tooltips). */

import { Box, Stack, Tooltip, Typography } from '@mui/material';

import { useT, type MessageKey } from '../../i18n';
import { isPipelineStepEnabled, type PipelineConfig } from '../../schemas/api';
import { STORE_IMPACT_COLORS } from '../charts/storeImpactChartData';

export type EvaluationLegendSwatch =
  | 'solid'
  | 'dash'
  | 'dashdot'
  | 'dot'
  | 'thick'
  | 'target'
  | 'band'
  | 'asOf';

export interface EvaluationLegendItem {
  id: string;
  labelKey: MessageKey;
  tipKey: MessageKey;
  color: string;
  swatch: EvaluationLegendSwatch;
}

function LegendSwatch({ color, swatch }: { color: string; swatch: EvaluationLegendSwatch }) {
  if (swatch === 'band') {
    return (
      <Box
        aria-hidden
        sx={{
          width: 14,
          height: 8,
          borderRadius: 0.5,
          bgcolor: color,
          flexShrink: 0,
        }}
      />
    );
  }
  if (swatch === 'asOf') {
    return (
      <Box
        aria-hidden
        sx={{
          width: 10,
          height: 12,
          borderLeft: `2px dashed ${color}`,
          flexShrink: 0,
        }}
      />
    );
  }
  const dasharray =
    swatch === 'dash'
      ? '4 3'
      : swatch === 'dashdot'
        ? '4 2 1 2'
        : swatch === 'dot' || swatch === 'target'
          ? '2 2'
          : undefined;
  const strokeWidth = swatch === 'thick' ? 3 : swatch === 'target' ? 1.5 : 2;
  return (
    <Box
      component="svg"
      aria-hidden
      viewBox="0 0 16 8"
      sx={{ width: 16, height: 8, flexShrink: 0, display: 'block' }}
    >
      <line
        x1="0"
        y1="4"
        x2="16"
        y2="4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
      />
    </Box>
  );
}

interface EvaluationLegendProps {
  items: readonly EvaluationLegendItem[];
  /** Optional test id override (default evaluation-legend). */
  testId?: string;
}

/** Compact horizontal legend; hover each item for a short EN/HE tip. */
export function EvaluationLegend({
  items,
  testId = 'evaluation-legend',
}: EvaluationLegendProps) {
  const t = useT();
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={0.75}
      data-testid={testId}
      sx={{ flexShrink: 0, columnGap: 1.25, rowGap: 0.5 }}
    >
      {items.map((item) => (
        <Tooltip
          key={item.id}
          title={t(item.tipKey)}
          enterDelay={200}
          describeChild
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            component="span"
            tabIndex={0}
            aria-label={`${t(item.labelKey)}. ${t(item.tipKey)}`}
            data-testid={`evaluation-legend-item-${item.id}`}
            sx={{
              cursor: 'help',
              outline: 'none',
              '&:focus-visible': {
                borderRadius: 0.5,
                boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
              },
            }}
          >
            <LegendSwatch color={item.color} swatch={item.swatch} />
            <Typography
              component="span"
              sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2, color: 'text.secondary' }}
            >
              {t(item.labelKey)}
            </Typography>
          </Stack>
        </Tooltip>
      ))}
    </Stack>
  );
}

/** Network Hero evaluation legend (grammar reference). */
export const HERO_EVALUATION_LEGEND: readonly EvaluationLegendItem[] = [
  {
    id: 'fact',
    labelKey: 'planner.hero.fact',
    tipKey: 'planner.hero.tip.fact',
    color: '#212121',
    swatch: 'solid',
  },
  {
    id: 'cumulative',
    labelKey: 'planner.hero.cumulative',
    tipKey: 'planner.hero.tip.cumulative',
    color: '#6a1b9a',
    swatch: 'dashdot',
  },
  {
    id: 'planCumulative',
    labelKey: 'planner.hero.planCumulative',
    tipKey: 'planner.hero.tip.planCumulative',
    color: '#2e7d32',
    swatch: 'dot',
  },
  {
    id: 'draft',
    labelKey: 'planner.hero.draft',
    tipKey: 'planner.hero.tip.draft',
    color: '#1565c0',
    swatch: 'thick',
  },
  {
    id: 'target',
    labelKey: 'planner.hero.target',
    tipKey: 'planner.hero.tip.target',
    color: '#c62828',
    swatch: 'target',
  },
  {
    id: 'cone',
    labelKey: 'planner.hero.cone',
    tipKey: 'planner.hero.tip.cone',
    color: 'rgba(25, 118, 210, 0.35)',
    swatch: 'band',
  },
  {
    id: 'asOf',
    labelKey: 'planner.hero.asOf',
    tipKey: 'planner.hero.tip.asOf',
    color: '#616161',
    swatch: 'asOf',
  },
] as const;

/** Store evaluation — same grammar as Hero (no network cone). */
export const STORE_EVALUATION_LEGEND: readonly EvaluationLegendItem[] = [
  {
    id: 'fact',
    labelKey: 'planner.storeHero.actual',
    tipKey: 'planner.hero.tip.fact',
    color: '#212121',
    swatch: 'solid',
  },
  {
    id: 'cumulative',
    labelKey: 'planner.storeHero.cumulative',
    tipKey: 'planner.hero.tip.cumulative',
    color: '#6a1b9a',
    swatch: 'dashdot',
  },
  {
    id: 'planCumulative',
    labelKey: 'planner.storeHero.planCumulative',
    tipKey: 'planner.hero.tip.planCumulative',
    color: '#2e7d32',
    swatch: 'dot',
  },
  {
    id: 'draft',
    labelKey: 'planner.storeHero.plan',
    tipKey: 'planner.hero.tip.draft',
    color: '#1565c0',
    swatch: 'thick',
  },
  {
    id: 'target',
    labelKey: 'planner.storeHero.target',
    tipKey: 'planner.hero.tip.target',
    color: '#c62828',
    swatch: 'target',
  },
  {
    id: 'asOf',
    labelKey: 'planner.storeHero.asOf',
    tipKey: 'planner.hero.tip.asOf',
    color: '#9e9e9e',
    swatch: 'asOf',
  },
] as const;

/** Sanitization Network / Store impact timeline legend (Actual + enabled tiers). */
export const NETWORK_IMPACT_LEGEND: readonly EvaluationLegendItem[] = [
  {
    id: 'actual',
    labelKey: 'chart.legend.actual',
    tipKey: 'chart.tip.actual',
    color: STORE_IMPACT_COLORS.actual,
    swatch: 'thick',
  },
  {
    id: 'tier1',
    labelKey: 'chart.legend.tier1',
    tipKey: 'chart.tip.tier1',
    color: STORE_IMPACT_COLORS.tier1,
    swatch: 'dash',
  },
  {
    id: 'tier2',
    labelKey: 'chart.legend.tier2',
    tipKey: 'chart.tip.tier2',
    color: STORE_IMPACT_COLORS.tier2,
    swatch: 'dashdot',
  },
  {
    id: 'tier3',
    labelKey: 'chart.legend.tier3',
    tipKey: 'chart.tip.tier3',
    color: STORE_IMPACT_COLORS.tier3,
    swatch: 'dot',
  },
  {
    id: 'tier4',
    labelKey: 'chart.legend.tier4',
    tipKey: 'chart.tip.tier4',
    color: STORE_IMPACT_COLORS.tier4,
    swatch: 'thick',
  },
] as const;

/** Drop legend rows for tiers disabled in the last run echo_config. */
export function networkImpactLegendItems(
  echoConfig?: PipelineConfig | null,
): EvaluationLegendItem[] {
  return NETWORK_IMPACT_LEGEND.filter((item) => {
    if (item.id === 'actual') {
      return true;
    }
    if (item.id === 'tier1') {
      return isPipelineStepEnabled('tier1', echoConfig);
    }
    if (item.id === 'tier2') {
      return isPipelineStepEnabled('tier2', echoConfig);
    }
    if (item.id === 'tier3') {
      return isPipelineStepEnabled('tier3', echoConfig);
    }
    if (item.id === 'tier4') {
      return isPipelineStepEnabled('tier4', echoConfig);
    }
    return false;
  });
}
