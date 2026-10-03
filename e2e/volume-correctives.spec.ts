import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('cuatro correctivos reales sobre veinte poses, editor, clip y móvil', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [], models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()); });
  await page.setViewportSize({ width: 1400, height: 850 });
  await page.goto('/poses-3d/dev/compare.html');
  await expect(page.locator('#status')).toContainText('misma pose', { timeout: 30000 });
  await page.locator('#correctives').check();
  const samples = [];
  if (!process.env.CI) await mkdir('docs/audit/volume-correctives', { recursive: true });
  for (let i = 1; i <= 20; i++) {
    const id = String(i).padStart(2, '0');
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    const sample = await page.evaluate(() => {
      const { viewers, correctives } = (window as any).comparison;
      const character = viewers[1].character;
      const point = viewers[1].controls.target.clone();
      let finite = true;
      for (const mesh of character.skinnedMeshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) { mesh.getVertexPosition(i, point); finite &&= point.toArray().every(Number.isFinite); }
      }
      return { finite, states: correctives.getStates(), bones: viewers.map((v: any) => v.exportCurrentPose('test').bones),
        props: viewers.map((v: any) => v.props.children.length),
        floor: character.skinnedMeshes.reduce((minimum: number, mesh: any) => {
          mesh.computeBoundingBox(); return Math.min(minimum, mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld).min.y);
        }, Infinity) };
    });
    expect(sample.finite).toBe(true); expect(sample.bones[1]).toEqual(sample.bones[0]); expect(sample.props[1]).toEqual(sample.props[0]);
    expect(Math.abs(sample.floor)).toBeLessThan(1e-5);
    expect(sample.states).toHaveLength(4);
    for (const state of sample.states) { expect(state.active).toBe(true); expect(state.influence).toBeGreaterThanOrEqual(0); expect(state.influence).toBeLessThanOrEqual(1); }
    samples.push({ id, states: sample.states, finite: sample.finite });
    if (!process.env.CI && ['01', '02', '06', '07', '08', '13', '16', '17', '20'].includes(id)) {
      for (const view of ['Frente', 'Perfil izquierdo', '3/4 derecho']) {
        await page.locator('#camera-select').selectOption(view);
        await page.locator('main').screenshot({ path: `docs/audit/volume-correctives/${id}-${view.replaceAll(' ', '-').replace('/', '')}.png` });
      }
      await page.locator('#model-select').selectOption('candidate');
      await page.locator('#correctives').uncheck();
      await page.locator('#candidate').screenshot({ path: `docs/audit/volume-correctives/${id}-off.png` });
      await page.locator('#correctives').check();
      await page.locator('#candidate').screenshot({ path: `docs/audit/volume-correctives/${id}-on.png` });
      await page.locator('#model-select').selectOption('both');
    }
  }
  const bodies = await page.evaluate(async () => {
    const { viewers, correctives } = (window as any).comparison;
    const viewer = viewers[1], point = viewer.controls.target.clone();
    const samples = [];
    for (const preset of ['neutral', 'lean', 'athletic', 'muscular']) {
      const before = viewer.exportCurrentPose('body').bones;
      await viewer.setBodyPreset(preset); correctives.update(); viewer.character.placeOnFloor();
      let finite = true;
      for (const mesh of viewer.character.skinnedMeshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) { mesh.getVertexPosition(i, point); finite &&= point.toArray().every(Number.isFinite); }
      }
      samples.push({ preset, finite, before, after: viewer.exportCurrentPose('body').bones });
    }
    await viewer.resetBody(); correctives.update();
    return samples;
  });
  for (const body of bodies) { expect(body.finite).toBe(true); expect(body.after).toEqual(body.before); }
  if (!process.env.CI) {
    for (const [id, joint] of [['13', 'LeftForeArm'], ['20', 'RightForeArm'], ['08', 'LeftLeg'], ['06', 'RightLeg']]) {
      await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
      await page.locator('#camera-select').selectOption('3/4 derecho');
      await page.locator('#model-select').selectOption('candidate');
      await page.locator('#detail-select').selectOption(joint!);
      for (const enabled of [false, true]) {
        await page.locator('#correctives').setChecked(enabled);
        await page.locator('#candidate').screenshot({ path: `docs/audit/volume-correctives/detail-${joint}-${enabled ? 'on' : 'off'}.png` });
      }
      await page.locator('#detail-select').selectOption('');
    }
  }
  await page.getByRole('button', { name: 'Probar edición de codo' }).click();
  const states = await page.evaluate(() => (window as any).comparison.correctives.getStates());
  expect(states.every((state: any) => Number.isFinite(state.influence))).toBe(true);
  await page.getByRole('button', { name: 'Probar animación' }).click();
  await expect(page.locator('#status')).toContainText('43 %');
  await page.locator('#correctives').uncheck();
  expect((await page.evaluate(() => (window as any).comparison.correctives.getStates())).every((state: any) => state.influence === 0)).toBe(true);
  await page.locator('#correctives').check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#model-select').selectOption('candidate');
  for (const id of ['07', '08', '13']) {
    await page.locator('#pose-select').selectOption(id); await expect(page.locator('#pose-select')).toBeEnabled();
    await expect(page.locator('#candidate canvas')).toBeVisible();
    if (!process.env.CI) await page.locator('#candidate').screenshot({ path: `docs/audit/volume-correctives/${id}-mobile.png` });
  }
  expect(models).toHaveLength(2); expect(errors).toEqual([]);
  if (!process.env.CI) await writeFile('docs/audit/volume-correctives/validation.json', JSON.stringify({ samples, errors, models }, null, 2));
});
