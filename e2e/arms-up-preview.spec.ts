import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('Brazos arriba conserva pose y corrige solo la vista candidata', async ({ page }) => {
  const errors: string[] = [], models: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (r.url().endsWith('.glb')) models.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/poses-3d/dev/compare.html?arms-up');
  await expect(page.locator('#status')).toContainText('Propuesta', { timeout: 30000 });
  await expect(page.locator('#pose-select option')).toHaveCount(1);
  await expect(page.locator('#correctives')).not.toBeVisible();
  const data = await page.evaluate(() => {
    const v = (window as any).comparison.viewers;
    const point = v[1].controls.target.clone();
    let finite = true;
    for (const mesh of v[1].character.skinnedMeshes) {
      mesh.skeleton.update();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point); finite &&= point.toArray().every(Number.isFinite);
      }
    }
    return { bones: v.map((x: any) => x.exportCurrentPose('same').bones), finite };
  });
  expect(data.bones[1]).toEqual(data.bones[0]); expect(data.finite).toBe(true);
  if (!process.env.CI) await mkdir('docs/audit/arms-up-preview', { recursive: true });
  for (const camera of ['Frente', 'Espalda', 'Perfil izquierdo', '3/4 derecho']) {
    await page.locator('#camera-select').selectOption(camera);
    await page.locator('#detail-select').selectOption('Neck');
    if (!process.env.CI) await page.locator('main').screenshot({ path: `docs/audit/arms-up-preview/${camera.replaceAll(' ', '-').replace('/', '')}.png` });
    await page.locator('#detail-select').selectOption('');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#model-select').selectOption('candidate');
  await expect(page.locator('#candidate canvas')).toBeVisible();
  expect(errors).toEqual([]); expect(models).toHaveLength(2);
});
