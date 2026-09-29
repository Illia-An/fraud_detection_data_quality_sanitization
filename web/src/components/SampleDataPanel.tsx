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
import { useT } from '../i18n';
import type { MessageKey } from '../i18n';
import { useUiStore } from '../store/uiStore';
import type { DataSource, SamplePreset } from '../schemas/api';
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
  resolvePeriodWindow,
} from '../schemas/period';

const SOURCE_KEYS: { value: DataSource; labelKey: MessageKey }[] = [
  { value: 'db', labelKey: 'sample.source.db' },
  { value: 'small', labelKey: 'sample.source.small' },
  { value: 'medium', labelKey: 'sample.source.medium' },
  { value: 'stress', labelKey: 'sample.source.stress' },
];

const PERIOD_KEYS: Record<PeriodPreset, MessageKey> = {
  ytd_2026: 'sample.period.ytd2026',
  from_2025: 'sample.period.from2025',
  custom: 'sample.period.custom',
};

export function SampleDataPanel() {
  const t = useT();
  const lastPreset = useUiStore((state) => state.lastPreset);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const periodPreset = useUiStore((state) => state.periodPreset);
  const customFromDate = useUiStore((state) => state.customFromDate);
  const customToDate = useUiStore((state) => state.customToDate);
  const setLastPreset = useUiStore((state) => state.setLastPreset);
  const setSurveyData = useUiStore((state) => state.setSurveyData);
  const beginSampleReload = useUiStore((state) => state.beginSampleReload);
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
    const applied = setSurveyData(
      active.data.rows,
      active.data.meta,
      active.data.preset as DataSource,
      active.dataUpdatedAt,
    );
    // Skip snackbar when store rejected a duplicate (remount / cached query).
    if (!applied) {
      return;
    }
    setSnackbar({
      open: true,
      message: t('sample.loaded', {
        preset: active.data.meta.preset,
        rows: active.data.meta.row_count,
        stores: active.data.meta.store_count,
      }),
      severity: 'success',
    });
  }, [
    active.data,
    active.dataUpdatedAt,
    active.isFetching,
    active.isSuccess,
    setSurveyData,
    t,
  ]);

  useEffect(() => {
    if (isSynthetic || db.isFetching || !db.isError) {
      return;
    }
    const errorMsg =
      db.error instanceof Error ? db.error.message : t('sample.dbFailDefault');
    setSnackbar({
      open: true,
      message: t('sample.dbFailFallback', { error: errorMsg }),
      severity: 'error',
    });
    setLastPreset('small');
  }, [db.error, db.isError, db.isFetching, isSynthetic, setLastPreset, t]);

  useEffect(() => {
    if (!isSynthetic || !synthetic.isError || !synthetic.error) {
      return;
    }
    setSnackbar({
      open: true,
      message:
        synthetic.error instanceof Error
          ? synthetic.error.message
          : t('sample.sampleFailDefault'),
      severity: 'error',
    });
  }, [isSynthetic, synthetic.error, synthetic.isError, t]);

  const handleSourceChange = (event: SelectChangeEvent) => {
    const next = event.target.value as DataSource;
    if (next === 'db' && lastPreset === 'db') {
      beginSampleReload();
      lastLoadedKey.current = null;
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
          title={t('sample.title')}
          subheader={t('sample.subheader')}
          titleTypographyProps={{ variant: 'subtitle1' }}
          subheaderTypographyProps={{ variant: 'caption' }}
          action={loading ? <CircularProgress size={20} sx={{ mt: 1, mr: 0.5 }} /> : null}
          sx={{ pb: 0 }}
        />
        <CardContent>
          <Stack spacing={1.5}>
            <FormControl fullWidth size="small" disabled={loading}>
              <InputLabel id="survey-source-label">{t('sample.dataSource')}</InputLabel>
              <Select
                labelId="survey-source-label"
                label={t('sample.dataSource')}
                value={lastPreset}
                onChange={handleSourceChange}
                inputProps={{ 'aria-label': t('sample.dataSource') }}
              >
                {SOURCE_KEYS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={isSynthetic}>
              <InputLabel id="survey-period-label">{t('sample.period')}</InputLabel>
              <Select
                labelId="survey-period-label"
                label={t('sample.period')}
                value={periodPreset}
                onChange={handlePeriodPresetChange}
                inputProps={{ 'aria-label': t('sample.period') }}
              >
                {PERIOD_PRESET_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {t(PERIOD_KEYS[option.value])}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isSynthetic ? (
              <Typography variant="caption" color="text.secondary">
                {t('sample.periodSyntheticHint')}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('sample.processWindow', {
                  from: resolvedWindow.from_date,
                  to: resolvedWindow.to_date ?? t('common.latest'),
                })}
              </Typography>
            )}

            {!isSynthetic && periodPreset === 'custom' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label={t('sample.from')}
                  type="date"
                  size="small"
                  fullWidth
                  value={customFromDate}
                  onChange={(event) =>
                    setCustomPeriod(event.target.value, customToDate)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ 'aria-label': t('sample.fromAria') }}
                />
                <TextField
                  label={t('sample.to')}
                  type="date"
                  size="small"
                  fullWidth
                  value={customToDate}
                  onChange={(event) =>
                    setCustomPeriod(customFromDate, event.target.value)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ 'aria-label': t('sample.toAria') }}
                  helperText={customToDate ? undefined : t('sample.toEmptyHint')}
                />
              </Stack>
            )}

            {lastPreset === 'db' && (
              <Typography
                variant="caption"
                color="text.secondary"
                component="button"
                type="button"
                onClick={() => {
                  beginSampleReload();
                  lastLoadedKey.current = null;
                  void db.refetch();
                }}
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
                {t('sample.reloadDb')}
              </Typography>
            )}

            {sampleMeta ? (
              <Box>
                <Typography variant="body2">
                  {t('sample.metaLine', {
                    preset: sampleMeta.preset,
                    rows: sampleMeta.row_count,
                    stores: sampleMeta.store_count,
                    months: sampleMeta.month_count,
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {sampleMeta.description}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('sample.loadingHint')}
              </Typography>
            )}

            {lastPreset === 'small' && surveyRows.length > 0 && (
              <Accordion disableGutters>
                <AccordionSummary>
                  <Typography variant="body2">
                    {t('sample.jsonPreview', { count: surveyRows.length })}
                  </Typography>
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
