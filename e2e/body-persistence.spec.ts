import { expect, test, type Page } from '@playwright/test';

const key = 'poses.body.v1';
async function start(page: Page) {
  await page.getByLabel('Otra duración').fill('120');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-bone-count', '52');
  await page.getByText('Tipo de cuerpo', { exact: true }).click();
  await expect(page.locator('#body-controls input[type=range]')).toHaveCount(10);
}

for (const width of [1280, 390]) {
  test(`restaura preset y ajustes, y reset persiste Neutral a ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = []; let models = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/poses-3d/'); await start(page);
    await page.getByLabel('Preset corporal').selectOption('muscular');
    await page.reload(); await start(page);
    await expect(page.getByLabel('Preset corporal')).toHaveValue('muscular');
    await expect(page.getByLabel('Musculatura', { exact: true })).toHaveValue('0.65');
    await page.getByLabel('Musculatura', { exact: true }).fill('0');
    await page.getByLabel('Peso / grasa', { exact: true }).fill('-0.3');
    await page.getByLabel('Altura (ajuste leve)', { exact: true }).fill('0.02');
    await page.getByLabel('Piernas', { exact: true }).fill('-0.2');
    const saved = await page.evaluate(key => localStorage.getItem(key), key);
    expect(JSON.parse(saved!)).toEqual({ version: 1, preset: 'muscular', manual: { muscle: 0, weight: -.3, height: .02, legs: -.2 } });
    await page.reload(); await start(page);
    await expect(page.getByLabel('Preset corporal')).toHaveValue('custom');
    await expect(page.getByLabel('Musculatura', { exact: true })).toHaveValue('0');
    await expect(page.getByLabel('Peso / grasa', { exact: true })).toHaveValue('-0.3');
    await expect(page.getByLabel('Altura (ajuste leve)', { exact: true })).toHaveValue('0.02');
    await expect(page.getByLabel('Piernas', { exact: true })).toHaveValue('-0.2');
    await page.screenshot({ path: testInfo.outputPath('restored-body.png'), fullPage: true });
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
    await page.evaluate(() => localStorage.setItem('poses.custom.v1', '[]'));
    await page.getByRole('button', { name: 'Restablecer cuerpo', exact: true }).click();
    await expect(page.getByLabel('Preset corporal')).toHaveValue('neutral');
    for (const slider of await page.locator('#body-controls input[type=range]').all()) await expect(slider).toHaveValue('0');
    expect(await page.evaluate(() => localStorage.getItem('poses.custom.v1'))).toBe('[]');
    expect(models).toBe(3); // One GLB per page load; no reload when changing/resetting the body.
    await page.reload(); await start(page);
    await expect(page.getByLabel('Preset corporal')).toHaveValue('neutral');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual({ version: 1, preset: 'neutral', manual: {} });
    await expect(page.getByText('EN CURSO')).toBeVisible();
    expect(models).toBe(4); expect(errors).toEqual([]);
  });
}

test('datos corruptos se ignoran y almacenamiento bloqueado permite editar y resetear', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/poses-3d/');
  await page.evaluate(key => localStorage.setItem(key, '{bad JSON'), key);
  await page.reload(); await start(page);
  await expect(page.getByLabel('Preset corporal')).toHaveValue('neutral');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
  });
  await page.getByLabel('Hombros', { exact: true }).fill('0.2');
  await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', 'custom');
  await expect(page.locator('#reference-status')).toContainText('No se pudo guardar');
  await page.getByRole('button', { name: 'Restablecer cuerpo', exact: true }).click();
  await expect(page.getByLabel('Hombros', { exact: true })).toHaveValue('0');
  await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', 'neutral');
  await expect(page.getByText('EN CURSO')).toBeVisible();
  expect(errors).toEqual([]);
});
