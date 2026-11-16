import { expect, test, type Page } from '@playwright/test';

import { dismissOnboarding } from './dismissOnboarding';

async function waitForApiOk(page: Page) {
  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ timeout: 90_000 });

test.describe('TTS Kitchen e2e (T-09 / J5)', () => {
  test('Kitchen page mounts with prototype badge and controls', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/');
    await waitForApiOk(page);

    await page.getByRole('link', { name: /^Kitchen TTS$/i }).click();
    await expect(page).toHaveURL(/\/tts-kitchen/);
    await expect(page.getByTestId('tts-kitchen-page')).toBeVisible({ timeout: 30_000 });
    // Feature still gated in UI — assert the badge stays visible.
    await expect(page.getByTestId('kitchen-coming-soon')).toBeVisible();
    await expect(page.getByTestId('kitchen-source-panel')).toBeVisible();
    await expect(page.getByTestId('kitchen-run')).toBeVisible();
  });
});
