import { expect, test, type Page } from '@playwright/test';

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

    await page.goto('/');
    await waitForApiOk(page);
    await useSmallPreset(page);
    await waitForSanitizationResult(page);

    await page.getByRole('link', { name: /^Planner$/i }).click();
    await expect(page).toHaveURL(/\/planner/);
    await expect(page.getByText(/Allocation levers/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Run simulation/i })).toBeEnabled({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /Run simulation/i }).click();

    await expect(page.getByTestId('planner-glance-row')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Projected network KPI/i)).toBeVisible();
    await expect(page.getByText(/Hero evaluation/i)).toBeVisible();
    await expect(page.getByTestId('hero-evaluation-chart')).toBeVisible();

    // At-risk is a collapsed bottom overlay — expand before asserting the table.
    await page.getByText(/At-Risk Exception List/i).click();
    await expect(page.getByTestId('planner-at-risk-sheet')).toBeVisible();
    await expect(page.getByTestId('atrisk-exception-table')).toBeVisible();

    // Default filter is Behind Plan Only — may be empty on synthetic; open All Stores.
    await page.getByLabel(/^Filter$/i).click();
    await page.getByRole('option', { name: /All Stores/i }).click();
    const inspect = page
      .getByTestId('atrisk-exception-table')
      .getByRole('button', { name: /^Inspect$/i })
      .first();
    await expect(inspect).toBeVisible({ timeout: 15_000 });
    // Native DOM click — force:true did not open the drawer in CI Linux Chromium.
    // Cast avoids HTMLElement (tsconfig.node has no DOM lib).
    await inspect.evaluate((el) => (el as { click: () => void }).click());

    const dialog = page.getByTestId('store-inspect-dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/Inspect/i).first()).toBeVisible();
    await expect(page.getByTestId('inspect-store-select')).toBeVisible();
    await expect(page.getByTestId('inspect-sandbox-warn')).toBeVisible();
    await expect(page.getByTestId('store-hero-evaluation-chart')).toBeVisible();

    // Estimate funnel is collapsed by default.
    await dialog.getByRole('button', { name: /Estimate vs actual/i }).click();
    await expect(dialog.getByRole('button', { name: /Recalculate/i })).toBeVisible();

    await dialog.locator('.MuiDialogActions-root').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('store-inspect-dialog')).toHaveCount(0);
  });
});
