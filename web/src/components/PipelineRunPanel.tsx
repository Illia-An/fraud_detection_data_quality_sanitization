import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
} from '@mui/material';
import { useEffect } from 'react';

import { useProcess } from '../api/hooks';
import type { PipelineConfig } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import { KpiCards } from './KpiCards';
import { StoreImpactChart } from './StoreImpactChart';

interface PipelineRunPanelProps {
  config: PipelineConfig;
}

export function PipelineRunPanel({ config }: PipelineRunPanelProps) {
  const surveyRows = useUiStore((state) => state.surveyRows);
  const processResult = useUiStore((state) => state.processResult);
  const setProcessResult = useUiStore((state) => state.setProcessResult);

  const { mutate, isPending, isError, error, data, reset } = useProcess();

  useEffect(() => {
    if (data) {
      setProcessResult(data);
    }
  }, [data, setProcessResult]);

  const handleRun = () => {
    if (!surveyRows.length) {
      return;
    }
    reset();
    mutate({ rows: surveyRows, config });
  };

  const noData = surveyRows.length === 0;
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
            <Alert severity="info">Load a sample preset before running the pipeline.</Alert>
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
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
