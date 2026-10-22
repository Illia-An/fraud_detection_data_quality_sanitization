import { lazy, Suspense, useMemo } from 'react';
import { Chip, CircularProgress, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { TtsKpiPanel } from '../../schemas/ttsKpiPanel';
import type { TtsPlan } from '../../schemas/ttsPlan';
import { historyChain, planChain } from './ttsHeroSeries';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

interface TtsHeroChartProps {
  panel: TtsKpiPanel;
  plan: TtsPlan;
}

/** History, planned minutes, and the target. The plan line falls when minutes improve. */
export function TtsHeroChart({ panel, plan }: TtsHeroChartProps) {
  const t = useT();
  const history = useMemo(() => historyChain(panel), [panel]);
  const planned = useMemo(() => planChain(plan), [plan]);
  const labels = [...history.map((point) => point.label), ...planned.map((point) => point.label)];

  return (
    <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" data-testid="tts-hero-legend">
        <Chip size="small" label={t('ttsPlanner.legend.history')} sx={{ bgcolor: '#4C78A8', color: 'white' }} />
        <Chip size="small" label={t('ttsPlanner.legend.plan')} sx={{ bgcolor: '#54A24B', color: 'white' }} />
        <Chip size="small" variant="outlined" label={t('ttsPlanner.legend.target')} />
      </Stack>
      <Typography variant="body2" data-testid="tts-planner-plan-summary">
        {plan.current_chain.toFixed(2)} → {plan.final_chain.toFixed(2)} min · {t('ttsPlanner.dir.improve')}
      </Typography>
      <Suspense fallback={<CircularProgress size={24} />}>
        <Plot
          data={[
            {
              x: history.map((point) => point.label),
              y: history.map((point) => point.minutes),
              type: 'scatter',
              mode: 'lines+markers',
              name: t('ttsPlanner.legend.history'),
              line: { color: '#4C78A8' },
            },
            {
              x: planned.map((point) => point.label),
              y: planned.map((point) => point.minutes),
              type: 'scatter',
              mode: 'lines+markers',
              name: t('ttsPlanner.legend.plan'),
              line: { color: '#54A24B' },
            },
            {
              x: labels,
              y: labels.map(() => plan.target),
              type: 'scatter',
              mode: 'lines',
              name: t('ttsPlanner.legend.target'),
              line: { color: '#E45756', dash: 'dash' },
            },
          ]}
          layout={{
            autosize: true,
            height: 300,
            margin: { l: 48, r: 16, t: 8, b: 40 },
            yaxis: { title: { text: 'min' }, autorange: true },
            legend: { orientation: 'h' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </Suspense>
    </Stack>
  );
}
