import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('compara candidato y original con veinte poses, edición, clips y vistas desktop/móvil', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [], models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()); });
  await page.setViewportSize({ width: 1400, height: 850 });
  await page.goto('/poses-3d/dev/compare.html');
  await expect(page.locator('#status')).toContainText('misma pose');
  await mkdir('docs/audit/anatomy-candidate', { recursive: true });
  const samples = [];
  for (let i = 1; i <= 20; i++) {
    const id = String(i).padStart(2, '0');
    await page.locator('#pose-select').selectOption(id);
    await expect(page.locator('#pose-select')).toBeEnabled();
    const result = await page.evaluate(() => {
      const viewers = (window as any).comparison.viewers;
      const poses = viewers.map((viewer: any) => viewer.exportCurrentPose('comparison'));
      const finite = viewers.every((viewer: any) => viewer.character.skinnedMeshes.every((mesh: any) => {
        mesh.skeleton.update();
        const point = viewer.controls.target.clone();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point);
          if (!point.toArray().every(Number.isFinite)) return false;
        }
        return true;
      }));
      return { bones: poses.map((pose: any) => pose.bones), finite,
        props: viewers.map((viewer: any) => viewer.props.children.length),
        counts: viewers.map((viewer: any) => viewer.character.skeleton.bones.size) };
    });
    expect(result.bones[1]).toEqual(result.bones[0]); expect(result.finite).toBe(true);
    expect(result.props[1]).toEqual(result.props[0]); expect(result.counts).toEqual([52, 52]);
    samples.push({ id, finite: result.finite, props: result.props[0] });
    if (!process.env.CI && ['01', '02', '07', '08', '13', '16', '17', '20'].includes(id)) {
      for (const view of ['Frente', 'Perfil izquierdo', '3/4 derecho']) {
        await page.locator('#camera-select').selectOption(view);
        await page.locator('main').screenshot({ path: `docs/audit/anatomy-candidate/${id}-${view.replaceAll(' ', '-').replace('/', '')}.png` });
      }
    }
  }
  await page.getByRole('button', { name: 'Probar edición de codo' }).click();
  const edited = await page.evaluate(() => (window as any).comparison.viewers.map((viewer: any) => ({ pose: viewer.exportCurrentPose('edit').bones, undo: viewer.getEditState().canUndo })));
  expect(edited[1]).toEqual(edited[0]); expect(edited[0].undo).toBe(true);
  await page.getByRole('button', { name: 'Probar animación' }).click();
  await expect(page.locator('#status')).toContainText('43 %');
  const clips = await page.evaluate(() => (window as any).comparison.viewers.map((viewer: any) => viewer.exportCurrentPose('frame').bones));
  expect(clips[1]).toEqual(clips[0]);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['02', '07', '13']) {
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    for (const model of ['current', 'candidate']) {
      await page.locator('#model-select').selectOption(model);
      await expect(page.locator(`#${model} canvas`)).toBeVisible();
      if (!process.env.CI) await page.locator(`#${model}`).screenshot({ path: `docs/audit/anatomy-candidate/${id}-mobile-${model}.png` });
    }
  }
  expect(models).toHaveLength(2); expect(new Set(models).size).toBe(2); expect(errors).toEqual([]);
  if (!process.env.CI) await writeFile('docs/audit/anatomy-candidate/validation.json', JSON.stringify({ samples, models: 2, errors }, null, 2));
});
