import { expect, test, type Page } from '@playwright/test';

import { dismissOnboarding } from './dismissOnboarding';

async function waitForApiOk(page: Page) {
  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ timeout: 120_000 });

/**
 * RG-N10 — E2E against committed / CI snapshot fixture (not only synthetic presets).
 * Requires testdata/fixtures/*.sqlite (scripts/build_ci_fixtures.py).
 */
test.describe('Sanitization snapshot fixture', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/');
    await waitForApiOk(page);
  });

  test('database source runs process against snapshot', async ({ page }) => {
    await page.getByLabel('Data source').click();
    await page.getByRole('option', { name: /Database \(Q10012\)/i }).click();

    await expect(page.getByText(/db\s*·\s*\d+\s*rows/i)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('button', { name: 'Run Scenario' })).toBeEnabled({
      timeout: 90_000,
    });

    await expect(page.getByText('Baseline 5%', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId('kpi-network-delta')).toBeVisible();

    // Wave 4 UI: snapshot freshness from process meta (fixture has loaded_at).
    await expect(page.getByTestId('sanitization-snapshot-freshness')).toBeVisible({
      timeout: 30_000,
    });
  });
});
