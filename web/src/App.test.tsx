import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { resetOnboardingStoreForTests, useOnboardingStore } from './onboarding';

describe('App', () => {
  beforeEach(() => {
    resetOnboardingStoreForTests();
    useOnboardingStore.setState({
      status: 'dismissed',
      stepId: null,
      completedStepIds: [],
      bootstrapped: true,
    });
  });

  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Survey Sanitization');
  });

  it('exposes Documentation in the side menu (How it works lives there)', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /Documentation/i })).toBeInTheDocument();
    expect(screen.queryByText(/How it works/)).not.toBeInTheDocument();
  });

  it('exposes Planner in the side menu', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /^Planner$/i })).toBeInTheDocument();
  });
});
