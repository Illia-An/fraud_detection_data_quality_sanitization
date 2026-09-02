import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Fraud Guard — Sanitization PoC',
    );
  });

  it('renders How it works section', () => {
    render(<App />);
    expect(screen.getByText('How it works')).toBeInTheDocument();
  });
});
