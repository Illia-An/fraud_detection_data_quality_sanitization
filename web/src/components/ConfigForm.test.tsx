import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { ConfigForm } from './ConfigForm';
import { toPipelineConfig } from '../schemas/configForm';
import { configFormSchema, defaultConfigFormValues } from '../schemas/configForm';
import { pipelineConfigSchema } from '../schemas/api';

function renderConfigForm(onValidConfigChange = vi.fn()) {
  return {
    onValidConfigChange,
    ...render(
      <ThemeProvider theme={appTheme}>
        <ConfigForm onValidConfigChange={onValidConfigChange} />
      </ThemeProvider>,
    ),
  };
}

describe('ConfigForm', () => {
  it('renders tier sections and default fields', () => {
    renderConfigForm();

    expect(screen.getByText('Pipeline configuration')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tier 1/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tier 2/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Tier 3/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tier 1 frequency filter')).toBeChecked();
    expect(screen.getByLabelText('Freq threshold')).toHaveValue(3);
    expect(screen.getByLabelText('Min volume')).toHaveValue(30);
    expect(screen.queryByRole('checkbox', { name: 'Tier 2 enabled' })).not.toBeInTheDocument();
  });

  it('disables freq threshold input when frequency filter is off', async () => {
    renderConfigForm();

    const freqSwitch = screen.getByLabelText('Tier 1 frequency filter');
    fireEvent.click(freqSwitch);

    await waitFor(() => {
      expect(screen.getByLabelText('Freq threshold')).toBeDisabled();
    });
  });

  it('emits flat SPEC PipelineConfig when freq threshold changes', async () => {
    const onValidConfigChange = vi.fn();
    renderConfigForm(onValidConfigChange);

    const freq = screen.getByLabelText('Freq threshold');
    fireEvent.change(freq, { target: { value: '5' } });

    await waitFor(() => {
      const lastCall = onValidConfigChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.tier1_freq_threshold).toBe(5);
      expect(lastCall?.tier1_freq_enabled).toBe(true);
    });

    const lastCall = onValidConfigChange.mock.calls.at(-1)?.[0];
    expect(pipelineConfigSchema.safeParse(lastCall).success).toBe(true);
  });

  it('emits tier1_freq_enabled false when frequency switch is turned off', async () => {
    const onValidConfigChange = vi.fn();
    renderConfigForm(onValidConfigChange);

    fireEvent.click(screen.getByLabelText('Tier 1 frequency filter'));

    await waitFor(() => {
      const lastCall = onValidConfigChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.tier1_freq_enabled).toBe(false);
    });
  });

  it('produces valid PipelineConfig from form values', () => {
    const formValues = {
      ...defaultConfigFormValues,
      tier1_blacklist_enabled: false,
    };
    const parsed = configFormSchema.parse(formValues);
    const config = toPipelineConfig(parsed);

    expect(pipelineConfigSchema.safeParse(config).success).toBe(true);
    expect(config.tier1_blacklist_enabled).toBe(false);
  });
});
