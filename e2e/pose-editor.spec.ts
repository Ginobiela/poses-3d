import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compareRenderedPose } from './visual';

async function catalogue(page: import('@playwright/test').Page, ids: string[]) {
  await page.route('**/poses/manifest.json', async route => {
    const original = await (await route.fetch()).json();
    await route.fulfill({ json: { ...original, poses: original.poses.filter((pose: { id: string }) => ids.includes(pose.id)) } });
  });
}

test('edita, deshace, restablece, exporta y vuelve a cargar una variante', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await catalogue(page, ['01']);
  const original = JSON.parse(await readFile('public/poses/standing/standing_01.json', 'utf8'));
  await page.goto('/poses-3d/');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Editar pose' }).click();
  await page.getByLabel('ARTICULACIÓN').selectOption('mixamorig:Head');
  await page.getByRole('button', { name: '+5°' }).click();
  if (!process.env.CI) await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  await page.getByRole('button', { name: 'Duplicar como variante' }).click();
  expect(await page.getByLabel('NOMBRE DE LA POSE').inputValue()).toContain('variante');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pose' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mi-pose.json');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.bones['mixamorig:Head']).not.toEqual(original.bones['mixamorig:Head']);
  for (let index = 0; index < 4; index++) expect(exported.bones['mixamorig:Hips'][index]).toBeCloseTo(original.bones['mixamorig:Hips'][index], 6);
  expect(exported.hipsPosition).toEqual(exported.positions['mixamorig:Hips']);
  for (const q of Object.values(exported.bones) as number[][]) expect(Math.hypot(...q)).toBeCloseTo(1, 5);
  expect(JSON.parse(await readFile('public/poses/standing/standing_01.json', 'utf8'))).toEqual(original);

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Rehacer' })).toBeEnabled();
  await page.keyboard.press('Control+y');
  await expect(page.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
  let editedImage: Buffer | undefined;
  if (!process.env.CI) {
    await page.getByRole('button', { name: 'Editar pose' }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    editedImage = await page.locator('#viewport').screenshot({ path: testInfo.outputPath('edited-variant.png') });
    await page.getByRole('button', { name: 'Editar pose' }).click();
  }
  await page.getByRole('button', { name: 'Restablecer articulación' }).click();
  await page.getByRole('button', { name: 'Restablecer pose completa' }).click();
  const resetPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pose' }).click();
  const resetDownload = await resetPromise;
  const reset = JSON.parse(await readFile((await resetDownload.path())!, 'utf8'));
  for (const [name, q] of Object.entries(original.bones) as [string, number[]][]) {
    for (let index = 0; index < 4; index++) expect(reset.bones[name][index]).toBeCloseTo(q[index]!, 6);
  }

  await page.getByRole('button', { name: 'Salir' }).click();
  await page.route('**/poses/standing/standing_01.json', route => route.fulfill({ json: exported }));
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Editar pose' }).click();
  const reloadedPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pose' }).click();
  const reloadedDownload = await reloadedPromise;
  const reloaded = JSON.parse(await readFile((await reloadedDownload.path())!, 'utf8'));
  for (const [name, q] of Object.entries(exported.bones) as [string, number[]][]) {
    for (let index = 0; index < 4; index++) expect(reloaded.bones[name][index]).toBeCloseTo(q[index]!, 6);
  }
  if (!process.env.CI) {
    await page.getByRole('button', { name: 'Editar pose' }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const reloadedImage = await page.locator('#viewport').screenshot({ path: testInfo.outputPath('reloaded-variant.png') });
    await compareRenderedPose(page, editedImage!, reloadedImage);
  } else {
    await page.getByRole('button', { name: 'Editar pose' }).click();
  }
  await page.getByRole('button', { name: 'Vista lateral' }).click();
  await page.getByRole('button', { name: 'Editar pose' }).click();
  expect(errors).toEqual([]);
});

test('muestra y retira props según la pose, sin recargar el GLB', async ({ page }, testInfo) => {
  await catalogue(page, ['01', '12', '13']);
  let models = 0;
  page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
  await page.goto('/poses-3d/');
  await page.getByRole('button', { name: '3 poses' }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  for (let index = 0; index < 3; index++) {
    const name = await page.locator('#pose-name').textContent();
    const prop = name === 'Sentada 02' ? 'chair' : name === 'Sentada 04' ? 'bench' : '';
    await expect(page.locator('#viewport')).toHaveAttribute('data-props-count', prop ? '1' : '0');
    await expect(page.locator('#viewport')).toHaveAttribute('data-prop-types', prop);
    if (prop && !process.env.CI) {
      await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${prop}.png`) });
      await page.getByRole('button', { name: 'Vista lateral' }).click();
      await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${prop}-side.png`) });
    }
    if (index < 2) await page.getByRole('button', { name: /Siguiente pose/ }).click();
  }
  expect(models).toBe(1);
});

test('permite seleccionar y exportar en móvil', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await catalogue(page, ['01']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/poses-3d/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Editar pose' }).click();
  await page.getByLabel('ARTICULACIÓN').selectOption('mixamorig:LeftArm');
  await page.getByLabel('Eje de giro').selectOption('z');
  await page.getByRole('button', { name: '+5°' }).click();
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  if (!process.env.CI) await page.screenshot({ path: testInfo.outputPath('editor-mobile.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pose' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('mi-pose.json');
  await page.getByRole('button', { name: 'Editar pose' }).click();
  await page.getByRole('button', { name: 'Vista frontal' }).click();
  expect(errors).toEqual([]);
});

test('TransformControls rota un hueso y suspende OrbitControls durante el arrastre', async ({ page }) => {
  test.skip(!!process.env.CI, 'El renderizado WebGL por software vuelve inestable un arrastre por coordenadas en CI.');
  await catalogue(page, ['01']);
  await page.goto('/poses-3d/');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Editar pose' }).click();
  const box = (await page.locator('#viewport').boundingBox())!;
  const centerX = box.x + box.width * .505;
  const centerY = box.y + box.height * .335;
  await page.mouse.click(centerX, centerY);
  await expect(page.locator('#viewport')).toHaveAttribute('data-selected-bone', 'mixamorig:Head');
  await page.mouse.move(centerX + 42, centerY);
  await page.mouse.down();
  await expect(page.locator('#viewport')).toHaveAttribute('data-orbit-enabled', 'false');
  await page.mouse.move(centerX + 32, centerY + 28, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#viewport')).toHaveAttribute('data-orbit-enabled', 'true');
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
});
