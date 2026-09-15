import { Card, CardContent, CardHeader, Grid2 as Grid, Typography } from '@mui/material';

import type { ResponseMeta } from '../schemas/api';

interface TelemetryMetaCardProps {
  meta: ResponseMeta;
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

export function TelemetryMetaCard({ meta }: TelemetryMetaCardProps) {
  const items = [
    { label: 'Execution', value: formatMs(meta.execution_time_ms) },
    { label: 'Peak RAM', value: formatMb(meta.peak_memory_mb) },
    { label: 'Rows scanned', value: String(meta.rows_scanned) },
  ];

  const dbItems = [
    meta.db_query_a_time_ms != null
      ? { label: 'Query A', value: formatMs(meta.db_query_a_time_ms) }
      : null,
    meta.db_query_b_time_ms != null
      ? { label: 'Query B', value: formatMs(meta.db_query_b_time_ms) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Card variant="outlined">
      <CardHeader
        title="Pipeline telemetry"
        subheader="SPEC §5.3 — latency / RAM / rows in Python"
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Grid container spacing={2}>
          {[...items, ...dbItems].map((item) => (
            <Grid key={item.label} size={{ xs: 6, sm: 4, md: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {item.label}
              </Typography>
              <Typography variant="h6" component="p">
                {item.value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
