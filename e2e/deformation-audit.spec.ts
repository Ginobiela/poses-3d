import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('audita veinte poses y cuatro cuerpos sin modificar el modelo', async ({ page }, testInfo) => {
  const captureEvidence = !process.env.CI;
  test.setTimeout(process.env.CI ? 360_000 : 180_000);
  const errors: string[] = []; let modelRequests = 0;
  const poseRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => {
    if (request.url().endsWith('/human.glb')) modelRequests++;
    if (/\/poses\/(standing|sitting|action|dynamic)\/.*\.json$/.test(request.url())) poseRequests.push(request.url());
  });
  await page.setViewportSize({ width: 900, height: 900 });
  await page.route('**/__deformation-audit', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><div id="viewport" style="width:100vw;height:100vh"></div></body></html>' }));
  await page.goto('/poses-3d/__deformation-audit');
  const entries = await page.evaluate(async () => {
    const { PoseViewer } = await import('/poses-3d/src/viewer/viewer.ts');
    const manifest = await (await fetch('/poses-3d/poses/manifest.json')).json();
    const viewer = new PoseViewer(document.querySelector('#viewport')!);
    await viewer.prepare([]); await viewer.resetBody();
    viewer.controls.enableDamping = false;
    const poses = manifest.poses.map((entry: any) => ({ ...entry, sourceCategory: entry.category }));
    (window as any).audit = { viewer, poses };
    return poses.map((pose: any) => ({ id: pose.id, name: pose.name, file: pose.file }));
  });
  expect(entries).toHaveLength(20);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const modelSha256 = hash(await readFile('public/models/human-approved/human.glb'));
  const poseSha256 = Object.fromEntries(await Promise.all(entries.map(async (entry: any) =>
    [entry.id, createHash('sha256').update((await readFile(`public/poses/${entry.file}`, 'utf8')).replaceAll('\r\n', '\n')).digest('hex')])));
  expect(poseRequests).toHaveLength(0);
  const samples: any[] = [];
  for (const entry of entries) {
    const baseline = await page.evaluate(async id => {
      const { viewer, poses } = (window as any).audit;
      const pose = poses.find((pose: any) => pose.id === id);
      await viewer.prepare([pose]); await viewer.resetBody(); viewer.apply(pose);
      const body = viewer.character.skinnedMeshes.find((mesh: any) => mesh.name === 'Body');
      body.computeBoundingBox();
      const box = body.boundingBox.clone().applyMatrix4(body.matrixWorld);
      const center = viewer.controls.target.clone(); const size = center.clone();
      box.getCenter(center); box.getSize(size);
      // Audit framing only: same center/distance for every body variant of this pose.
      const distance = Math.max(size.x, size.y, size.z, 1) / (2 * Math.tan(viewer.camera.fov * Math.PI / 360)) * 1.25;
      (window as any).audit.frame = { center, distance };
      return { pose: viewer.exportCurrentPose('audit'), root: viewer.character.root.uuid,
        meshes: viewer.character.skinnedMeshes.map((mesh: any) => mesh.uuid) };
    }, entry.id);
    for (const preset of ['neutral', 'lean', 'athletic', 'muscular']) {
      await page.evaluate(async preset => { await (window as any).audit.viewer.setBodyPreset(preset); }, preset);
      const metrics = await page.evaluate(() => {
        const { viewer } = (window as any).audit;
        const character = viewer.character;
        character.model.updateMatrixWorld(true);
        const vector = () => viewer.controls.target.clone().set(0, 0, 0);
        const world = (name: string) => character.skeleton.bones.get(`mixamorig:${name}`).getWorldPosition(vector());
        const bend = (a: string, b: string, c: string) => {
          const joint = world(b);
          return 180 - world(a).sub(joint).angleTo(world(c).sub(joint)) * 180 / Math.PI;
        };
        let finite = true; let vertices = 0;
        const point = vector();
        for (const mesh of character.skinnedMeshes) {
          mesh.skeleton.update();
          finite &&= mesh.morphTargetInfluences.every((value: number) => Number.isFinite(value) && value >= 0 && value <= 1);
          for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
            mesh.getVertexPosition(index, point);
            finite &&= point.toArray().every(Number.isFinite); vertices++;
          }
        }
        const pose = viewer.exportCurrentPose('audit');
        const validBones = Object.values(pose.bones).every((q: any) => q.every(Number.isFinite) && Math.abs(Math.hypot(...q) - 1) < 1e-6);
        return { finite, vertices, validBones, bones: Object.keys(pose.bones).length, pose,
          root: character.root.uuid, meshes: character.skinnedMeshes.map((mesh: any) => mesh.uuid),
          elbows: [bend('LeftArm', 'LeftForeArm', 'LeftHand'), bend('RightArm', 'RightForeArm', 'RightHand')],
          knees: [bend('LeftUpLeg', 'LeftLeg', 'LeftFoot'), bend('RightUpLeg', 'RightLeg', 'RightFoot')],
          props: viewer.props.children.map((prop: any) => prop.userData.propType) };
      });
      expect(metrics.finite).toBe(true); expect(metrics.validBones).toBe(true);
      expect(metrics.vertices).toBe(15066); expect(metrics.bones).toBe(52);
      expect(metrics.pose).toEqual(baseline.pose); expect(metrics.root).toBe(baseline.root); expect(metrics.meshes).toEqual(baseline.meshes);
      // CI validates every pose/body sample; full visual evidence is generated locally.
      const views = captureEvidence ? (preset === 'neutral' ? ['front', 'left', 'right', 'back'] : ['front']) : ['front'];
      for (const view of views) {
        await page.evaluate(view => {
          const { viewer, frame } = (window as any).audit;
          const directions: Record<string, number[]> = { front: [0, 1], left: [-1, 0], right: [1, 0], back: [0, -1] };
          const [x, z] = directions[view]!;
          viewer.controls.target.copy(frame.center);
          viewer.camera.position.set(frame.center.x + x! * frame.distance, frame.center.y + .15 * frame.distance, frame.center.z + z! * frame.distance);
          viewer.controls.update(); viewer.renderer.render(viewer.scene, viewer.camera);
        }, view);
        if (captureEvidence) await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${entry.id}-${preset}-${view}.png`) });
      }
      const { pose: _, ...record } = metrics;
      samples.push({ id: entry.id, name: entry.name, preset, ...record });
    }
  }
  // Hide props only in diagnostic captures to inspect the occluded hips/gluteus.
  for (const id of ['12', '13']) {
    for (const side of ['left', 'right']) {
      await page.evaluate(async ({ id, side }) => {
        const { viewer, poses } = (window as any).audit;
        await viewer.resetBody(); viewer.apply(poses.find((pose: any) => pose.id === id));
        viewer.props.visible = false;
        viewer.setCamera(side === 'left' ? 'Perfil izquierdo' : 'Perfil derecho');
        viewer.renderer.render(viewer.scene, viewer.camera);
      }, { id, side });
      if (captureEvidence) await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${id}-neutral-no-prop-${side}.png`) });
    }
  }
  await page.evaluate(() => { (window as any).audit.viewer.props.visible = true; });
  // Mobile sample, preserving the same production scene and model instance.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['02', '07', '12', '15', '20']) {
    await page.evaluate(async id => {
      const { viewer, poses } = (window as any).audit;
      await viewer.setBodyPreset('athletic'); viewer.apply(poses.find((pose: any) => pose.id === id));
      viewer.setCamera('3/4 derecho');
    }, id);
    if (captureEvidence) await page.locator('#viewport').screenshot({ path: testInfo.outputPath(`${id}-mobile.png`) });
  }
  expect(modelRequests).toBe(1); expect(poseRequests).toHaveLength(20); expect(new Set(poseRequests).size).toBe(20);
  expect(new Set(samples.map(sample => sample.root)).size).toBe(1);
  expect(errors).toEqual([]);
  await writeFile(testInfo.outputPath('audit-metrics.json'), JSON.stringify({ modelSha256, poseSha256, entries, modelRequests, poseRequests: poseRequests.length, errors, samples }, null, 2));
  await page.evaluate(() => (window as any).audit.viewer.dispose());
});
