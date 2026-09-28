import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import {
  PIPELINE_STEP_LABELS,
  sortPipelineSteps,
  type ProcessResponse,
} from '../../schemas/api';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

interface PlannerBaselineBadgeProps {
  panel: SanitizedPanel | null;
  processResult: ProcessResponse | null;
  baselineReady: boolean;
}

/** V4.2 — Baseline gate badge + lightweight sanitization audit popover. */
export function PlannerBaselineBadge({
  panel,
  processResult,
  baselineReady,
}: PlannerBaselineBadgeProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const steps = processResult ? sortPipelineSteps(processResult.steps) : [];
  const rowsLabel =
    processResult?.meta?.rows_scanned != null
      ? `${processResult.meta.rows_scanned.toLocaleString()} rows scanned`
      : panel
        ? `${panel.row_count} panel cells`
        : '—';

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <Chip
        size="small"
        color={baselineReady ? 'success' : 'default'}
        label={
          baselineReady
            ? `Baseline: Cleansed Q10012 · ${rowsLabel}`
            : 'Baseline: Missing — run Sanitization'
        }
      />
      {baselineReady && (
        <IconButton
          size="small"
          aria-label="Baseline sanitization audit"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      )}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 320 }}>
          <Typography variant="subtitle2" gutterBottom>
            Sanitization audit
          </Typography>
          {steps.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No pipeline steps in the last process result.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {steps.map((step) => (
                <Stack
                  key={step.step_name}
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Typography variant="caption">
                    {PIPELINE_STEP_LABELS[step.step_name] ?? step.step_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    drop {step.rows_dropped}
                    {step.top_box_pct != null ? ` · ${step.top_box_pct.toFixed(1)}%` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {panel && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Panel {panel.row_count} store×month · period {panel.period_start ?? '—'}
              {panel.period_end ? ` → ${panel.period_end}` : ''}
            </Typography>
          )}
        </Box>
      </Popover>
    </Stack>
  );
}
