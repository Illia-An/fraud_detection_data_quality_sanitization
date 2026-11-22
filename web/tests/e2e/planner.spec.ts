import { expect, test, type Page } from '@playwright/test';

import { dismissOnboarding } from './dismissOnboarding';

async function waitForApiOk(page: Page) {
  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 30_000 });
}

async function useSmallPreset(page: Page) {
  await page.getByLabel('Data source').click();
  await page.getByRole('option', { name: 'Synthetic — small' }).click();
  await expect(page.getByText(/small\s*·\s*\d+\s*rows/i)).toBeVisible({ timeout: 30_000 });
  // Selecting a source auto-runs the pipeline; label is "Running…" until complete.
  await expect(page.getByRole('button', { name: 'Run Scenario' })).toBeEnabled({
    timeout: 90_000,
  });
}

test.describe.configure({ timeout: 120_000 });

/** Small preset auto-runs; wait for KPI strip (Store-scoped labels by default). */
async function waitForSanitizationResult(page: Page) {
  await expect(page.getByTestId('kpi-telemetry-strip')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/baseline 5%/i).first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Planner alt-UI smoke', () => {
  test('Sanitization unlocks Planner → Run → strip/hero/at-risk → Inspect sandbox', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await dismissOnboarding(page);
    await page.goto('/');
    await waitForApiOk(page);
    await useSmallPreset(page);
    await waitForSanitizationResult(page);

    await page.getByRole('link', { name: /^Planner$/i }).click();
    await expect(page).toHaveURL(/\/planner/);
    await expect(page.getByText(/Plan controls/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Run simulation/i })).toBeEnabled({
      timeout: 15_000,
    });

    await expect(page.getByTestId('planner-save-plan')).toBeVisible();
    // Excel lives under collapsed Export & download disclosure (Figma footer).
    await page.getByTestId('planner-export-disclosure').click();
    await expect(page.getByTestId('planner-export-excel')).toBeVisible();

    await page.getByRole('button', { name: /Run simulation/i }).click();

    await expect(page.getByTestId('planner-glance-row')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Projected network KPI/i)).toBeVisible();
    // Network Slope is two stacked panels (not CumulativeSlopeHeroChart wrapper).
    await expect(page.getByTestId('planner-slope-cumulative')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId('planner-slope-monthly')).toBeVisible();
    await expect(page.getByTestId('planner-save-plan')).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByTestId('planner-hero-view-mode')).toHaveCount(0);

    // At-risk is a second full viewport (no accordion expand).
    await page.getByTestId('planner-screen-atrisk').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('planner-at-risk-sheet')).toBeVisible();
    // Exception table lives in atrisk-exception-panel (section root is planner-at-risk-sheet).
    await expect(page.getByTestId('atrisk-exception-panel')).toBeVisible();

    // Default filter is Behind Plan Only — may be empty on synthetic; open All Stores.
    await page.locator('#atrisk-filter-select').click();
    await page.getByRole('option', { name: /All Stores/i }).click();
    const inspect = page
      .getByTestId('atrisk-exception-panel')
      .getByRole('button', { name: /^Inspect$/i })
      .first();
    await expect(inspect).toBeVisible({ timeout: 15_000 });
    // Native DOM click — force:true did not navigate in CI Linux Chromium.
    // Cast avoids HTMLElement (tsconfig.node has no DOM lib).
    await inspect.evaluate((el) => (el as { click: () => void }).click());

    await expect(page).toHaveURL(/\/planner\/store\/\d+/, { timeout: 15_000 });
    const inspectPage = page.getByTestId('store-inspect-page');
    await expect(inspectPage).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('inspect-store-select')).toBeVisible();
    await expect(page.getByTestId('inspect-sandbox-warn')).toBeVisible();
    await expect(page.getByTestId('inspect-open-sandbox')).toBeVisible();
    // After Run, Inspect uses Slope store layers (same charts as network screen 1).
    await expect(page.getByTestId('store-inspect-slope-cumulative')).toBeVisible();
    await page.getByTestId('inspect-open-sandbox').click();
    await expect(page.getByTestId('inspect-sandbox-dialog')).toBeVisible();
    await expect(page.getByTestId('inspect-sandbox-panel')).toBeVisible();
    await expect(page.getByTestId('inspect-recalculate')).toBeVisible();

    await page.getByTestId('store-inspect-back').click();
    await expect(page).toHaveURL(/\/planner$/);
    await expect(page.getByTestId('store-inspect-page')).toHaveCount(0);
  });
});
