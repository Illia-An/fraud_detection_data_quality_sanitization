import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useEffect } from 'react';

import {
  configFormSchema,
  defaultConfigFormValues,
  toPipelineConfig,
  type ConfigFormValues,
} from '../schemas/configForm';
import type { PipelineConfig } from '../schemas/api';

interface ConfigFormProps {
  onValidConfigChange?: (config: PipelineConfig) => void;
}

export function ConfigForm({ onValidConfigChange }: ConfigFormProps) {
  const {
    control,
    register,
    formState: { errors, isValid },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: defaultConfigFormValues,
    mode: 'onChange',
  });

  const values = useWatch({ control });

  useEffect(() => {
    if (!isValid || !values) {
      return;
    }
    const parsed = configFormSchema.safeParse(values);
    if (!parsed.success) {
      return;
    }
    onValidConfigChange?.(toPipelineConfig(parsed.data));
  }, [values, isValid, onValidConfigChange]);

  const tier2Enabled = values?.tier2?.enabled ?? true;
  const tier3Enabled = values?.tier3?.enabled ?? false;

  return (
    <Card>
      <CardHeader title="Pipeline configuration" subheader="Tier 1 / 2 / 3 thresholds" />
      <CardContent>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          divider={<Divider flexItem orientation="vertical" />}
          spacing={3}
          sx={{ alignItems: 'stretch' }}
        >
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" component="h3">
              Tier 1 — deterministic
            </Typography>
            <Controller
              name="tier1.enable_blacklist"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 1 BlackList filter' }}
                    />
                  }
                  label="BlackList filter (keep לא)"
                />
              )}
            />
            <Controller
              name="tier1.enable_freq_store_day"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 1 freq store day' }}
                    />
                  }
                  label="Freq ≥ N / store×day"
                />
              )}
            />
            <Controller
              name="tier1.enable_always_topbox"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 1 always top-box' }}
                    />
                  }
                  label="Always top-box (optional)"
                />
              )}
            />
            <TextField
              label="Freq threshold"
              type="number"
              size="small"
              {...register('tier1.freq_store_day_min', { valueAsNumber: true })}
              error={Boolean(errors.tier1?.freq_store_day_min)}
              helperText={errors.tier1?.freq_store_day_min?.message}
              slotProps={{ htmlInput: { min: 2, max: 20 } }}
            />
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" component="h3">
              Tier 2 — store×month
            </Typography>
            <Controller
              name="tier2.enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 2 enabled' }}
                    />
                  }
                  label="Enabled"
                />
              )}
            />
            <TextField
              label="Min volume"
              type="number"
              size="small"
              disabled={!tier2Enabled}
              {...register('tier2.min_volume', { valueAsNumber: true })}
              error={Boolean(errors.tier2?.min_volume)}
              helperText={errors.tier2?.min_volume?.message}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label="Z high"
              type="number"
              size="small"
              disabled={!tier2Enabled}
              {...register('tier2.z_high', { valueAsNumber: true })}
              error={Boolean(errors.tier2?.z_high)}
              helperText={errors.tier2?.z_high?.message}
              slotProps={{ htmlInput: { min: 0.5, max: 5, step: 0.1 } }}
            />
            <TextField
              label="Five % min"
              type="number"
              size="small"
              disabled={!tier2Enabled}
              {...register('tier2.five_pct_min', { valueAsNumber: true })}
              error={Boolean(errors.tier2?.five_pct_min)}
              helperText={errors.tier2?.five_pct_min?.message}
              slotProps={{ htmlInput: { min: 50, max: 100 } }}
            />
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" component="h3">
              Tier 3 — IsolationForest
            </Typography>
            <Controller
              name="tier3.enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 3 enabled' }}
                    />
                  }
                  label="Enabled"
                />
              )}
            />
            <Controller
              name="tier3.contamination"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Contamination"
                  type="number"
                  size="small"
                  disabled={!tier3Enabled}
                  value={field.value}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  error={Boolean(errors.tier3?.contamination)}
                  helperText={errors.tier3?.contamination?.message}
                  slotProps={{ htmlInput: { min: 0.001, max: 0.1, step: 0.001 } }}
                />
              )}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
