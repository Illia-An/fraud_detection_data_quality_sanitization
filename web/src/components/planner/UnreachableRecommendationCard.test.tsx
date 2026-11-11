import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UnreachableRecommendationCard } from './UnreachableRecommendationCard';

const hint = {
  store_id: 10,
  implied_target: 74,
  suggested_implied_target: 73,
  reason: 'above_history_cap',
  network_impact_pp: -0.12,
};

describe('UnreachableRecommendationCard', () => {
  it('renders suggestion and network impact', () => {
    render(<UnreachableRecommendationCard hint={hint} onApply={() => undefined} />);
    expect(screen.getByTestId('unreachable-recommendation-card')).toBeInTheDocument();
    expect(screen.getByText(/74\.0/)).toBeInTheDocument();
    expect(screen.getByText(/73\.0/)).toBeInTheDocument();
    expect(screen.getByText(/0\.12 pp/)).toBeInTheDocument();
    expect(screen.getByText(/above_history_cap/)).toBeInTheDocument();
  });

  it('calls onApply when Apply is clicked', () => {
    const onApply = vi.fn();
    render(<UnreachableRecommendationCard hint={hint} onApply={onApply} />);
    fireEvent.click(screen.getByTestId('unreachable-apply-suggestion'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('disables Apply while pending', () => {
    render(
      <UnreachableRecommendationCard hint={hint} onApply={() => undefined} applyPending />,
    );
    expect(screen.getByTestId('unreachable-apply-suggestion')).toBeDisabled();
  });
});
