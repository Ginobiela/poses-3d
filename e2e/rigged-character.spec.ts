import { expect, test } from '@playwright/test';

test('carga el esqueleto y cambia entre tres poses sin volver a cargar el GLB', async ({ page }, testInfo) => {
  const errors: string[] = [];
  let modelRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().endsWith('/models/human/human.glb')) modelRequests++; });
  await page.goto('/poses-3d/');
  await page.getByLabel('Otra duración').fill('120');
  await page.getByRole('button', { name: '20 poses' }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#viewport')).toHaveAttribute('data-bone-count', '52', { timeout: 10_000 });
  const seen = new Set<string>();
  for (let index = 0; index < 20; index++) {
    const name = await page.locator('#pose-name').textContent();
    if (['De pie 01', 'Guardia 01', 'Carrera 01'].includes(name ?? '')) {
      await expect(page.locator('#viewport')).toHaveAttribute('data-figure-source', 'rigged', { timeout: 10_000 });
      seen.add(name!);
      await page.screenshot({ path: testInfo.outputPath(`pose-${name!.replaceAll(' ', '-')}.png`) });
      if (seen.size === 1) {
        await page.screenshot({ path: testInfo.outputPath('rigged-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: testInfo.outputPath('rigged-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    }
    if (index < 19) await page.getByRole('button', { name: /Siguiente pose/ }).click();
  }
  expect([...seen].sort()).toEqual(['Carrera 01', 'De pie 01', 'Guardia 01']);
  expect(modelRequests).toBe(1);
  expect(errors).toEqual([]);
});
