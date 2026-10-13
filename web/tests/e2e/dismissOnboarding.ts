import type { Page } from '@playwright/test';

/** Mark product tour dismissed so e2e flows are not blocked by the overlay. */
export async function dismissOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Browser context — avoid relying on DOM typings from tsconfig.node.
    const storage = (
      globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void } }
    ).localStorage;
    storage.setItem(
      'fraud-guard-onboarding-v1',
      JSON.stringify({
        tourId: 'planner-product-tour',
        version: 3,
        status: 'dismissed',
        stepId: null,
        completedStepIds: [],
        updatedAt: new Date().toISOString(),
      }),
    );
  });
}
