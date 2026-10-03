import { expect, test } from '@playwright/test';

test('revisa el catálogo completo, carga un GLB y veinte JSON bajo demanda', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const models: string[] = [];
  const jsons: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => {
    if (request.url().endsWith('/models/human-approved/human.glb')) models.push(request.url());
    if (/\/poses\/(standing|sitting|action|dynamic)\/.*\.json$/.test(request.url())) jsons.push(request.url());
  });
  await page.goto('/poses-3d/');
  await page.getByLabel('Otra duración').fill('300');
  await page.getByRole('button', { name: '20 poses' }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-bone-count', '52', { timeout: 15_000 });
  await expect(page.getByText('EN CURSO')).toBeVisible();
  const seen = new Set<string>();
  const reviewCount = process.env.CI ? 3 : 20;
  for (let index = 0; index < reviewCount; index++) {
    const name = (await page.locator('#pose-name').textContent())!;
    expect(seen.has(name)).toBe(false);
    seen.add(name);
    await expect(page.locator('#viewport')).toHaveAttribute('data-figure-source', 'rigged');
    if (!process.env.CI) {
      await page.getByRole('button', { name: 'Vista frontal' }).click();
      await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${index + 1}-${name.replaceAll(/[^a-zA-Z0-9]/g, '-')}-front.png`) });
      await page.getByRole('button', { name: 'Vista lateral' }).click();
      await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${index + 1}-${name.replaceAll(/[^a-zA-Z0-9]/g, '-')}-side.png`) });
    }
    if (index < reviewCount - 1) await page.getByRole('button', { name: /Siguiente pose/ }).click();
  }
  expect(seen.size).toBe(reviewCount);
  expect(models.length).toBe(1);
  expect(new Set(jsons).size).toBe(20);
  expect(jsons.length).toBe(20);
  expect(errors).toEqual([]);
});

test('carga un solo JSON para una práctica breve y muestra poses en móvil', async ({ page }, testInfo) => {
  const jsons: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (/\/poses\/(standing|sitting|action|dynamic)\/.*\.json$/.test(request.url())) jsons.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/poses-3d/');
  await page.getByRole('button', { name: '1 pose', exact: true }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  if (!process.env.CI) await page.screenshot({ path: testInfo.outputPath('mobile-pose.png'), fullPage: true });
  expect(jsons.length).toBe(1);
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.getByRole('button', { name: '5 poses' }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  for (let index = 0; index < 5; index++) {
    await expect(page.locator('#viewport')).toHaveAttribute('data-figure-source', 'rigged');
    if (!process.env.CI) await page.screenshot({ path: testInfo.outputPath(`mobile-${index + 1}.png`), fullPage: true });
    if (index < 4) await page.getByRole('button', { name: /Siguiente pose/ }).click();
  }
  expect(errors).toEqual([]);
});
