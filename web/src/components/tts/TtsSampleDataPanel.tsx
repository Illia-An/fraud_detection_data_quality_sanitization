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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useRef, useState } from 'react';

import { useTtsSample } from '../../api/hooks';
import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import type { TtsDataSource, TtsSamplePreset } from '../../schemas/tts';
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
  resolvePeriodWindow,
} from '../../schemas/period';
import { useTtsUiStore } from '../../store/ttsUiStore';

const SOURCE_KEYS: { value: TtsDataSource; labelKey: MessageKey }[] = [
  { value: 'db', labelKey: 'tts.sample.source.db' },
  { value: 'small', labelKey: 'tts.sample.source.small' },
  { value: 'medium', labelKey: 'tts.sample.source.medium' },
  { value: 'stress', labelKey: 'tts.sample.source.stress' },
];

const PERIOD_KEYS: Record<PeriodPreset, MessageKey> = {
  ytd_2026: 'sample.period.ytd2026',
  from_2025: 'sample.period.from2025',
  custom: 'sample.period.custom',
};

export function TtsSampleDataPanel() {
  const t = useT();
  const lastPreset = useTtsUiStore((state) => state.lastPreset);
  const sampleMeta = useTtsUiStore((state) => state.sampleMeta);
  const periodPreset = useTtsUiStore((state) => state.periodPreset);
  const customFromDate = useTtsUiStore((state) => state.customFromDate);
  const customToDate = useTtsUiStore((state) => state.customToDate);
  const setLastPreset = useTtsUiStore((state) => state.setLastPreset);
  const setSampleData = useTtsUiStore((state) => state.setSampleData);
  const markDbReady = useTtsUiStore((state) => state.markDbReady);
  const setPeriodPreset = useTtsUiStore((state) => state.setPeriodPreset);
  const setCustomPeriod = useTtsUiStore((state) => state.setCustomPeriod);

  const isSynthetic = lastPreset !== 'db';
  const syntheticPreset: TtsSamplePreset = isSynthetic ? lastPreset : 'small';

  const synthetic = useTtsSample(syntheticPreset, isSynthetic);
  const lastLoadedKey = useRef<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const loading = synthetic.isFetching;
  const resolvedWindow = resolvePeriodWindow(periodPreset, customFromDate, customToDate);

  useEffect(() => {
    if (!isSynthetic || !synthetic.isSuccess || !synthetic.data || synthetic.isFetching) {
      return;
    }

    const loadKey = `${synthetic.data.preset}:${synthetic.dataUpdatedAt}:${synthetic.data.meta.row_count}`;
    if (lastLoadedKey.current === loadKey) {
      return;
    }
    lastLoadedKey.current = loadKey;
    const applied = setSampleData(
      synthetic.data.rows,
      synthetic.data.meta,
      synthetic.data.preset as TtsDataSource,
      synthetic.dataUpdatedAt,
    );
    if (!applied) {
      return;
    }
    setSnackbar({
      open: true,
      message: t('tts.sample.loaded', {
        preset: synthetic.data.meta.preset,
        rows: synthetic.data.meta.row_count,
        stores: synthetic.data.meta.store_count,
      }),
      severity: 'success',
    });
  }, [
    isSynthetic,
    setSampleData,
    synthetic.data,
    synthetic.dataUpdatedAt,
    synthetic.isFetching,
    synthetic.isSuccess,
    t,
  ]);

  useEffect(() => {
    if (!isSynthetic || synthetic.isFetching || !synthetic.isError) {
      return;
    }
    setSnackbar({
      open: true,
      message: synthetic.error instanceof Error ? synthetic.error.message : t('tts.sample.loadFailed'),
      severity: 'error',
    });
  }, [isSynthetic, synthetic.error, synthetic.isError, synthetic.isFetching, t]);

  const handleSourceChange = (event: SelectChangeEvent) => {
    const next = event.target.value as TtsDataSource;
    lastLoadedKey.current = null;
    setLastPreset(next);
    if (next === 'db') {
      markDbReady({
        preset: 'db',
        row_count: 1,
        store_count: 0,
        month_count: 0,
        description: 'McKitiBump via /process-tts source=db',
      });
      setSnackbar({
        open: true,
        message: t('tts.sample.dbReady'),
        severity: 'success',
      });
    }
  };

  const handlePeriodChange = (event: SelectChangeEvent) => {
    setPeriodPreset(event.target.value as PeriodPreset);
  };

  return (
    <Card variant="outlined" data-testid="tts-sample-panel">
      <CardHeader
        title={t('tts.sample.title')}
        subheader={t('tts.sample.subheader')}
        titleTypographyProps={{ variant: 'subtitle2' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel id="tts-data-source-label">{t('tts.sample.dataSource')}</InputLabel>
            <Select
              labelId="tts-data-source-label"
              label={t('tts.sample.dataSource')}
              value={lastPreset}
              onChange={handleSourceChange}
              data-testid="tts-data-source"
            >
              {SOURCE_KEYS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {lastPreset === 'db' ? (
            <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">{t('tts.sample.periodTitle')}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="tts-period-label">{t('sample.period')}</InputLabel>
                    <Select
                      labelId="tts-period-label"
                      label={t('sample.period')}
                      value={periodPreset}
                      onChange={handlePeriodChange}
                      data-testid="tts-period-preset"
                    >
                      {PERIOD_PRESET_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {t(PERIOD_KEYS[opt.value])}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {periodPreset === 'custom' ? (
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        type="date"
                        label={t('sample.from')}
                        value={customFromDate}
                        onChange={(e) => setCustomPeriod(e.target.value, customToDate)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        type="date"
                        label={t('sample.to')}
                        value={customToDate}
                        onChange={(e) => setCustomPeriod(customFromDate, e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    </Stack>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    {t('tts.sample.periodHint', {
                      from: resolvedWindow.from_date,
                      to: resolvedWindow.to_date ?? '…',
                    })}
                  </Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : null}

          <Box sx={{ minHeight: 24 }}>
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption">{t('tts.sample.loading')}</Typography>
              </Stack>
            ) : sampleMeta ? (
              <Typography variant="caption" color="text.secondary" data-testid="tts-sample-meta">
                {lastPreset === 'db'
                  ? t('tts.sample.dbMeta')
                  : t('tts.sample.meta', {
                      rows: sampleMeta.row_count,
                      stores: sampleMeta.store_count,
                      months: sampleMeta.month_count,
                    })}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('tts.sample.waiting')}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}
