import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import type { PlanMonitoringInsights, MonitorSignal } from '../schemas/planMonitoring';
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../schemas/planMonitoring';
import { periodLabel } from '../schemas/plan';

interface PlanMonitoringPanelProps {
  insights: PlanMonitoringInsights;
  asOfOptions: { year: number; month: number }[];
  onAsOfChange: (year: number, month: number) => void;
  onStoreClick?: (storeId: number) => void;
  /** When false, hide the store table (delta list is primary). Default true. */
  showStoreTable?: boolean;
}

function SignalChip({ signal, count }: { signal: MonitorSignal; count: number }) {
  return (
    <Chip
      size="small"
      label={`${SIGNAL_LABELS[signal]} · ${count}`}
      sx={{ bgcolor: SIGNAL_COLORS[signal], color: '#fff' }}
    />
  );
}

export function PlanMonitoringPanel({
  insights,
  asOfOptions,
  onAsOfChange,
  onStoreClick,
  showStoreTable = true,
}: PlanMonitoringPanelProps) {
  const asOfValue = periodLabel(insights.as_of_year, insights.as_of_month);
  const plotted = insights.stores.filter(
    (row) => row.planned != null && row.actual != null && row.deviation != null,
  );

  const xs = plotted.map((row) => row.planned!);
  const ys = plotted.map((row) => row.actual!);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 100;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 100;
  const pad = 8;
  const width = 320;
  const height = 200;

  const toX = (v: number) =>
    pad + ((v - minX) / Math.max(maxX - minX, 1e-6)) * (width - pad * 2);
  const toY = (v: number) =>
    height - pad - ((v - minY) / Math.max(maxY - minY, 1e-6)) * (height - pad * 2);

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="as-of-label">As of</InputLabel>
          <Select
            labelId="as-of-label"
            label="As of"
            value={asOfValue}
            onChange={(event) => {
              const [y, m] = event.target.value.split('-').map(Number);
              onAsOfChange(y, m);
            }}
          >
            {asOfOptions.map((opt) => (
              <MenuItem key={periodLabel(opt.year, opt.month)} value={periodLabel(opt.year, opt.month)}>
                {periodLabel(opt.year, opt.month)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <SignalChip signal="ahead_of_plan" count={insights.summary.ahead} />
          <SignalChip signal="on_plan" count={insights.summary.on_plan} />
          <SignalChip signal="behind_plan" count={insights.summary.behind} />
          <SignalChip signal="insufficient_history" count={insights.summary.insufficient} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Chain:{' '}
          {insights.chain.planned == null ? '—' : `${insights.chain.planned.toFixed(1)}%`} plan ·{' '}
          {insights.chain.actual == null ? '—' : `${insights.chain.actual.toFixed(1)}%`} actual
          {insights.chain.on_track == null
            ? ''
            : insights.chain.on_track
              ? ' · on track'
              : ' · off track'}
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Planned vs actual (as of) · band ±{insights.band_pp.toFixed(1)} pp
            {onStoreClick ? ' · click store → sandbox draft' : ''}
          </Typography>
          {plotted.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ width, height, p: 2 }}>
              No overlapping actuals for this as-of month in the cleansed panel.
            </Typography>
          ) : (
            <svg width={width} height={height} role="img" aria-label="Plan vs actual scatter">
              <line
                x1={pad}
                y1={height - pad}
                x2={width - pad}
                y2={pad}
                stroke="#bdbdbd"
                strokeDasharray="4 4"
              />
              {plotted.map((row) => (
                <circle
                  key={row.store_id}
                  cx={toX(row.planned!)}
                  cy={toY(row.actual!)}
                  r={6}
                  fill={SIGNAL_COLORS[row.signal]}
                  style={{ cursor: onStoreClick ? 'pointer' : 'default' }}
                  onClick={() => onStoreClick?.(row.store_id)}
                >
                  <title>
                    Store {row.store_id}: plan {row.planned!.toFixed(1)} / actual{' '}
                    {row.actual!.toFixed(1)} ({SIGNAL_LABELS[row.signal]}) — click for sandbox
                  </title>
                </circle>
              ))}
            </svg>
          )}
        </Box>

        {showStoreTable && (
          <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Store</TableCell>
                  <TableCell align="right">Plan</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Δ pp</TableCell>
                  <TableCell>Signal</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {insights.stores.map((row) => (
                  <TableRow
                    key={row.store_id}
                    hover={Boolean(onStoreClick)}
                    sx={{ cursor: onStoreClick ? 'pointer' : 'default' }}
                    onClick={() => onStoreClick?.(row.store_id)}
                  >
                    <TableCell>{row.store_id}</TableCell>
                    <TableCell align="right">
                      {row.planned == null ? '—' : row.planned.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">
                      {row.actual == null ? '—' : row.actual.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">
                      {row.deviation == null
                        ? '—'
                        : `${row.deviation > 0 ? '+' : ''}${row.deviation.toFixed(1)}`}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={SIGNAL_LABELS[row.signal]}
                        sx={{ bgcolor: SIGNAL_COLORS[row.signal], color: '#fff' }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
