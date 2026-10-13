import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { appTheme } from '../theme';
import { OnboardingHost } from './OnboardingHost';
import { resetOnboardingStoreForTests, useOnboardingStore } from './onboardingStore';

function stubVisibleRect(el: HTMLElement, width: number, height: number, left = 8, top = 8) {
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top,
      left,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

function renderHost(initialPath = '/') {
  const view = render(
    <ThemeProvider theme={appTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <div data-onboarding="nav-main" data-onboarding-surface="desktop" style={{ width: 100, height: 40 }}>
          nav
        </div>
        <div data-onboarding="nav-planner" data-onboarding-surface="desktop" style={{ width: 80, height: 32 }}>
          planner
        </div>
        <div data-onboarding="sanitization-sample" style={{ width: 200, height: 80 }}>
          sample
        </div>
        <div data-onboarding="sanitization-results" style={{ width: 300, height: 120 }}>
          results
        </div>
        <div data-onboarding="planner-hero" style={{ width: 400, height: 200 }}>
          hero
        </div>
        <OnboardingHost />
      </MemoryRouter>
    </ThemeProvider>,
  );
  // jsdom defaults to 0×0 rects — make anchors "on screen" for visibility checks.
  stubVisibleRect(view.container.querySelector('[data-onboarding="nav-main"]')!, 100, 40);
  stubVisibleRect(view.container.querySelector('[data-onboarding="nav-planner"]')!, 80, 32);
  stubVisibleRect(view.container.querySelector('[data-onboarding="sanitization-sample"]')!, 200, 80);
  stubVisibleRect(view.container.querySelector('[data-onboarding="sanitization-results"]')!, 300, 120);
  stubVisibleRect(view.container.querySelector('[data-onboarding="planner-hero"]')!, 400, 200);
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  return view;
}

describe('OnboardingHost', () => {
  beforeEach(() => {
    resetOnboardingStoreForTests();
  });

  it('shows welcome on first visit and advances on Start', async () => {
    renderHost();
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-tour-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('onboarding-tour-card')).toHaveAttribute('data-step', 'welcome');
    expect(screen.getByText('From Data to KPI Plan')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(
      () => {
        expect(screen.getByTestId('onboarding-tour-card')).toHaveAttribute(
          'data-step',
          'workspace',
        );
      },
      { timeout: 4000 },
    );
  });

  it('exits without crashing when target is missing', async () => {
    useOnboardingStore.setState({
      status: 'active',
      stepId: 'workspace',
      completedStepIds: ['welcome'],
      bootstrapped: true,
    });
    render(
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          {/* no anchors */}
          <OnboardingHost />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(
      () => {
        expect(screen.getByTestId('onboarding-tour-card')).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.getByText('Your analytics workspace')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('onboarding-exit'));
    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-tour-card')).not.toBeInTheDocument();
    });
    expect(useOnboardingStore.getState().status).toBe('dismissed');
  });

  it('does not render when tour is completed', () => {
    useOnboardingStore.setState({
      status: 'completed',
      stepId: null,
      completedStepIds: [],
      bootstrapped: true,
    });
    renderHost();
    expect(screen.queryByTestId('onboarding-tour-card')).not.toBeInTheDocument();
  });
});
