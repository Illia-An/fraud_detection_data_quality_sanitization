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
    expect(screen.getByRole('heading', { name: 'Tier 1 — deterministic' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tier 2 — store×month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tier 3 — IsolationForest' })).toBeInTheDocument();
    expect(screen.getByLabelText('Freq threshold')).toHaveValue(3);
    expect(screen.getByLabelText('Min volume')).toHaveValue(30);
  });

  it('toggles Tier 2 off and emits valid PipelineConfig', async () => {
    const onValidConfigChange = vi.fn();
    renderConfigForm(onValidConfigChange);

    const tier2Switch = screen.getByRole('checkbox', { name: 'Tier 2 enabled' });
    expect(tier2Switch).toBeChecked();

    fireEvent.click(tier2Switch);
    expect(tier2Switch).not.toBeChecked();

    await waitFor(() => {
      const lastCall = onValidConfigChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.tier2.enabled).toBe(false);
    });

    const lastCall = onValidConfigChange.mock.calls.at(-1)?.[0];
    expect(pipelineConfigSchema.safeParse(lastCall).success).toBe(true);
  });

  it('produces valid PipelineConfig from toggled form values', () => {
    const formValues = {
      ...defaultConfigFormValues,
      tier2: { ...defaultConfigFormValues.tier2, enabled: false },
    };
    const parsed = configFormSchema.parse(formValues);
    const config = toPipelineConfig(parsed);

    expect(pipelineConfigSchema.safeParse(config).success).toBe(true);
    expect(config.tier2.enabled).toBe(false);
  });
});
