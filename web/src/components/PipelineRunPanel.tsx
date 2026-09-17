import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid2';
import { useMemo, useState } from 'react';

import type { PipelineRunner } from '../hooks/usePipelineRunner';
import { FlaggedMonthsTable } from './FlaggedMonthsTable';
import { KpiCards } from './KpiCards';
import { PipelineStepsTable, summarizeLargestDelta } from './PipelineStepsTable';
import { StoreImpactChart } from './StoreImpactChart';

/** Collapsed accordion summary height reserved so explore content is not covered on md. */
const STEPS_SUMMARY_RESERVE_PX = 52;
/** Expanded overlay cap on md — scrolls internally; chart underneath does not move. */
const STEPS_OVERLAY_MAX_HEIGHT = '45vh';

interface PipelineRunPanelProps {
  runner: PipelineRunner;
}

export function PipelineRunPanel({ runner }: PipelineRunPanelProps) {
  const { noData, isPending, isError, error, displayResult } = runner;
  const [stepsExpanded, setStepsExpanded] = useState(false);

  const largestDeltaHint = useMemo(
    () => (displayResult ? summarizeLargestDelta(displayResult.steps) : null),
    [displayResult],
  );

  const showResults = Boolean(displayResult && !isPending);

  return (
    <Box
      sx={{
        position: 'relative',
        flex: { md: 1 },
        width: '100%',
        height: { md: '100%' },
        minHeight: { md: 0 },
        overflow: { md: 'hidden' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack
        spacing={1}
        sx={{
          flex: { md: 1 },
          minHeight: { md: 0 },
          overflowY: { xs: 'visible', md: 'auto' },
          overflowX: 'hidden',
          pb: showResults ? { md: `${STEPS_SUMMARY_RESERVE_PX}px` } : 0,
        }}
      >
        {noData && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Waiting for survey data (database sample or synthetic preset).
          </Alert>
        )}

        {isError && (
          <Alert severity="error" sx={{ py: 0.5 }}>
            {error instanceof Error ? error.message : 'Pipeline execution failed'}
          </Alert>
        )}

        {showResults && displayResult && (
          <>
            <KpiCards result={displayResult} />

            <Grid container spacing={1.5} alignItems="stretch" data-testid="explore-split">
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ height: '100%' }}>
                  <StoreImpactChart
                    series={displayResult.store_impact_series}
                    highStoreMonths={displayResult.high_store_months}
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ height: '100%' }}>
                  <FlaggedMonthsTable
                    rows={displayResult.high_store_months}
                    variant="panel"
                  />
                </Box>
              </Grid>
            </Grid>
          </>
        )}

        {isPending && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Running scenario…
          </Alert>
        )}
      </Stack>

      {showResults && displayResult && (
        <Box
          data-testid="pipeline-steps-overlay"
          sx={{
            // xs: normal flow under explore. md: bottom overlay over the pane.
            position: { xs: 'relative', md: 'absolute' },
            left: { md: 0 },
            right: { md: 0 },
            bottom: { md: 0 },
            zIndex: { md: 3 },
            flexShrink: 0,
            maxHeight: { md: STEPS_OVERLAY_MAX_HEIGHT },
            overflow: { md: 'auto' },
            mt: { xs: 1, md: 0 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: { md: stepsExpanded ? 8 : 2 },
          }}
        >
          <Accordion
            disableGutters
            expanded={stepsExpanded}
            onChange={(_event, expanded) => setStepsExpanded(expanded)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, py: 0 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Pipeline steps funnel
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {largestDeltaHint
                    ? `Largest Δ vs prev: ${largestDeltaHint}`
                    : 'Row counts, top-box %, and Δ vs previous stage'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1 }}>
              <PipelineStepsTable steps={displayResult.steps} />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
}
