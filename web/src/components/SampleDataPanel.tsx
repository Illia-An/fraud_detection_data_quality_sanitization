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
  Divider,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useSample, useSampleDb } from '../api/hooks';
import { useUiStore } from '../store/uiStore';
import type { DataSource, SamplePreset } from '../schemas/api';

const PRESETS: SamplePreset[] = ['small', 'medium', 'stress'];

export function SampleDataPanel() {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const setLastPreset = useUiStore((state) => state.setLastPreset);
  const setSurveyData = useUiStore((state) => state.setSurveyData);

  const isSynthetic = lastPreset !== 'db';
  const syntheticPreset: SamplePreset = isSynthetic ? lastPreset : 'small';

  const synthetic = useSample(syntheticPreset, isSynthetic);
  const db = useSampleDb({}, lastPreset === 'db');
  const lastLoadedKey = useRef<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const active = isSynthetic ? synthetic : db;
  const loading = synthetic.isFetching || db.isFetching;

  useEffect(() => {
    if (!active.isSuccess || !active.data || active.isFetching) {
      return;
    }

    const loadKey = `${active.data.preset}:${active.dataUpdatedAt}:${active.data.meta.row_count}:${active.data.meta.store_count}`;
    if (lastLoadedKey.current === loadKey) {
      return;
    }
    lastLoadedKey.current = loadKey;
    setSurveyData(active.data.rows, active.data.meta, active.data.preset as DataSource);
    setSnackbar({
      open: true,
      message: `Loaded ${active.data.meta.preset}: ${active.data.meta.row_count} rows, ${active.data.meta.store_count} stores`,
      severity: 'success',
    });
  }, [
    active.data,
    active.dataUpdatedAt,
    active.isFetching,
    active.isSuccess,
    setSurveyData,
  ]);

  useEffect(() => {
    if (isSynthetic || db.isFetching || !db.isError) {
      return;
    }
    setSnackbar({
      open: true,
      message: `${db.error instanceof Error ? db.error.message : 'Failed to load from database'}. Falling back to synthetic small.`,
      severity: 'error',
    });
    setLastPreset('small');
  }, [db.error, db.isError, db.isFetching, isSynthetic, setLastPreset]);

  useEffect(() => {
    if (!isSynthetic || !synthetic.isError || !synthetic.error) {
      return;
    }
    setSnackbar({
      open: true,
      message: synthetic.error instanceof Error ? synthetic.error.message : 'Failed to load sample data',
      severity: 'error',
    });
  }, [isSynthetic, synthetic.error, synthetic.isError]);

  const handlePresetClick = (preset: SamplePreset) => {
    if (preset !== lastPreset) {
      setLastPreset(preset);
    }
  };

  const handleLoadFromDb = () => {
    if (lastPreset === 'db') {
      void db.refetch();
      return;
    }
    setLastPreset('db');
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Survey data"
          subheader="Database first: Q10012 from 2026-01-01 through latest (PII hashed). Synthetic presets if the DB is unavailable."
          action={loading ? <CircularProgress size={24} sx={{ mt: 1, mr: 1 }} /> : null}
        />
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Database (Q10012, AnswerTime ≥ 2026-01-01)
              </Typography>
              <Button
                variant={lastPreset === 'db' ? 'contained' : 'outlined'}
                onClick={handleLoadFromDb}
                disabled={loading}
              >
                Load from DB
              </Button>
            </Box>

            <Divider />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Synthetic fallback
              </Typography>
              <ButtonGroup variant="outlined" aria-label="Sample preset">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={lastPreset === preset ? 'contained' : 'outlined'}
                    onClick={() => handlePresetClick(preset)}
                    disabled={loading}
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {preset}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>

            {sampleMeta ? (
              <Box>
                <Typography variant="body1">
                  <strong>Source:</strong> {sampleMeta.preset} · <strong>Rows:</strong>{' '}
                  {sampleMeta.row_count} · <strong>Stores:</strong> {sampleMeta.store_count} ·{' '}
                  <strong>Months:</strong> {sampleMeta.month_count}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {sampleMeta.description}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Loading Q10012 from 2026-01-01 through latest, or pick a synthetic preset.
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
