import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../../theme';
import { AtRiskAiChatPanel } from './AtRiskAiChatPanel';

describe('AtRiskAiChatPanel', () => {
  it('renders empty state and stub reply after send', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <AtRiskAiChatPanel />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('atrisk-ai-chat-panel')).toBeInTheDocument();
    expect(screen.getByText(/Connect your model/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('atrisk-ai-chat-input').querySelector('textarea')!, {
      target: { value: 'Why are stores behind?' },
    });
    fireEvent.click(screen.getByTestId('atrisk-ai-chat-send'));

    expect(screen.getByText('Why are stores behind?')).toBeInTheDocument();
    expect(screen.getByText(/AI is not connected yet/i)).toBeInTheDocument();
  });
});
