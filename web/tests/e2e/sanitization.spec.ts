import { expect, test, type Page } from '@playwright/test';

async function waitForApiOk(page: Page) {
  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 30_000 });
}

async function waitForSmallPresetLoaded(page: Page) {
  await expect(page.getByText(/Preset:\s*small/i)).toBeVisible({ timeout: 30_000 });
}

async function runPipeline(page: Page) {
  await page.getByRole('button', { name: 'Run pipeline' }).click();
  await expect(page.getByText('Baseline 5%')).toBeVisible();
  await expect(page.getByText(/-?\d+\.\d{2} pp/)).toBeVisible();
}

async function readNetworkDelta(page: Page): Promise<string> {
  const value = page.getByText(/-?\d+\.\d{2} pp/);
  return (await value.textContent())?.trim() ?? '';
}

test.describe('Sanitization flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApiOk(page);
    await waitForSmallPresetLoaded(page);
  });

  test('shows API health ok', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Survey Sanitization',
    );
    await expect(page.getByText('API: ok')).toBeVisible();
  });

  test('small preset run shows KPI cards', async ({ page }) => {
    await runPipeline(page);

    await expect(page.getByText('Final 5%')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pipeline steps/i })).toBeVisible();
  });

  test('tier 2 off changes network delta on re-run', async ({ page }) => {
    await runPipeline(page);
    const deltaWithTier2 = await readNetworkDelta(page);

    await page.getByRole('checkbox', { name: 'Tier 2 enabled' }).click();
    await runPipeline(page);
    const deltaWithoutTier2 = await readNetworkDelta(page);

    expect(deltaWithoutTier2).not.toBe(deltaWithTier2);
  });
});
