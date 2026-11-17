import { expect, test, type Page } from '@playwright/test';

/**
 * Real F2/F3/F4 scenarios through the console. Skipped unless every variable is set (see playwright.config.ts).
 * Read-only for the catalog: these tests never create, edit, approve or deactivate definitions (D11).
 * Screenshots, traces and videos are off so no business data is stored.
 */
const env = (name: string) => process.env[name] ?? '';
const configured = ['NEXORA_E2E_USER', 'NEXORA_E2E_PASSWORD', 'NEXORA_E2E_SOURCE'].every((v) => env(v));

test.skip(!configured, 'Real E2E disabled: set NEXORA_E2E_* with a controlled test account.');

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /Iniciar sesión/ }).click();
  // Keycloak's login form (standard theme field ids).
  await page.locator('#username').fill(env('NEXORA_E2E_USER'));
  await page.locator('#password').fill(env('NEXORA_E2E_PASSWORD'));
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
}

async function ask(page: Page, question: string) {
  await page.goto('/chat');
  await page.getByLabel(/Fuente de datos/).click();
  await page.getByRole('option', { name: new RegExp(env('NEXORA_E2E_SOURCE'), 'i') }).first().click().catch(() => undefined);
  await page.getByLabel(/Escribe tu pregunta/).fill(question);
  await page.getByRole('button', { name: /Enviar/ }).click();
}

test('F2: clarification answered from the console produces the Excel', async ({ page }) => {
  test.skip(!env('NEXORA_E2E_F2'), 'NEXORA_E2E_F2 not set');
  await signIn(page);
  await ask(page, env('NEXORA_E2E_F2'));
  await expect(page.getByText('Nexora necesita una aclaración')).toBeVisible({ timeout: 300_000 });
  await page.getByRole('group', { name: 'Nexora necesita una aclaración' }).getByRole('button').first().click();
  await expect(page.getByText('Tu reporte está listo')).toBeVisible({ timeout: 300_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Descargar Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
});

test('F3: a direct question produces the Excel', async ({ page }) => {
  test.skip(!env('NEXORA_E2E_F3'), 'NEXORA_E2E_F3 not set');
  await signIn(page);
  await ask(page, env('NEXORA_E2E_F3'));
  await expect(page.getByText('Tu reporte está listo')).toBeVisible({ timeout: 300_000 });
});

test('F4: a question without governed support is explained, no file', async ({ page }) => {
  test.skip(!env('NEXORA_E2E_F4'), 'NEXORA_E2E_F4 not set');
  await signIn(page);
  await ask(page, env('NEXORA_E2E_F4'));
  await expect(page.getByText('Tu reporte está listo')).toHaveCount(0, { timeout: 300_000 });
});
