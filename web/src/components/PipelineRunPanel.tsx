import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useProcess } from '../api/hooks';
import type { PipelineConfig } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import { FlaggedMonthsTable } from './FlaggedMonthsTable';
import { KpiCards } from './KpiCards';
import { PipelineStepsTable } from './PipelineStepsTable';
import { StoreImpactChart } from './StoreImpactChart';


interface PipelineRunPanelProps {
  config: PipelineConfig;
}

export function PipelineRunPanel({ config }: PipelineRunPanelProps) {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const sampleGeneration = useUiStore((state) => state.sampleGeneration);
  const processResult = useUiStore((state) => state.processResult);
  const setProcessResult = useUiStore((state) => state.setProcessResult);

  const { mutate, isPending, isError, error, data, reset } = useProcess();
  const autoRunKeyRef = useRef<number | null>(null);

  const useDbSource = lastPreset === 'db';
  const canRun = useDbSource
    ? Boolean(sampleMeta && sampleMeta.row_count > 0)
    : surveyRows.length > 0;

  useEffect(() => {
    if (data) {
      setProcessResult(data);
    }
  }, [data, setProcessResult]);

  useEffect(() => {
    if (!canRun || isPending || sampleGeneration === 0) {
      return;
    }
    if (autoRunKeyRef.current === sampleGeneration) {
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      useDbSource
        ? { source: 'db', rows: [], config }
        : { source: 'inline', rows: surveyRows, config },
    );
  }, [
    canRun,
    isPending,
    sampleGeneration,
    reset,
    mutate,
    useDbSource,
    config,
    surveyRows,
  ]);

  const handleRun = () => {
    if (!canRun) {
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      useDbSource
        ? { source: 'db', rows: [], config }
        : { source: 'inline', rows: surveyRows, config },
    );
  };

  const noData = !canRun;
  const displayResult = data ?? processResult;

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader title="Pipeline results" subheader="Run sanitization on loaded survey rows" />
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Button
              variant="contained"
              onClick={handleRun}
              disabled={isPending || noData}
              startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {isPending ? 'Running…' : 'Run pipeline'}
            </Button>
          </Box>

          {noData && (
            <Alert severity="info">Waiting for survey data (database sample or synthetic preset).</Alert>
          )}

          {isError && (
            <Alert severity="error">
              {error instanceof Error ? error.message : 'Pipeline execution failed'}
            </Alert>
          )}

          {displayResult && !isPending && (
            <>
              <KpiCards result={displayResult} />
              <StoreImpactChart
                series={displayResult.store_impact_series}
                config={config}
              />
              <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Pipeline steps
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <PipelineStepsTable steps={displayResult.steps} />
                </AccordionDetails>
              </Accordion>
              <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Flagged store×months
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <FlaggedMonthsTable rows={displayResult.high_store_months} />
                </AccordionDetails>
              </Accordion>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
