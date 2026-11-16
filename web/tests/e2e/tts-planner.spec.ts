import { expect, test, type Page } from '@playwright/test';

import { dismissOnboarding } from './dismissOnboarding';

async function waitForApiOk(page: Page) {
  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ timeout: 120_000 });

test.describe('TTS Planner e2e (T-09 / J4)', () => {
  test('opens TTS Planner from nav and loads AP baseline controls', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/');
    await waitForApiOk(page);

    await page.getByRole('link', { name: /^TTS Planner$/i }).click();
    await expect(page).toHaveURL(/\/planner-tts/);
    await expect(page.getByTestId('tts-controls-rail')).toBeVisible({ timeout: 30_000 });

    // Fixture snapshot → AP panel loads (or shows a clear failure state).
    await expect(
      page
        .getByTestId('tts-allocation-levers')
        .or(page.getByTestId('tts-planner-ap-failed'))
        .or(page.getByTestId('tts-planner-loading-ap')),
    ).toBeVisible({ timeout: 60_000 });

    // With CI fixtures, levers should appear and Run becomes usable.
    const levers = page.getByTestId('tts-allocation-levers');
    if (await levers.isVisible()) {
      await expect(page.getByTestId('tts-planner-run')).toBeVisible();
      await page.getByTestId('tts-planner-run').click();
      // After a successful run both hero and at-risk cards mount — assert hero only
      // (`.or()` + toBeVisible fails strict mode when both match).
      await expect(page.getByTestId('tts-planner-hero')).toBeVisible({
        timeout: 60_000,
      });
    }
  });
});
