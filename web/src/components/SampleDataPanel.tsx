import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useSample } from '../api/hooks';
import { useUiStore } from '../store/uiStore';
import type { SamplePreset } from '../schemas/api';

const PRESETS: SamplePreset[] = ['small', 'medium', 'stress'];

export function SampleDataPanel() {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const setLastPreset = useUiStore((state) => state.setLastPreset);
  const setSurveyData = useUiStore((state) => state.setSurveyData);

  const { data, isFetching, isError, error, isSuccess } = useSample(lastPreset);
  const lastLoadedKey = useRef<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (!isSuccess || !data || isFetching) {
      return;
    }

    const loadKey = `${data.preset}:${data.meta.row_count}:${data.meta.store_count}`;
    setSurveyData(data.rows, data.meta, data.preset as SamplePreset);

    if (lastLoadedKey.current !== loadKey) {
      lastLoadedKey.current = loadKey;
      setSnackbar({
        open: true,
        message: `Loaded ${data.meta.preset}: ${data.meta.row_count} rows, ${data.meta.store_count} stores`,
        severity: 'success',
      });
    }
  }, [data, isFetching, isSuccess, setSurveyData]);

  useEffect(() => {
    if (!isError || !error) {
      return;
    }
    setSnackbar({
      open: true,
      message: error instanceof Error ? error.message : 'Failed to load sample data',
      severity: 'error',
    });
  }, [error, isError]);

  const handlePresetClick = (preset: SamplePreset) => {
    if (preset !== lastPreset) {
      setLastPreset(preset);
    }
  };

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Survey data"
          subheader="Synthetic presets from research scenarios"
          action={isFetching ? <CircularProgress size={24} sx={{ mt: 1, mr: 1 }} /> : null}
        />
        <CardContent>
          <Stack spacing={2}>
            <ButtonGroup variant="outlined" aria-label="Sample preset">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant={lastPreset === preset ? 'contained' : 'outlined'}
                  onClick={() => handlePresetClick(preset)}
                  disabled={isFetching}
                  sx={{ textTransform: 'capitalize' }}
                >
                  {preset}
                </Button>
              ))}
            </ButtonGroup>

            {sampleMeta ? (
              <Box>
                <Typography variant="body1">
                  <strong>Preset:</strong> {sampleMeta.preset} · <strong>Rows:</strong>{' '}
                  {sampleMeta.row_count} · <strong>Stores:</strong> {sampleMeta.store_count} ·{' '}
                  <strong>Months:</strong> {sampleMeta.month_count}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {sampleMeta.description}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a preset to load synthetic survey rows.
              </Typography>
            )}

            {lastPreset === 'small' && surveyRows.length > 0 && (
              <Accordion disableGutters>
                <AccordionSummary>
                  <Typography variant="body2">JSON preview ({surveyRows.length} rows)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.5,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 320,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(surveyRows, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'success' ? 4000 : 6000}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
