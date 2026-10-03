import { expect, test } from '@playwright/test';

test('controlador sin targets conserva poses, editor y animación en desktop y móvil', async ({ page }) => {
  const errors: string[] = []; let models = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('/human.glb')) models++; });
  await page.route('**/__pose-correctives-test', route => route.fulfill({ contentType: 'text/html', body: '<div id="viewport" style="width:100vw;height:100vh"></div>' }));
  await page.goto('/poses-3d/__pose-correctives-test');
  await page.evaluate(async () => {
    const { PoseViewer } = await import('/poses-3d/src/viewer/viewer.ts');
    const { PoseCorrectiveController } = await import('/poses-3d/src/anatomy/PoseCorrectiveController.ts');
    const viewer = new PoseViewer(document.querySelector('#viewport')!);
    const manifest = await (await fetch('/poses-3d/poses/manifest.json')).json();
    const poses = [manifest.poses[0], manifest.poses[1], manifest.poses[11]].map((p: any) => ({ ...p, sourceCategory: p.category }));
    await viewer.prepare(poses);
    const correctives = new PoseCorrectiveController(viewer.character.model, viewer.character.skeleton.bones, viewer.bodyMorphs);
    (window as any).correctiveTest = { viewer, poses, correctives };
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const preserved = await page.evaluate(async () => {
      const { viewer, poses, correctives } = (window as any).correctiveTest;
      await viewer.setBodyPreset('athletic');
      const snapshots = [];
      const capture = () => ({ pose: viewer.exportCurrentPose('comparison'), body: viewer.character.skinnedMeshes.map((m: any) => m.morphTargetInfluences.slice()),
        camera: viewer.camera.position.toArray(), props: viewer.props.children.map((p: any) => p.uuid) });
      for (const pose of poses) {
        viewer.apply(pose); const before = capture(); correctives.update(); snapshots.push(JSON.stringify(before) === JSON.stringify(capture()));
      }
      viewer.setEditMode(true); viewer.selectJoint('mixamorig:LeftForeArm'); viewer.rotateJoint('x', 5);
      const edited = capture(); correctives.update(); snapshots.push(JSON.stringify(edited) === JSON.stringify(capture()));
      viewer.setEditMode(false); await viewer.loadAnimation('walk-01'); viewer.seekAnimation(.43);
      const animated = capture(); const animation = JSON.stringify(viewer.animationState()); correctives.update(); correctives.reset();
      snapshots.push(JSON.stringify(animated) === JSON.stringify(capture()), animation === JSON.stringify(viewer.animationState()));
      viewer.stopAnimation();
      return { snapshots, states: correctives.getStates() };
    });
    expect(preserved.states).toEqual([]); expect(preserved.snapshots.every(Boolean)).toBe(true);
  }
  expect(models).toBe(1); expect(errors).toEqual([]);
  await page.evaluate(() => (window as any).correctiveTest.viewer.dispose());
});
