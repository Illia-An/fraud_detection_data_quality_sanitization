import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Local Windows: Edge channel. CI (Linux): bundled Chromium.
        ...(process.env.CI ? {} : { channel: 'msedge' as const }),
      },
    },
  ],
  webServer: [
    {
      command: 'uv run uvicorn backend.main:app --host 127.0.0.1 --port 8001',
      url: 'http://127.0.0.1:8001/health',
      cwd: repoRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_CORS_ORIGINS: 'http://localhost:5173',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
