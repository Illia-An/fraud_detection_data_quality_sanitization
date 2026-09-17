import { Box, Card, CardContent, Grid2 as Grid, Stack, Typography } from '@mui/material';

import type { ProcessResponse, ResponseMeta } from '../schemas/api';

interface KpiCardsProps {
  result: ProcessResponse;
}

const denseCardContentSx = {
  py: 0.5,
  px: 1,
  '&:last-child': { pb: 0.5 },
} as const;

const TELEMETRY_SCROLL_MAX_HEIGHT_PX = 36;

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}%`;
}

function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pp`;
}

function formatMs(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value.toFixed(1)} ms`;
}

function formatMb(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} MB`;
}

function deltaColor(value: number | null | undefined): string | undefined {
  if (value == null || Number.isNaN(value) || value === 0) {
    return undefined;
  }
  // Positive delta = KPI rose after sanitization; negative = fell.
  return value > 0 ? 'success.main' : 'error.main';
}

function TelemetrySummary({ meta }: { meta: ResponseMeta }) {
  const lines = [
    { label: 'Time', value: formatMs(meta.execution_time_ms) },
    { label: 'RAM', value: formatMb(meta.peak_memory_mb) },
    { label: 'Rows', value: String(meta.rows_scanned ?? '—') },
  ];

  const queryBits = [
    meta.db_query_a_time_ms != null ? `A ${formatMs(meta.db_query_a_time_ms)}` : null,
    meta.db_query_b_time_ms != null ? `B ${formatMs(meta.db_query_b_time_ms)}` : null,
  ].filter(Boolean);

  return (
    <Stack spacing={0.25}>
      {lines.map((line) => (
        <Typography key={line.label} variant="caption" component="p" sx={{ m: 0 }}>
          <Typography component="span" variant="caption" color="text.secondary">
            {line.label}:{' '}
          </Typography>
          <Typography component="span" variant="caption" fontWeight={600}>
            {line.value}
          </Typography>
        </Typography>
      ))}
      {queryBits.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {queryBits.join(' · ')}
        </Typography>
      )}
    </Stack>
  );
}

function KpiMetricCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={denseCardContentSx}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0 }}>
          {label}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          fontWeight={700}
          color={valueColor}
          sx={{ m: 0, lineHeight: 1.25 }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Verdict strip: Baseline / Final / Network delta / Run telemetry (Phase 3). */
export function KpiCards({ result }: KpiCardsProps) {
  const delta = result.network_delta_pp;

  return (
    <Grid container spacing={0.75} alignItems="stretch" data-testid="kpi-telemetry-strip">
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard label="Baseline 5%" value={formatPct(result.baseline_top_box_pct)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard label="Final 5%" value={formatPct(result.final_top_box_pct)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard
          label="Network delta"
          value={formatDelta(delta)}
          valueColor={deltaColor(delta)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={denseCardContentSx}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0 }}>
              Run telemetry
            </Typography>
            <Box
              data-testid="run-telemetry-scroll"
              sx={{
                maxHeight: TELEMETRY_SCROLL_MAX_HEIGHT_PX,
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              <TelemetrySummary meta={result.meta} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
