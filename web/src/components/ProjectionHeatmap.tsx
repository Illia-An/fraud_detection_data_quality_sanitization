import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import type { FivePercentPlan, MonthScore } from '../schemas/plan';
import {
  collectHeatmapScores,
  heatmapCellColor,
  periodLabel,
} from '../schemas/plan';

interface ProjectionHeatmapProps {
  plan: FivePercentPlan;
  selectedStoreIds: number[];
  onToggleStore: (storeId: number) => void;
}

function scoreForPeriod(
  months: MonthScore[],
  year: number,
  month: number,
): number | null {
  const hit = months.find((m) => m.year === year && m.month === month);
  return hit?.score ?? null;
}

export function ProjectionHeatmap({
  plan,
  selectedStoreIds,
  onToggleStore,
}: ProjectionHeatmapProps) {
  const periods = plan.chain_trajectory;
  const scores = collectHeatmapScores(plan);
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 100;
  const filterActive = selectedStoreIds.length > 0;
  const projections = filterActive
    ? plan.projections.filter((p) => selectedStoreIds.includes(p.store_id))
    : plan.projections;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
        {plan.projections.map((projection) => (
          <Chip
            key={projection.store_id}
            label={String(projection.store_id)}
            size="small"
            color={selectedStoreIds.includes(projection.store_id) ? 'primary' : 'default'}
            variant={selectedStoreIds.includes(projection.store_id) ? 'filled' : 'outlined'}
            onClick={() => onToggleStore(projection.store_id)}
          />
        ))}
      </Stack>
      <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
              {periods.map((period) => (
                <TableCell key={periodLabel(period.year, period.month)} align="center">
                  {periodLabel(period.year, period.month)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Chain</TableCell>
              {periods.map((period) => {
                const score = scoreForPeriod(plan.chain_trajectory, period.year, period.month);
                return (
                  <TableCell
                    key={`chain-${periodLabel(period.year, period.month)}`}
                    align="center"
                    sx={{ bgcolor: heatmapCellColor(score, min, max), fontWeight: 600 }}
                  >
                    {score == null ? '—' : score.toFixed(1)}
                  </TableCell>
                );
              })}
            </TableRow>
            {projections.map((projection) => (
              <TableRow key={projection.store_id}>
                <TableCell sx={{ fontWeight: 600 }}>{projection.store_id}</TableCell>
                {periods.map((period) => {
                  const score = scoreForPeriod(projection.months, period.year, period.month);
                  return (
                    <TableCell
                      key={`${projection.store_id}-${periodLabel(period.year, period.month)}`}
                      align="center"
                      sx={{ bgcolor: heatmapCellColor(score, min, max) }}
                    >
                      {score == null ? '—' : score.toFixed(1)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Green = higher score (better). Click store chips to filter rows (none selected = all).
      </Typography>
    </Stack>
  );
}
