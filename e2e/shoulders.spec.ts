import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('hombros en veinte poses: referencias, edición, clip, reset y móvil', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('.glb')) requests.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/poses-3d/dev/compare.html?shoulders');
  await expect(page.locator('#status')).toContainText('misma pose', { timeout: 30000 });
  await expect(page.locator('#shoulder-correctives')).not.toBeChecked();
  await page.locator('#shoulder-correctives').check();
  const dir = 'docs/audit/shoulders';
  if (!process.env.CI) await mkdir(dir, { recursive: true });
  const samples = [];
  for (let n = 1; n <= 20; n++) {
    const id = String(n).padStart(2, '0');
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    const result = await page.evaluate(() => {
      const { viewers, correctives, shoulderCorrectives } = (window as any).comparison;
      const v = viewers[1], point = v.controls.target.clone();
      let finite = true;
      for (const mesh of v.character.skinnedMeshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point); finite &&= point.toArray().every(Number.isFinite);
        }
      }
      return { finite, bones: viewers.map((v: any) => v.exportCurrentPose('check').bones),
        states: shoulderCorrectives.getStates(), preserved: correctives.getStates() };
    });
    expect(result.finite).toBe(true); expect(result.bones[0]).toEqual(result.bones[1]);
    expect(result.states).toHaveLength(6); expect(result.preserved).toHaveLength(4);
    expect([...result.states, ...result.preserved].every(s => s.active && Number.isFinite(s.influence) && s.influence >= 0 && s.influence <= 1)).toBe(true);
    samples.push({ id, states: result.states });
    if (!process.env.CI && ['01', '02', '05', '07', '20'].includes(id)) {
      for (const camera of ['Frente', 'Espalda', 'Perfil izquierdo', '3/4 derecho']) {
        await page.locator('#camera-select').selectOption(camera);
        const slug = camera.replaceAll(' ', '-').replace('/', '');
        await page.locator('main').screenshot({ path: `${dir}/${id}-${slug}.png` });
        await page.locator('#model-select').selectOption('candidate');
        await page.locator('#detail-select').selectOption('LeftArm');
        for (const enabled of [false, true]) {
          await page.locator('#shoulder-correctives').setChecked(enabled);
          await page.locator('#candidate').screenshot({ path: `${dir}/${id}-${slug}-${enabled ? 'on' : 'off'}.png` });
        }
        await page.locator('#detail-select').selectOption('');
        await page.locator('#model-select').selectOption('both');
      }
    }
  }
  const initial = await page.evaluate(() => (window as any).comparison.viewers[1].exportCurrentPose('initial'));
  await page.getByRole('button', { name: 'Probar edición de codo' }).click();
  const edited = await page.evaluate(() => {
    const c = (window as any).comparison;
    c.viewers[1].selectJoint('mixamorig:LeftArm'); c.viewers[1].rotateJoint('z', 5); c.updateCorrectives();
    return { pose: c.viewers[1].exportCurrentPose('edited'), states: c.shoulderCorrectives.getStates() };
  });
  expect(edited.pose.bones['mixamorig:LeftArm']).not.toEqual(initial.bones['mixamorig:LeftArm']);
  expect(edited.states.every((s: any) => Number.isFinite(s.influence))).toBe(true);
  const restored = await page.evaluate(() => {
    const c = (window as any).comparison; c.viewers[1].resetPose(); c.updateCorrectives();
    return c.viewers[1].exportCurrentPose('reset');
  });
  expect(restored.bones).toEqual(initial.bones);
  await page.locator('#pose-select').selectOption('01'); await expect(page.locator('#pose-select')).toBeEnabled();
  expect((await page.evaluate(() => (window as any).comparison.shoulderCorrectives.getStates())).every((s: any) => s.influence === 0)).toBe(true);
  await page.getByRole('button', { name: 'Probar animación' }).click();
  await expect(page.locator('#status')).toContainText('43 %');
  expect((await page.evaluate(() => (window as any).comparison.shoulderCorrectives.getStates())).every((s: any) => Number.isFinite(s.influence) && s.influence >= 0 && s.influence <= 1)).toBe(true);
  await page.locator('#shoulder-correctives').uncheck();
  expect((await page.evaluate(() => (window as any).comparison.shoulderCorrectives.getStates())).every((s: any) => s.influence === 0)).toBe(true);
  await page.locator('#shoulder-correctives').check();
  for (const id of ['02', '07', '20', '05', '01', '02']) {
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#model-select').selectOption('candidate');
  for (const id of ['02', '07', '20']) {
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    await expect(page.locator('#candidate canvas')).toBeVisible();
    if (!process.env.CI) await page.locator('#candidate').screenshot({ path: `${dir}/${id}-mobile.png` });
  }
  expect(errors).toEqual([]); expect(requests).toHaveLength(2);
  if (!process.env.CI) await writeFile(`${dir}/validation.json`, JSON.stringify({ samples, errors, requests }, null, 2));
});

test('aisla la modificación de pesos frente a 11B.2, sin iluminar distinto', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/poses-3d/dev/compare.html?shoulders&reference=11b2');
  await expect(page.locator('#status')).toContainText('misma pose', { timeout: 30000 });
  await expect(page.locator('#shoulder-correctives')).not.toBeChecked();
  for (const id of ['02', '05', '07', '20']) {
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    for (const camera of ['Frente', 'Espalda', 'Perfil izquierdo', '3/4 derecho']) {
      await page.locator('#camera-select').selectOption(camera);
      await page.locator('#detail-select').selectOption('LeftArm');
      if (!process.env.CI) await page.locator('main').screenshot({ path: `docs/audit/shoulders/weights-${id}-${camera.replaceAll(' ', '-').replace('/', '')}.png` });
      await page.locator('#detail-select').selectOption('');
    }
  }
});
