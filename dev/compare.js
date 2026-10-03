import { PoseViewer } from '../src/viewer/viewer.ts';

const viewers = ['current', 'candidate'].map((id, i) => new PoseViewer(document.querySelector(`#${id}`),
  new URL(`./models/${i ? 'human-anatomy-v2' : 'human-current'}.glb`, import.meta.url).href));
const status = document.querySelector('#status');
const poseSelect = document.querySelector('#pose-select');
const cameraSelect = document.querySelector('#camera-select');
let poses = [], changing = false;
let syncingCamera = false;
for (const viewer of viewers) viewer.controls.addEventListener('change', () => {
  if (syncingCamera) return;
  syncingCamera = true;
  try {
    const other = viewers.find(item => item !== viewer);
    other.camera.position.copy(viewer.camera.position);
    other.camera.quaternion.copy(viewer.camera.quaternion);
    other.camera.fov = viewer.camera.fov;
    other.camera.updateProjectionMatrix();
    other.controls.target.copy(viewer.controls.target);
    other.controls.update();
  } finally { syncingCamera = false; }
});
async function changePose() {
  if (changing) return;
  changing = true; poseSelect.disabled = true;
  try {
    const pose = poses.find(item => item.id === poseSelect.value);
    for (const viewer of viewers) {
      viewer.setEditMode(false); viewer.pauseAnimation();
      await viewer.prepare([pose]); viewer.apply(pose); viewer.setCamera(cameraSelect.value);
    }
    status.textContent = `${pose.name} — misma pose, cámara, luces y material. Candidato pendiente de revisión de skinning.`;
  } catch (error) { status.textContent = error.message; throw error; }
  finally { changing = false; poseSelect.disabled = false; }
}
try {
  const manifest = await (await fetch(`${import.meta.env.BASE_URL}poses/manifest.json`)).json();
  poses = manifest.poses.map(item => ({ ...item, sourceCategory: item.category }));
  poseSelect.replaceChildren(...poses.map(pose => new Option(pose.name, pose.id)));
  for (const viewer of viewers) { await viewer.prepare([]); await viewer.resetBody(); viewer.setMaterial('Anatomía'); viewer.controls.enableDamping = false; }
  await changePose();
  poseSelect.addEventListener('change', changePose);
  cameraSelect.addEventListener('change', () => viewers.forEach(viewer => viewer.setCamera(cameraSelect.value)));
  document.querySelector('#model-select').addEventListener('change', event => { document.body.dataset.view = event.target.value; });
  document.querySelector('#edit').addEventListener('click', () => viewers.forEach(viewer => {
    viewer.setEditMode(true); viewer.selectJoint('mixamorig:LeftForeArm'); viewer.rotateJoint('x', 5);
  }));
  document.querySelector('#animation').addEventListener('click', async () => {
    for (const viewer of viewers) { viewer.setEditMode(false); await viewer.loadAnimation('walk-01'); viewer.seekAnimation(.43); }
    status.textContent = 'walk-01 — frame congelado al 43 % en ambos modelos';
  });
  // Development page only: tests can inspect the actual viewer instances.
  window.comparison = { viewers, changePose };
} catch (error) { status.textContent = `Error: ${error.message}`; throw error; }
window.addEventListener('pagehide', () => viewers.forEach(viewer => viewer.dispose()), { once: true });
