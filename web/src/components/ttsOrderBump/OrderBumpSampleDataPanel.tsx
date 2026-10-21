import {
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
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useOrderBumpSample } from '../../api/hooks';
import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import {
  orderBumpPresetSchema,
  type OrderBumpPreset,
} from '../../schemas/ttsOrderBump';
import { useOrderBumpUiStore } from '../../store/ttsOrderBumpUiStore';

const SOURCE_KEYS: { value: OrderBumpPreset; labelKey: MessageKey }[] = [
  { value: 'small', labelKey: 'ttsOrder.sample.source.small' },
  { value: 'medium', labelKey: 'ttsOrder.sample.source.medium' },
  { value: 'stress', labelKey: 'ttsOrder.sample.source.stress' },
];

export function OrderBumpSampleDataPanel() {
  const t = useT();
  const lastPreset = useOrderBumpUiStore((s) => s.lastPreset);
  const sampleMeta = useOrderBumpUiStore((s) => s.sampleMeta);
  const setLastPreset = useOrderBumpUiStore((s) => s.setLastPreset);
  const setSampleData = useOrderBumpUiStore((s) => s.setSampleData);

  const sample = useOrderBumpSample(lastPreset, true);
  const lastLoadedKey = useRef<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (!sample.isSuccess || !sample.data || sample.isFetching) {
      return;
    }
    const loadKey = `${sample.data.preset}:${sample.dataUpdatedAt}:${sample.data.meta.row_count}`;
    if (lastLoadedKey.current === loadKey) {
      return;
    }
    lastLoadedKey.current = loadKey;
    const applied = setSampleData(
      sample.data.rows,
      sample.data.meta,
      sample.data.preset as OrderBumpPreset,
      sample.dataUpdatedAt,
    );
    if (!applied) {
      return;
    }
    setSnackbar({
      open: true,
      message: t('ttsOrder.sample.loaded', {
        preset: sample.data.meta.preset,
        rows: sample.data.meta.row_count,
        orders: sample.data.meta.order_count,
        stores: sample.data.meta.store_count,
      }),
      severity: 'success',
    });
  }, [
    sample.data,
    sample.dataUpdatedAt,
    sample.isFetching,
    sample.isSuccess,
    setSampleData,
    t,
  ]);

  useEffect(() => {
    if (sample.isFetching || !sample.isError) {
      return;
    }
    setSnackbar({
      open: true,
      message:
        sample.error instanceof Error
          ? sample.error.message
          : t('ttsOrder.sample.loadFailed'),
      severity: 'error',
    });
  }, [sample.error, sample.isError, sample.isFetching, t]);

  const handleSourceChange = (event: SelectChangeEvent) => {
    const next = orderBumpPresetSchema.parse(event.target.value);
    lastLoadedKey.current = null;
    setLastPreset(next);
  };

  return (
    <Card variant="outlined" data-testid="tts-order-sample-panel">
      <CardHeader
        title={t('ttsOrder.sample.title')}
        subheader={t('ttsOrder.sample.subheader')}
        titleTypographyProps={{ variant: 'subtitle2' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <Alert severity="info" sx={{ py: 0.5 }} data-testid="tts-order-synthetic-banner">
            {t('ttsOrder.bannerShort')}
          </Alert>
          <FormControl size="small" fullWidth>
            <InputLabel id="tts-order-data-source-label">
              {t('ttsOrder.sample.dataSource')}
            </InputLabel>
            <Select
              labelId="tts-order-data-source-label"
              label={t('ttsOrder.sample.dataSource')}
              value={lastPreset}
              onChange={handleSourceChange}
              data-testid="tts-order-data-source"
            >
              {SOURCE_KEYS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ minHeight: 24 }}>
            {sample.isFetching ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption">{t('ttsOrder.sample.loading')}</Typography>
              </Stack>
            ) : sampleMeta ? (
              <Typography
                variant="caption"
                color="text.secondary"
                data-testid="tts-order-sample-meta"
              >
                {t('ttsOrder.sample.meta', {
                  rows: sampleMeta.row_count,
                  orders: sampleMeta.order_count,
                  stores: sampleMeta.store_count,
                  months: sampleMeta.month_count,
                })}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('ttsOrder.sample.waiting')}
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
