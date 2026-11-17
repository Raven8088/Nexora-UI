import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against a REAL running console (BFF + Keycloak + Semantic + Intelligence). They are NOT part of
 * `npm test` and never run against mocks. D11: only with controlled test accounts and explicit authorization.
 *
 *   NEXORA_E2E_BASE_URL   console URL, e.g. http://127.0.0.1:8085
 *   NEXORA_E2E_USER / NEXORA_E2E_PASSWORD   a test account created for this purpose (never committed)
 *   NEXORA_E2E_SOURCE     source alias configured in the BFF
 *   NEXORA_E2E_F2 / NEXORA_E2E_F3 / NEXORA_E2E_F4   the questions of each controlled scenario
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 360_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.NEXORA_E2E_BASE_URL ?? 'http://127.0.0.1:8085',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
