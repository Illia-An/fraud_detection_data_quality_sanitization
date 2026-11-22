import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { PlannerAtRiskDock } from './PlannerAtRiskDock';
import { PlannerPageShell } from './PlannerPageShell';

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={appTheme}>{ui}</ThemeProvider>);
}

function renderShell(props: Partial<Parameters<typeof PlannerPageShell>[0]> = {}) {
  return renderWithTheme(
    <PlannerPageShell
      controlsOpen
      onToggleControls={() => {}}
      railTestId="rail"
      rail={<div data-testid="rail-slot">rail</div>}
      {...props}
    >
      <div data-testid="main-slot">main</div>
    </PlannerPageShell>,
  );
}

describe('PlannerPageShell', () => {
  it('renders the rail and main slots and the given rail test id', () => {
    renderShell();
    expect(screen.getByTestId('rail')).toContainElement(screen.getByTestId('rail-slot'));
    expect(screen.getByTestId('main-slot')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('main-slot'));
  });

  it('follows controlsOpen in data-collapsed and the toggle aria state', () => {
    const { rerender } = renderShell({ controlsOpen: true });
    expect(screen.getByTestId('rail')).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <ThemeProvider theme={appTheme}>
        <PlannerPageShell
          controlsOpen={false}
          onToggleControls={() => {}}
          railTestId="rail"
          rail={<div data-testid="rail-slot">rail</div>}
        >
          <div>main</div>
        </PlannerPageShell>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('rail')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    // Rail content stays mounted while collapsed (form state is preserved).
    expect(screen.getByTestId('rail-slot')).toBeInTheDocument();
  });

  it('calls onToggleControls from the toggle button', () => {
    const onToggleControls = vi.fn();
    renderShell({ onToggleControls });
    fireEvent.click(screen.getByRole('button'));
    expect(onToggleControls).toHaveBeenCalledTimes(1);
  });

  it('shows collapsed Play only when closed and revealed', () => {
    const collapsedPlay = <button data-testid="collapsed-play">play</button>;

    const open = renderShell({ controlsOpen: true, showCollapsedPlay: true, collapsedPlay });
    expect(screen.queryByTestId('collapsed-play')).toBeNull();
    open.unmount();

    const notRevealed = renderShell({
      controlsOpen: false,
      showCollapsedPlay: false,
      collapsedPlay,
    });
    expect(screen.queryByTestId('collapsed-play')).toBeNull();
    notRevealed.unmount();

    renderShell({ controlsOpen: false, showCollapsedPlay: true, collapsedPlay });
    expect(screen.getByTestId('collapsed-play')).toBeInTheDocument();
  });
});

describe('PlannerAtRiskDock', () => {
  it('renders anchors, counts and the table slot', () => {
    renderWithTheme(
      <PlannerAtRiskDock
        testId="dock"
        onboardingId="dock-onboarding"
        expanded
        onExpandedChange={() => {}}
        behindCount={3}
        aheadCount={5}
      >
        <div data-testid="table-slot">table</div>
      </PlannerAtRiskDock>,
    );
    const dock = screen.getByTestId('dock');
    expect(dock).toHaveAttribute('data-onboarding', 'dock-onboarding');
    expect(dock).toContainElement(screen.getByTestId('table-slot'));
  });

  it('reports expand changes from the overlay summary', () => {
    const onExpandedChange = vi.fn();
    renderWithTheme(
      <PlannerAtRiskDock
        testId="dock"
        onboardingId="dock-onboarding"
        expanded={false}
        onExpandedChange={onExpandedChange}
        behindCount={1}
        aheadCount={2}
      >
        <div>table</div>
      </PlannerAtRiskDock>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('marks flow placement for in-page At-risk section', () => {
    renderWithTheme(
      <PlannerAtRiskDock
        placement="flow"
        testId="dock"
        onboardingId="dock-onboarding"
        expanded
        onExpandedChange={() => {}}
        behindCount={0}
        aheadCount={0}
      >
        <div data-testid="table-slot">table</div>
      </PlannerAtRiskDock>,
    );
    const dock = screen.getByTestId('dock');
    expect(dock).toHaveAttribute('data-placement', 'flow');
    expect(dock).toHaveAttribute('data-expanded', 'true');
    expect(dock).toHaveStyle({ height: '300px' });
    expect(screen.getByTestId('dock-scroll')).toBeInTheDocument();
  });

  it('collapses flow At-risk to the summary bar height', () => {
    renderWithTheme(
      <PlannerAtRiskDock
        placement="flow"
        testId="dock"
        onboardingId="dock-onboarding"
        expanded={false}
        onExpandedChange={() => {}}
        behindCount={0}
        aheadCount={0}
      >
        <div>table</div>
      </PlannerAtRiskDock>,
    );
    const dock = screen.getByTestId('dock');
    expect(dock).toHaveAttribute('data-expanded', 'false');
    expect(dock).toHaveStyle({ height: '52px' });
    expect(screen.queryByTestId('dock-scroll')).not.toBeInTheDocument();
  });

  it('toggles flow At-risk from the header button', () => {
    const onExpandedChange = vi.fn();
    renderWithTheme(
      <PlannerAtRiskDock
        placement="flow"
        testId="dock"
        onboardingId="dock-onboarding"
        expanded={false}
        onExpandedChange={onExpandedChange}
        behindCount={1}
        aheadCount={2}
      >
        <div>table</div>
      </PlannerAtRiskDock>,
    );
    fireEvent.click(screen.getByTestId('dock-toggle'));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });
});
