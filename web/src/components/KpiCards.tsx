import { Card, CardContent, Grid2 as Grid, Typography } from '@mui/material';

import type { ProcessResponse } from '../schemas/api';

interface KpiCardsProps {
  result: ProcessResponse;
}

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

export function KpiCards({ result }: KpiCardsProps) {
  const items = [
    { label: 'Baseline 5%', value: formatPct(result.baseline_top_box_pct) },
    { label: 'Final 5%', value: formatPct(result.final_top_box_pct) },
    { label: 'Network delta', value: formatDelta(result.network_delta_pp) },
  ];

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {item.label}
              </Typography>
              <Typography variant="h5" component="p">
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
