import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './e2e', timeout: 90_000, workers: 1, use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://127.0.0.1:4173/poses-3d/' }, webServer: { command: 'pnpm dev --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/poses-3d/', reuseExistingServer: true, timeout: 30_000 } });
