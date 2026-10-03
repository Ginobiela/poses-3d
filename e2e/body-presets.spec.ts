import { expect, test } from '@playwright/test';

test('presets conservan personaje, pose editada, props, cámara y animación', async ({ page }, testInfo) => {
  const errors: string[] = [];
  let models = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
  // Development harness uses the production viewer without adding globals or debug UI to the app.
  await page.route('**/__body-presets-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><div id="viewport" style="width:100vw;height:100vh"></div></body></html>' }));
  await page.goto('/poses-3d/__body-presets-test');
  await page.evaluate(async () => {
    const { PoseViewer } = await import('/poses-3d/src/viewer/viewer.ts');
    const manifest = await (await fetch('/poses-3d/poses/manifest.json')).json();
    const entries = [manifest.poses[0], manifest.poses[1], manifest.poses.find((entry: any) => entry.props?.length)];
    const poses = entries.map((entry: any) => ({ ...entry, sourceCategory: entry.category }));
    const viewer = new PoseViewer(document.querySelector('#viewport')!);
    await viewer.prepare(poses); viewer.apply(poses[0]);
    (window as any).bodyTest = { viewer, poses };
  });
  for (const id of ['neutral', 'lean', 'athletic', 'muscular']) {
    await page.evaluate(async id => { await (window as any).bodyTest.viewer.setBodyPreset(id); }, id);
    await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', id);
    await page.waitForTimeout(150);
    await page.screenshot({ path: testInfo.outputPath(`standing-${id}.png`) });
  }
  const result = await page.evaluate(async () => {
    const { viewer, poses } = (window as any).bodyTest;
    viewer.apply(poses[2]); viewer.setEditMode(true); viewer.selectJoint('mixamorig:LeftForeArm'); viewer.rotateJoint('x', 5);
    const capture = () => ({
      pose: viewer.exportCurrentPose('comparison'), edit: viewer.getEditState(),
      camera: viewer.camera.matrix.toArray(), fov: viewer.camera.fov, target: viewer.controls.target.toArray(),
      props: viewer.props.children.map((object: any) => object.uuid),
      meshes: viewer.character.skinnedMeshes.map((mesh: any) => [mesh.uuid, mesh.geometry.uuid, mesh.material.uuid]),
      modelPosition: viewer.character.model.position.toArray(),
      lights: viewer.scene.children.filter((object: any) => object.isLight).map((light: any) => [light.uuid, light.intensity, light.position.toArray()]),
      selected: viewer.transform.object.uuid,
    });
    const before = capture();
    const originalMixer = viewer.player.mixer;
    const originalEditor = viewer.editor;
    const originalCharacter = viewer.character;
    const controls = await viewer.bodyControlStates();
    for (const control of controls) {
      viewer.setBodyControl(control.id, control.min);
      viewer.setBodyControl(control.id, control.max);
    }
    const manualCapture = capture();
    const manualPreset = viewer.getBodyPreset();
    for (const id of ['lean', 'neutral', 'muscular', 'athletic']) await viewer.setBodyPreset(id);
    const after = capture();
    viewer.setEditMode(false); viewer.apply(poses[1]);
    const retained = viewer.getBodyPreset();
    await viewer.loadAnimation('walk-01'); viewer.seekAnimation(.43);
    const animationBefore = viewer.animationState();
    const animationBones = viewer.exportCurrentPose('animation');
    viewer.setBodyControl('height', .02); viewer.setBodyControl('weight', -.25);
    const manualAnimation = viewer.animationState();
    const manualAnimationBones = viewer.exportCurrentPose('animation');
    await viewer.setBodyPreset('muscular');
    const animationAfter = viewer.animationState();
    const animationBonesAfter = viewer.exportCurrentPose('animation');
    viewer.playAnimation(); await viewer.setBodyPreset('lean');
    const stillPlaying = viewer.animationState().playing;
    viewer.pauseAnimation(); viewer.seekAnimation(.43); viewer.freezeAnimation('Walking 43%');
    return { before, after, controls, manualCapture, manualPreset, retained, animationBefore, manualAnimation, manualAnimationBones, animationAfter, animationBones, animationBonesAfter, stillPlaying,
      sameInstances: originalMixer === viewer.player.mixer && originalEditor === viewer.editor && originalCharacter === viewer.character,
      valid: viewer.character.skinnedMeshes.every((mesh: any) => mesh.morphTargetInfluences.every((n: number) => Number.isFinite(n) && n >= 0 && n <= 1)) };
  });
  expect(result.after).toEqual(result.before);
  expect(result.controls).toHaveLength(10);
  expect(result.manualCapture).toEqual(result.before);
  expect(result.manualPreset).toBe('custom');
  expect(result.before.props.length).toBeGreaterThan(0);
  expect(result.retained).toBe('athletic');
  expect(result.animationAfter).toEqual(result.animationBefore);
  expect(result.manualAnimation).toEqual(result.animationBefore);
  expect(result.manualAnimationBones).toEqual(result.animationBones);
  expect(result.animationBonesAfter).toEqual(result.animationBones);
  expect(result.stillPlaying).toBe(true); expect(result.valid).toBe(true);
  expect(result.sameInstances).toBe(true);
  await page.evaluate(() => { const { viewer, poses } = (window as any).bodyTest; viewer.apply(poses[1]); });
  for (const id of ['neutral', 'muscular']) {
    await page.evaluate(async id => { await (window as any).bodyTest.viewer.setBodyPreset(id); }, id);
    await page.waitForTimeout(150); await page.screenshot({ path: testInfo.outputPath(`arms-up-${id}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { const { viewer, poses } = (window as any).bodyTest; viewer.apply(poses[2]); });
  for (const id of ['neutral', 'athletic']) {
    await page.evaluate(async id => { await (window as any).bodyTest.viewer.setBodyPreset(id); }, id);
    await page.waitForTimeout(150); await page.screenshot({ path: testInfo.outputPath(`sitting-mobile-${id}.png`) });
  }
  expect(models).toBe(1); expect(errors).toEqual([]);
  await page.evaluate(() => (window as any).bodyTest.viewer.dispose());
});

test('sliders y presets funcionan en escritorio y móvil durante una práctica', async ({ page }, testInfo) => {
  const errors: string[] = [];
  let models = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
  await page.goto('/poses-3d/');
  await page.getByLabel('Otra duración').fill('120');
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-bone-count', '52');
  await page.getByText('Tipo de cuerpo', { exact: true }).click();
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const selector = page.getByLabel('Preset corporal');
    await expect(selector).toBeVisible();
    const sliders = page.locator('#body-controls input[type=range]');
    await expect(sliders).toHaveCount(10);
    for (const slider of await sliders.all()) {
      await slider.fill((await slider.getAttribute('min'))!);
      await slider.fill((await slider.getAttribute('max'))!);
      await expect(selector).toHaveValue('custom');
    }
    await page.screenshot({ path: testInfo.outputPath(`controls-${size.width}.png`), fullPage: true });
    await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`manual-body-${size.width}.png`) });
    for (const preset of ['lean', 'muscular', 'athletic', 'neutral']) {
      await selector.selectOption(preset);
      await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', preset);
    }
    for (const slider of await sliders.all()) await expect(slider).toHaveValue('0');
    await page.getByLabel('Peso / grasa', { exact: true }).fill('-0.3');
    await expect(page.locator('#body-weight + output')).toHaveText('-30%');
    await page.getByRole('button', { name: /Siguiente pose/ }).click();
    await expect(page.getByLabel('Peso / grasa', { exact: true })).toHaveValue('-0.3');
    await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', 'custom');
    await expect(page.getByText('EN CURSO')).toBeVisible();
  }
  expect(models).toBe(1); expect(errors).toEqual([]);
});
