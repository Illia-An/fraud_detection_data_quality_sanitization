import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useSample, useSampleDb } from '../api/hooks';
import { useUiStore } from '../store/uiStore';
import type { DataSource, SamplePreset } from '../schemas/api';
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
  resolvePeriodWindow,
} from '../schemas/period';

const SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'db', label: 'Database (Q10012)' },
  { value: 'small', label: 'Synthetic — small' },
  { value: 'medium', label: 'Synthetic — medium' },
  { value: 'stress', label: 'Synthetic — stress' },
];

export function SampleDataPanel() {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const periodPreset = useUiStore((state) => state.periodPreset);
  const customFromDate = useUiStore((state) => state.customFromDate);
  const customToDate = useUiStore((state) => state.customToDate);
  const setLastPreset = useUiStore((state) => state.setLastPreset);
  const setSurveyData = useUiStore((state) => state.setSurveyData);
  const setPeriodPreset = useUiStore((state) => state.setPeriodPreset);
  const setCustomPeriod = useUiStore((state) => state.setCustomPeriod);

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

  const resolvedWindow = resolvePeriodWindow(periodPreset, customFromDate, customToDate);

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

  const handleSourceChange = (event: SelectChangeEvent) => {
    const next = event.target.value as DataSource;
    if (next === 'db' && lastPreset === 'db') {
      void db.refetch();
      return;
    }
    if (next !== lastPreset) {
      setLastPreset(next);
    }
  };

  const handlePeriodPresetChange = (event: SelectChangeEvent) => {
    setPeriodPreset(event.target.value as PeriodPreset);
  };

  return (
    <>
      <Card variant="outlined">
        <CardHeader
          title="Survey data"
          subheader="Source for the scenario run"
          titleTypographyProps={{ variant: 'subtitle1' }}
          subheaderTypographyProps={{ variant: 'caption' }}
          action={loading ? <CircularProgress size={20} sx={{ mt: 1, mr: 0.5 }} /> : null}
          sx={{ pb: 0 }}
        />
        <CardContent>
          <Stack spacing={1.5}>
            <FormControl fullWidth size="small" disabled={loading}>
              <InputLabel id="survey-source-label">Data source</InputLabel>
              <Select
                labelId="survey-source-label"
                label="Data source"
                value={lastPreset}
                onChange={handleSourceChange}
                inputProps={{ 'aria-label': 'Data source' }}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={isSynthetic}>
              <InputLabel id="survey-period-label">Period</InputLabel>
              <Select
                labelId="survey-period-label"
                label="Period"
                value={periodPreset}
                onChange={handlePeriodPresetChange}
                inputProps={{ 'aria-label': 'Period' }}
              >
                {PERIOD_PRESET_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isSynthetic ? (
              <Typography variant="caption" color="text.secondary">
                Period applies to Database source only. Synthetic presets ignore the window.
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Process window:{' '}
                <strong>{resolvedWindow.from_date}</strong>
                {' → '}
                <strong>{resolvedWindow.to_date ?? 'latest'}</strong>
                . Click Run Scenario to apply.
              </Typography>
            )}

            {!isSynthetic && periodPreset === 'custom' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  fullWidth
                  value={customFromDate}
                  onChange={(event) =>
                    setCustomPeriod(event.target.value, customToDate)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ 'aria-label': 'Period from date' }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  fullWidth
                  value={customToDate}
                  onChange={(event) =>
                    setCustomPeriod(customFromDate, event.target.value)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ 'aria-label': 'Period to date' }}
                  helperText={customToDate ? undefined : 'Empty = through latest'}
                />
              </Stack>
            )}

            {lastPreset === 'db' && (
              <Typography
                variant="caption"
                color="text.secondary"
                component="button"
                type="button"
                onClick={() => void db.refetch()}
                disabled={loading}
                sx={{
                  alignSelf: 'flex-start',
                  border: 0,
                  background: 'none',
                  cursor: loading ? 'default' : 'pointer',
                  p: 0,
                  textDecoration: 'underline',
                  font: 'inherit',
                }}
              >
                Reload from DB
              </Typography>
            )}

            {sampleMeta ? (
              <Box>
                <Typography variant="body2">
                  <strong>{sampleMeta.preset}</strong> · {sampleMeta.row_count} rows ·{' '}
                  {sampleMeta.store_count} stores · {sampleMeta.month_count} months
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {sampleMeta.description}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Loading source, or pick a synthetic preset.
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
                      maxHeight: 240,
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
