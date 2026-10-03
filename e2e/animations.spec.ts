import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compareRenderedPose } from './visual';

test('busca clips reales, congela, exporta, guarda y recarga sin descargar otro GLB', async ({ page }, info) => {
  const errors: string[] = []; const models: string[] = []; const clips: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (request.url().endsWith('/human.glb')) models.push(request.url());
    if (/\/animations\/.*\/.*\.json$/.test(request.url())) clips.push(request.url());
  });
  await page.goto('/poses-3d/');
  await page.getByLabel('Otra duración').fill('600');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15000 });
  expect(clips).toHaveLength(0);
  await page.getByRole('button', { name: 'Editar pose', exact: true }).click();
  await page.getByLabel('ARTICULACIÓN').selectOption('mixamorig:Head');
  await page.getByRole('button', { name: '+5°' }).click();
  await page.getByText('Animaciones', { exact: true }).click();
  const ids = process.env.CI ? ['walk-01', 'kick-01'] : ['walk-01', 'run-01', 'kick-01', 'punch-01', 'jump-01', 'idle-01'];
  for (const id of ids) {
    await page.locator('#animation-select').selectOption(id);
    await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', id);
    for (const value of [0, 500, 1000]) {
      await page.locator('#animation-progress').fill(String(value));
      await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
      if (!process.env.CI) await page.locator('#viewport').screenshot({ path: info.outputPath(`${id}-${value}.png`) });
    }
  }
  await page.locator('#animation-select').selectOption('walk-01');
  await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', 'walk-01');
  await page.locator('#animation-speed').selectOption('0.5');
  await page.locator('#animation-progress').fill('500');
  await expect(page.locator('#animation-time')).toHaveText('0.67 s / 1.33 s');
  if (!process.env.CI) {
    const pausedClip = await page.locator('#viewport').screenshot();
    await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y');
    await compareRenderedPose(page, pausedClip, await page.locator('#viewport').screenshot());
  }
  await page.getByRole('button', { name: 'Usar este frame como pose' }).click();
  await page.getByRole('button', { name: 'Editar pose', exact: true }).click();
  await page.getByLabel('NOMBRE DE LA POSE').fill('Caminar mitad');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pose', exact: true }).click();
  const downloaded = await pending; const pose = JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
  expect(Object.keys(pose.bones)).toHaveLength(52);
  for (const q of Object.values(pose.bones) as number[][]) expect(Math.hypot(...q)).toBeCloseTo(1, 7);
  await page.getByRole('button', { name: 'Editar pose', exact: true }).click();
  const frozen = !process.env.CI ? await page.locator('#viewport').screenshot() : undefined;
  await page.waitForTimeout(300);
  if (frozen) await compareRenderedPose(page, frozen, await page.locator('#viewport').screenshot());
  await page.getByText('Mis poses', { exact: true }).click();
  await page.getByRole('button', { name: 'Guardar como pose personalizada' }).click();
  await expect(page.locator('.custom-pose-row')).toHaveCount(1);
  await page.locator('#import-custom-pose').setInputFiles({ name: 'mi-pose.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pose)) });
  await expect(page.locator('.custom-pose-row')).toHaveCount(2);
  if (frozen) await compareRenderedPose(page, frozen, await page.locator('#viewport').screenshot());
  await page.locator('.custom-pose-row').first().getByRole('button', { name: 'Cargar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar pose', exact: true }).click();
  const pending2 = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar pose', exact: true }).click();
  const pose2 = JSON.parse(await readFile((await (await pending2).path())!, 'utf8'));
  for (const name of Object.keys(pose.bones)) for (let i = 0; i < 4; i++) expect(pose2.bones[name][i]).toBeCloseTo(pose.bones[name][i], 7);
  expect(pose2.positions).toEqual(pose.positions);
  expect(pose2.modelPosition).toEqual(pose.modelPosition);
  await page.getByText('Cámara y materiales', { exact: true }).click();
  for (const name of ['Frente', 'Perfil izquierdo', 'Perfil derecho', '3/4 izquierdo', '3/4 derecho', 'Espalda', 'Picado', 'Contrapicado']) await page.getByRole('button', { name, exact: true }).click();
  await page.locator('#focal-select').selectOption('85'); await expect(page.locator('#viewport')).toHaveAttribute('data-focal', '85');
  await page.locator('#focal-select').selectOption(''); await expect(page.locator('#viewport')).toHaveAttribute('data-focal', '');
  for (const mode of ['Gris', 'Silueta', 'Wireframe', 'Normal']) { await page.locator('#material-select').selectOption(mode); await expect(page.locator('#viewport')).toHaveAttribute('data-material', mode); }
  await page.getByRole('button', { name: /Siguiente pose/ }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', '');
  await expect(page.getByRole('button', { name: 'Editar pose', exact: true })).toBeEnabled();
  await page.locator('#animation-select').selectOption('walk-01');
  await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', 'walk-01');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar animación' })).toBeVisible();
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', '');
  expect(models).toHaveLength(1); expect(clips).toHaveLength(ids.length); expect(errors).toEqual([]);
  await page.reload(); await expect(page.getByRole('button', { name: /Empezar a dibujar/ })).toBeVisible();
  await page.locator('#category').selectOption('Custom');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible();
  expect(await page.locator('#pose-name').textContent()).toBe('Caminar mitad');
});

test('crea Gesture Drawing, cambia de bloque, vuelve y finaliza la sesión', async ({ page }) => {
  await page.goto('/poses-3d/');
  await page.locator('#session-plan').selectOption('gesture');
  await expect(page.locator('#estimate')).toHaveText('26 min');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#progress-label')).toHaveText('POSE 1 DE 20');
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Siguiente pose/ }).click();
  await expect(page.locator('#progress-label')).toHaveText('POSE 11 DE 20');
  await expect(page.locator('#timer')).toHaveText('01:00');
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.locator('#progress-label')).toHaveText('POSE 10 DE 20');
  await expect(page.locator('#timer')).toHaveText('00:30');
  await page.getByRole('button', { name: 'Finalizar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sesión completa' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resumen' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen de sesión' })).toBeVisible();
});

test('mantiene slider y controles de referencia usables en móvil', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/poses-3d/');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click(); await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 15000 });
  await page.getByText('Animaciones', { exact: true }).click(); await page.locator('#animation-select').selectOption('run-01');
  await expect(page.locator('#viewport')).toHaveAttribute('data-animation-id', 'run-01'); await page.locator('#animation-progress').fill('500');
  await page.getByLabel('Frame de animación en el visor').fill('430');
  await expect(page.locator('#animation-progress')).toHaveValue('430');
  await page.getByText('Cámara y materiales', { exact: true }).click(); await page.getByRole('button', { name: 'Perfil izquierdo', exact: true }).click();
  if (!process.env.CI) await page.screenshot({ path: info.outputPath('mobile-animation.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Usar este frame como pose' }).click();
  await page.getByRole('button', { name: 'Editar pose', exact: true }).click(); await page.getByLabel('ARTICULACIÓN').selectOption('mixamorig:Head');
  await page.getByRole('button', { name: '+5°' }).click(); await page.getByRole('button', { name: 'Deshacer' }).click(); expect(errors).toEqual([]);
});
