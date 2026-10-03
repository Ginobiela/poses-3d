import { PoseViewer } from '../src/viewer/viewer.ts';
import { BodyMorphController } from '../src/anatomy/BodyMorphController.ts';
import { PoseCorrectiveController } from '../src/anatomy/PoseCorrectiveController.ts';

const params = new URLSearchParams(location.search);
const shoulderMode = params.has('shoulders');
const armsUpMode = params.has('arms-up');
const viewers = ['current', 'candidate'].map((id, i) => new PoseViewer(document.querySelector(`#${id}`),
  new URL(`./models/${armsUpMode ? (i ? 'human-arms-up-weights' : 'human-anatomy-correctives') : i ? (shoulderMode ? 'human-shoulders' : params.has('base') ? 'human-anatomy-v2' : 'human-anatomy-correctives') : params.has('reference') && shoulderMode ? 'human-anatomy-correctives' : 'human-current'}.glb`, import.meta.url).href));
const status = document.querySelector('#status');
const poseSelect = document.querySelector('#pose-select');
const cameraSelect = document.querySelector('#camera-select');
let poses = [], changing = false;
let correctives;
let shoulderCorrectives;
let baselineCorrectives;
const correctiveLabel = document.createElement('label');
correctiveLabel.innerHTML = '<input id="correctives" type="checkbox"> Probar correctivos de volumen (no aprobados)';
document.querySelector('header').append(correctiveLabel);
correctiveLabel.hidden = armsUpMode;
if (armsUpMode) correctiveLabel.style.display = 'none';
let shoulderInput;
if (shoulderMode) {
  correctiveLabel.innerHTML = '<input id="correctives" type="checkbox" checked> Codos y rodillas (11B.2)';
  const label = document.createElement('label');
  label.innerHTML = '<input id="shoulder-correctives" type="checkbox"> Ensayo de hombros (gate visual rechazado)';
  document.querySelector('header').append(label);
  shoulderInput = label.querySelector('input');
}
const detailLabel = document.createElement('label');
detailLabel.innerHTML = '<span>Detalle</span><select id="detail-select"><option value="">Cuerpo completo</option><option value="LeftForeArm">Codo izquierdo</option><option value="RightForeArm">Codo derecho</option><option value="LeftLeg">Rodilla izquierda</option><option value="RightLeg">Rodilla derecha</option></select>';
document.querySelector('header').append(detailLabel);
if (shoulderMode || armsUpMode) for (const side of ['Left', 'Right']) {
  document.querySelector('#detail-select').add(new Option(`Hombro ${side === 'Left' ? 'izquierdo' : 'derecho'}`, `${side}Arm`));
}
if (armsUpMode) document.querySelector('#detail-select').add(new Option('Ambos hombros', 'Neck'));
document.querySelector('#detail-select').addEventListener('change', event => {
  if (!event.target.value) { viewers.forEach(viewer => { viewer.controls.minDistance = 3.2; viewer.setCamera(cameraSelect.value); }); return; }
  const current = viewers[0];
  const direction = current.camera.position.clone().sub(current.controls.target).normalize();
  const center = current.character.skeleton.bones.get(`mixamorig:${event.target.value}`).getWorldPosition(current.controls.target.clone());
  for (const viewer of viewers) {
    viewer.controls.minDistance = .25;
    viewer.controls.target.copy(center);
    viewer.camera.position.copy(center).addScaledVector(direction, event.target.value === 'Neck' ? 1.4 : 1.1);
    viewer.controls.update();
  }
});
document.querySelector('#candidate').previousElementSibling.textContent = 'CANDIDATO — experimental';
if (armsUpMode) document.querySelector('#candidate').previousElementSibling.textContent = 'DESPUÉS — propuesta';
const correctiveInput = document.querySelector('#correctives');
const updateCorrectives = () => {
  if (!correctives) return;
  if (correctiveInput.checked) correctives.update(); else correctives.reset();
  if (baselineCorrectives) {
    if (correctiveInput.checked) baselineCorrectives.update(); else baselineCorrectives.reset();
    viewers[0].character.placeOnFloor();
  }
  if (shoulderCorrectives) {
    if (shoulderInput.checked) shoulderCorrectives.update(); else shoulderCorrectives.reset();
  }
  viewers[1].character.placeOnFloor();
};
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
    updateCorrectives();
    status.textContent = armsUpMode ? 'Brazos arriba — misma pose, cámara, luces y material. Propuesta de pesos clavícula/tórax/brazo.'
      : `${pose.name} — misma pose, cámara, luces y material. Candidato pendiente de revisión de skinning.`;
  } catch (error) { status.textContent = error.message; throw error; }
  finally { changing = false; poseSelect.disabled = false; }
}
try {
  const manifest = await (await fetch(`${import.meta.env.BASE_URL}poses/manifest.json`)).json();
  poses = manifest.poses.map(item => ({ ...item, sourceCategory: item.category }));
  if (armsUpMode) {
    poses = poses.filter(p => p.id === '02');
    document.querySelector('#edit').hidden = true; document.querySelector('#animation').hidden = true;
    document.querySelector('#current').previousElementSibling.textContent = 'ANTES';
  }
  poseSelect.replaceChildren(...poses.map(pose => new Option(pose.name, pose.id)));
  for (const viewer of viewers) { await viewer.prepare([]); await viewer.resetBody(); viewer.setMaterial('Anatomía'); viewer.controls.enableDamping = false; }
  if (!new URLSearchParams(location.search).has('base')) {
    const data = await (await fetch(new URL('./models/volume-correctives.json', import.meta.url))).json();
    const character = viewers[1].character;
    correctives = new PoseCorrectiveController(character.model, character.skeleton.bones,
      new BodyMorphController(character.skinnedMeshes), data.correctives.map(item => ({
        id: item.name, joint: item.name, morph: item.name, startAngle: item.startAngle, fullAngle: item.fullAngle,
        measurement: { type: 'bend', boneA: `mixamorig:${item.pair[0]}`, boneB: `mixamorig:${item.pair[1]}`, boneC: `mixamorig:${item.end}` },
      })));
    if (shoulderMode && params.has('reference')) {
      const baseline = viewers[0].character;
      baselineCorrectives = new PoseCorrectiveController(baseline.model, baseline.skeleton.bones,
        new BodyMorphController(baseline.skinnedMeshes), data.correctives.map(item => ({
          id: item.name, joint: item.name, morph: item.name, startAngle: item.startAngle, fullAngle: item.fullAngle,
          measurement: { type: 'bend', boneA: `mixamorig:${item.pair[0]}`, boneB: `mixamorig:${item.pair[1]}`, boneC: `mixamorig:${item.end}` },
        })));
      document.querySelector('#current').previousElementSibling.textContent = 'ORIGINAL — candidato 11B.2';
    }
    viewers[1].transform.addEventListener('objectChange', updateCorrectives);
    if (shoulderMode) {
      const data = await (await fetch(new URL('./models/shoulder-correctives.json', import.meta.url))).json();
      shoulderCorrectives = new PoseCorrectiveController(character.model, character.skeleton.bones,
        new BodyMorphController(character.skinnedMeshes), data.correctives.map(item => item.config));
      shoulderInput.addEventListener('change', updateCorrectives);
    }
  } else correctiveInput.disabled = true;
  correctiveInput.addEventListener('change', updateCorrectives);
  await changePose();
  if (armsUpMode) {
    document.querySelector('#detail-select').value = 'Neck';
    document.querySelector('#detail-select').dispatchEvent(new Event('change'));
  }
  poseSelect.addEventListener('change', changePose);
  cameraSelect.addEventListener('change', () => {
    viewers.forEach(viewer => viewer.setCamera(cameraSelect.value));
    if (armsUpMode) document.querySelector('#detail-select').dispatchEvent(new Event('change'));
  });
  document.querySelector('#model-select').addEventListener('change', event => { document.body.dataset.view = event.target.value; });
  document.querySelector('#edit').addEventListener('click', () => viewers.forEach(viewer => {
    viewer.setEditMode(true); viewer.selectJoint('mixamorig:LeftForeArm'); viewer.rotateJoint('x', 5);
    updateCorrectives();
  }));
  document.querySelector('#animation').addEventListener('click', async () => {
    for (const viewer of viewers) { viewer.setEditMode(false); await viewer.loadAnimation('walk-01'); viewer.seekAnimation(.43); }
    updateCorrectives();
    status.textContent = 'walk-01 — frame congelado al 43 % en ambos modelos';
  });
  // Development page only: tests can inspect the actual viewer instances.
  window.comparison = { viewers, changePose, correctives, shoulderCorrectives, updateCorrectives };
} catch (error) { status.textContent = `Error: ${error.message}`; throw error; }
window.addEventListener('pagehide', () => viewers.forEach(viewer => viewer.dispose()), { once: true });
