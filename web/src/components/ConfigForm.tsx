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

  return (
    <Card variant="outlined">
      <CardHeader
        title="Pipeline configuration"
        subheader="Four-tier thresholds (SPEC)"
        titleTypographyProps={{ variant: 'subtitle1' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              Tier 1 — BlackList
            </Typography>
            <Controller
              name="tier1_blacklist_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 1 BlackList filter' }}
                    />
                  }
                  label="BlackList filter (keep לא)"
                />
              )}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              Tier 2 — Frequency
            </Typography>
            <Controller
              name="tier2_freq_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 2 frequency filter' }}
                    />
                  }
                  label="Frequency (entity×store×day)"
                />
              )}
            />
            <TextField
              label="Freq threshold"
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier2_freq_enabled}
              {...register('tier2_freq_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier2_freq_threshold)}
              helperText={errors.tier2_freq_threshold?.message}
              slotProps={{ htmlInput: { min: 2, max: 20 } }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              Tier 3 — Always top-box
            </Typography>
            <Controller
              name="tier3_always_five_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 3 always top-box' }}
                    />
                  }
                  label="Always top-box (optional)"
                />
              )}
            />
            <TextField
              label="Always-5 min n"
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier3_always_five_enabled}
              {...register('tier3_always_five_min_n', { valueAsNumber: true })}
              error={Boolean(errors.tier3_always_five_min_n)}
              helperText={errors.tier3_always_five_min_n?.message}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              Tier 4 — store×month
            </Typography>
            <Controller
              name="tier4_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': 'Tier 4 store-month filter' }}
                    />
                  }
                  label="Store×month anomaly"
                />
              )}
            />
            <TextField
              label="Min volume"
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_min_volume', { valueAsNumber: true })}
              error={Boolean(errors.tier4_min_volume)}
              helperText={errors.tier4_min_volume?.message}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label="Z high"
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_z_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier4_z_threshold)}
              helperText={errors.tier4_z_threshold?.message}
              slotProps={{ htmlInput: { min: 0, max: 5, step: 0.1 } }}
            />
            <TextField
              label="Five % min"
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_pct_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier4_pct_threshold)}
              helperText={errors.tier4_pct_threshold?.message}
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
