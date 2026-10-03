import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`selector Anatomía y regreso a Normal durante práctica a ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; let models = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/poses-3d/');
    await page.getByLabel('Otra duración').fill('120');
    await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
    await expect(page.locator('#viewport')).toHaveAttribute('data-bone-count', '52');
    await page.getByText('Cámara y materiales', { exact: true }).click();
    await expect(page.locator('#material-select option')).toHaveText(['Normal', 'Gris', 'Silueta', 'Anatomía', 'Wireframe']);
    await page.locator('#material-select').selectOption('Normal');
    if (!process.env.CI) await page.locator('#viewport').screenshot({ path: info.outputPath(`normal-${width}.png`) });
    await page.locator('#material-select').selectOption('Anatomía');
    await expect(page.locator('#viewport')).toHaveAttribute('data-material', 'Anatomía');
    if (!process.env.CI) await page.locator('#viewport').screenshot({ path: info.outputPath(`anatomy-${width}.png`) });
    await page.getByRole('button', { name: /Siguiente pose/ }).click();
    await expect(page.locator('#viewport')).toHaveAttribute('data-material', 'Anatomía');
    await page.getByText('Tipo de cuerpo', { exact: true }).click();
    await page.getByLabel('Preset corporal').selectOption('muscular');
    await expect(page.locator('#viewport')).toHaveAttribute('data-body-preset', 'muscular');
    await expect(page.locator('#viewport')).toHaveAttribute('data-material', 'Anatomía');
    await page.getByRole('button', { name: 'Editar pose', exact: true }).click();
    await page.getByLabel('ARTICULACIÓN').selectOption('mixamorig:LeftForeArm');
    await page.getByRole('button', { name: '+5°', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeEnabled();
    for (const mode of ['Gris', 'Silueta', 'Wireframe', 'Anatomía', 'Normal']) {
      await page.locator('#material-select').selectOption(mode);
      await expect(page.locator('#viewport')).toHaveAttribute('data-material', mode);
    }
    await expect(page.getByText('EN CURSO', { exact: true })).toBeVisible();
    expect(models).toBe(1); expect(errors).toEqual([]);
  });
}

test('material Anatomía conserva pose, skinning, morphs, luces, cámara, props y frame de animación', async ({ page }) => {
  const errors: string[] = []; let models = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
  await page.route('**/__anatomy-material-test', route => route.fulfill({ contentType: 'text/html', body: '<div id="viewport" style="width:100vw;height:100vh"></div>' }));
  await page.goto('/poses-3d/__anatomy-material-test');
  const result = await page.evaluate(async () => {
    const { PoseViewer } = await import('/poses-3d/src/viewer/viewer.ts');
    const viewer: any = new PoseViewer(document.querySelector('#viewport')!);
    try {
      const manifest = await (await fetch('/poses-3d/poses/manifest.json')).json();
      const pose = { ...manifest.poses[11], sourceCategory: manifest.poses[11].category };
      await viewer.prepare([pose]); viewer.apply(pose); await viewer.setBodyPreset('muscular');
      viewer.setEditMode(true); viewer.selectJoint('mixamorig:LeftForeArm'); viewer.rotateJoint('x', 5);
      const materials = () => viewer.character.skinnedMeshes.map((mesh: any) => Array.isArray(mesh.material) ? mesh.material.map((m: any) => m.uuid) : mesh.material.uuid);
      const capture = () => ({
        pose: viewer.exportCurrentPose('comparison'), editor: viewer.getEditState(),
        camera: [viewer.camera.position.toArray(), viewer.camera.quaternion.toArray(), viewer.camera.fov, viewer.controls.target.toArray()],
        lights: viewer.scene.children.filter((o: any) => o.isLight).map((o: any) => [o.uuid, o.intensity, o.position.toArray(), o.color.getHex()]),
        renderer: [viewer.renderer.toneMapping, viewer.renderer.toneMappingExposure],
        props: viewer.props.children.map((o: any) => o.uuid),
        meshes: viewer.character.skinnedMeshes.map((m: any) => [m.uuid, m.geometry.uuid, m.skeleton.uuid, m.morphTargetInfluences.slice()]),
      });
      const originalMaterials = materials(); const before = capture();
      viewer.setMaterial('Anatomía'); const during = capture();
      const anatomy = viewer.character.skinnedMeshes.map((m: any) => [m.material.color.getHexString(), m.material.roughness, m.material.metalness]);
      const shared = viewer.character.skinnedMeshes.every((m: any) => m.material === viewer.character.skinnedMeshes[0].material);
      for (const mode of ['Normal', 'Silueta', 'Gris', 'Wireframe', 'Anatomía', 'Normal']) viewer.setMaterial(mode);
      const after = capture(); const restored = materials();
      viewer.setEditMode(false); await viewer.loadAnimation('walk-01'); viewer.seekAnimation(.43);
      const animationBefore = viewer.exportCurrentPose('frame'); const stateBefore = viewer.animationState();
      viewer.setMaterial('Anatomía');
      const animationAfter = viewer.exportCurrentPose('frame'); const stateAfter = viewer.animationState();
      viewer.playAnimation(); viewer.setMaterial('Normal'); const continues = viewer.animationState().playing;
      viewer.pauseAnimation();
      return { before, during, after, originalMaterials, restored, anatomy, shared, animationBefore, animationAfter, stateBefore, stateAfter, continues };
    } finally { viewer.dispose(); }
  });
  expect(result.during).toEqual(result.before); expect(result.after).toEqual(result.before);
  expect(result.before.props.length).toBeGreaterThan(0);
  expect(result.restored).toEqual(result.originalMaterials);
  expect(result.anatomy).toEqual(Array.from({ length: 4 }, () => ['90969c', .48, 0])); expect(result.shared).toBe(true);
  expect(result.animationAfter).toEqual(result.animationBefore); expect(result.stateAfter).toEqual(result.stateBefore);
  expect(result.continues).toBe(true); expect(models).toBe(1); expect(errors).toEqual([]);
});
