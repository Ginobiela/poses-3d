import type { PoseViewer } from './viewer/viewer';
import { CAMERA_PRESETS, type MaterialMode } from './viewer/reference';
import { loadCustomPoses, saveCustomPose, deleteCustomPose, type CustomPose } from './storage/customPoses';

export function downloadPose(pose: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pose, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'mi-pose.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function installReferenceTools(viewer: PoseViewer, pauseSession: () => void) {
  const panel = document.querySelector('.session-panel')!;
  const section = document.createElement('section'); section.className = 'reference-tools';
  section.innerHTML = `<details><summary>Animaciones</summary><label for="animation-select">Movimiento</label><select id="animation-select"><option value="">Elegir animación</option></select><div id="animation-controls" hidden><input id="animation-progress" aria-label="Progreso de animación" type="range" min="0" max="1000" value="0"><output id="animation-time"></output><div class="editor-actions"><button id="animation-play" class="editor-button">Reproducir</button><button id="animation-stop" class="editor-button">Detener</button></div><label>Velocidad <select id="animation-speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label><input id="animation-loop" type="checkbox"> Loop</label><button id="freeze-frame" class="secondary-button">Usar este frame como pose</button></div></details>
  <details><summary>Cámara y materiales</summary><div class="reference-cameras">${CAMERA_PRESETS.map(name => `<button class="editor-button" data-reference-camera="${name}">${name}</button>`).join('')}</div><label>Distancia focal <select id="focal-select"><option value="">Actual</option>${[24, 35, 50, 85].map(mm => `<option value="${mm}">${mm} mm</option>`).join('')}</select></label><label>Material <select id="material-select">${['Normal', 'Gris', 'Silueta', 'Wireframe'].map(name => `<option>${name}</option>`).join('')}</select></label></details>
  <details id="my-poses"><summary>Mis poses</summary><button id="save-custom-pose" class="secondary-button">Guardar como pose personalizada</button><input id="import-custom-pose" type="file" accept=".json" aria-label="Importar pose JSON"><div id="custom-pose-list"></div></details><p id="reference-status" role="status"></p>`;
  panel.append(section);
  const q = <T extends HTMLElement>(id: string) => section.querySelector<T>(id)!;
  const status = (text: string) => { q('#reference-status').textContent = text; };
  let provenance: { animationSource?: string; animationProgress?: number } = {};
  let destroyed = false;
  const report = (error: unknown) => status(error instanceof Error ? error.message : String(error));
  const staticMode = (name: string) => {
    q<HTMLElement>('#animation-controls').hidden = true;
    q<HTMLSelectElement>('#animation-select').value = '';
    const title = document.querySelector('#pose-name'); if (title) title.textContent = name;
    const input = document.querySelector<HTMLInputElement>('#export-name'); if (input) input.value = name;
    document.querySelector<HTMLButtonElement>('#editor-toggle')!.disabled = false;
  };
  const load = (pose: CustomPose) => { pauseSession(); viewer.useCustomPose(pose); provenance = { animationSource: pose.animationSource, animationProgress: pose.animationProgress }; staticMode(pose.name); status('Pose cargada.'); };
  const list = () => {
    const mount = q('#custom-pose-list'); mount.replaceChildren();
    for (const pose of loadCustomPoses()) {
      const row = document.createElement('div'); row.className = 'custom-pose-row';
      const name = document.createElement('input'); name.value = pose.name; name.maxLength = 80; name.setAttribute('aria-label', 'Nombre de pose personalizada');
      row.append(name);
      for (const [label, action] of [
        ['Cargar', () => load(pose)],
        ['Renombrar', () => { saveCustomPose({ ...pose, name: name.value.trim() || pose.name }); list(); }],
        ['Eliminar', () => { deleteCustomPose(pose.id); list(); }],
        ['Exportar', () => downloadPose(pose)],
      ] as const) { const button = document.createElement('button'); button.className = 'editor-button'; button.textContent = label; button.onclick = () => { try { action(); } catch (error) { report(error); } }; row.append(button); }
      mount.append(row);
    }
  };
  const save = () => {
    const name = document.querySelector<HTMLInputElement>('#export-name')?.value || 'mi-pose';
    saveCustomPose({ ...viewer.exportCurrentPose(name), ...provenance, category: 'custom', id: crypto.randomUUID(), date: new Date().toISOString() });
    list(); status('Pose guardada en este navegador.');
  };
  q<HTMLButtonElement>('#save-custom-pose').onclick = () => { try { if (viewer.animationState().active) throw new Error('Usá este frame como pose antes de guardar.'); save(); } catch (error) { report(error); } };
  q<HTMLInputElement>('#import-custom-pose').onchange = async event => {
    try {
      const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
      const data = JSON.parse(await file.text());
      const pose: CustomPose = { ...data, id: crypto.randomUUID(), date: new Date().toISOString(), category: 'custom', hipsPosition: data.hipsPosition ?? data.positions?.['mixamorig:Hips'] };
      if (pose.hipsPosition) pose.positions = { ...pose.positions, 'mixamorig:Hips': pose.hipsPosition };
      saveCustomPose(pose); list(); load(pose);
    } catch (error) { report(error); }
  };
  void viewer.animationEntries().then(entries => {
    if (destroyed) return;
    for (const entry of entries) { const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; q<HTMLSelectElement>('#animation-select').append(option); }
  }).catch(report);
  q<HTMLSelectElement>('#animation-select').onchange = async event => {
    const id = (event.target as HTMLSelectElement).value; if (!id) return;
    pauseSession();
    try {
      await viewer.loadAnimation(id); if (destroyed || q<HTMLSelectElement>('#animation-select').value !== id) return;
      q<HTMLElement>('#animation-controls').hidden = false;
      document.querySelector<HTMLButtonElement>('#editor-toggle')!.disabled = true;
      document.querySelector<HTMLElement>('#editor-tools')!.hidden = true;
      document.querySelector<HTMLButtonElement>('#editor-toggle')!.setAttribute('aria-pressed', 'false');
      provenance = {}; q<HTMLInputElement>('#animation-loop').checked = (await viewer.animationEntries()).find(entry => entry.id === id)?.loop ?? false;
      viewer.loopAnimation(q<HTMLInputElement>('#animation-loop').checked); status(''); update();
    } catch (error) { report(error); }
  };
  q<HTMLButtonElement>('#animation-play').onclick = () => { if (viewer.animationState().playing) viewer.pauseAnimation(); else viewer.playAnimation(); update(); };
  q<HTMLButtonElement>('#animation-stop').onclick = () => { viewer.stopAnimation(); staticMode(document.querySelector('#pose-name')?.textContent ?? 'Pose'); };
  q<HTMLInputElement>('#animation-progress').oninput = event => { viewer.seekAnimation(Number((event.target as HTMLInputElement).value) / 1000); update(); };
  q<HTMLSelectElement>('#animation-speed').onchange = event => viewer.speedAnimation(Number((event.target as HTMLSelectElement).value));
  q<HTMLInputElement>('#animation-loop').onchange = event => viewer.loopAnimation((event.target as HTMLInputElement).checked);
  q<HTMLButtonElement>('#freeze-frame').onclick = () => {
    const state = viewer.animationState(); provenance = { animationSource: state.source, animationProgress: state.progress };
    const pose = viewer.freezeAnimation(`${state.source} ${Math.round(state.progress * 100)}%`);
    staticMode(pose.name); status('Frame congelado. Podés editarlo, guardarlo o exportarlo.');
  };
  section.querySelectorAll<HTMLButtonElement>('[data-reference-camera]').forEach(button => button.onclick = () => { viewer.setCamera(button.dataset.referenceCamera!); document.querySelector('#view-label')!.textContent = button.dataset.referenceCamera!; });
  q<HTMLSelectElement>('#focal-select').onchange = event => { const value = Number((event.target as HTMLSelectElement).value); if (value) viewer.setFocal(value); };
  q<HTMLSelectElement>('#material-select').onchange = event => viewer.setMaterial((event.target as HTMLSelectElement).value as MaterialMode);
  function update() {
    const state = viewer.animationState();
    q<HTMLInputElement>('#animation-progress').value = String(Math.round(state.progress * 1000));
    q<HTMLOutputElement>('#animation-time').textContent = `${state.time.toFixed(2)} s / ${state.duration.toFixed(2)} s`;
    q<HTMLButtonElement>('#animation-play').textContent = state.playing ? 'Pausar animación' : 'Reproducir';
    if (!state.active) q<HTMLElement>('#animation-controls').hidden = true;
  }
  const interval = setInterval(update, 100); list();
  const viewport = document.querySelector('#viewport')!;
  const poseChanged = () => {
    provenance = {};
    q<HTMLElement>('#animation-controls').hidden = true;
    q<HTMLSelectElement>('#animation-select').value = '';
    document.querySelector<HTMLButtonElement>('#editor-toggle')!.disabled = false;
  };
  viewport.addEventListener('posechange', poseChanged);
  return () => { destroyed = true; clearInterval(interval); viewport.removeEventListener('posechange', poseChanged); };
}
