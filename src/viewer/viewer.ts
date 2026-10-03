import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Pose } from '../catalog/poses';
import { loadCharacter, type Character } from '../character/CharacterLoader';
import { PoseManager } from '../character/PoseManager';
import type { StaticPose } from '../character/SkeletonAdapter';
import { EDITABLE_JOINTS, PoseEditor } from '../editor/PoseEditor';
import { createProp, disposeProp, validateProps, type PropDefinition } from './props';
import { AnimationLibrary } from '../animation/AnimationLibrary';
import { AnimationPlayer } from '../animation/AnimationPlayer';
import { cameraPosition, CAMERA_PRESETS, focalFov, ReferenceMaterials, type MaterialMode } from './reference';
import { BodyMorphController } from '../anatomy/BodyMorphController';
import { applyBodyPreset, type BodyPresetId } from '../anatomy/bodyPresets';
import { clearManualBodyControls, getBodyControlStates, setBodyControl, type BodyControlState } from '../anatomy/bodyControls';
import { restoreBodyConfiguration } from '../anatomy/restoreBodyConfiguration';
import { loadBodyConfiguration, saveBodyConfiguration, neutralBodyConfiguration, type BodyConfiguration } from '../storage/bodyConfiguration';

type PoseFile = { id: string; file: string; type: string; category: string; props?: PropDefinition[] };

export class PoseViewer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly floor: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver;
  private readonly poseFiles = new Map<string, PoseFile>();
  private readonly poseNames = new Map<string, string>();
  private readonly ready: Promise<void>;
  private poseManager?: PoseManager;
  private readonly animationLibrary = new AnimationLibrary();
  private player?: AnimationPlayer;
  private referenceMaterials?: ReferenceMaterials;
  private bodyMorphs?: BodyMorphController;
  private bodyPreset: BodyPresetId | 'custom' = 'neutral';
  private bodyConfiguration: BodyConfiguration = neutralBodyConfiguration();
  private bodyStorageSaved = true;
  private readonly poseCache = new Map<string, Promise<StaticPose>>();
  private lastFrame = performance.now();
  private loadVersion = 0;
  private character?: Character;
  private editor?: PoseEditor;
  private transform?: TransformControls;
  private readonly props = new THREE.Group();
  private readonly selectionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(.045, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#df6946', depthTest: false }),
  );
  private editing = false;
  private currentPose?: Pose;
  private currentCategory = 'standing';
  private draggingTransform = false;
  private animationFrame = 0;
  private disposed = false;

  constructor(private readonly mount: HTMLElement, private readonly modelUrl = `${import.meta.env.BASE_URL}models/human/human.glb`) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    mount.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#eee8df');
    this.camera.position.set(0, 2.05, 4.9);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.12, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 10;
    this.controls.minPolarAngle = .25;
    this.controls.maxPolarAngle = Math.PI * .88;

    this.scene.add(new THREE.HemisphereLight('#fff8ee', '#78675e', 2));
    const key = new THREE.DirectionalLight('#fffaf3', 2.8);
    key.position.set(-3.5, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -3;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#d4dce0', 1);
    fill.position.set(4, 2, -4);
    this.scene.add(fill);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(5.5, 64), new THREE.MeshStandardMaterial({ color: '#d8d0c5', roughness: .9 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -.035;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.58, 64), new THREE.MeshStandardMaterial({ color: '#c6b9ab', roughness: .85 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -.024;
    disc.receiveShadow = true;
    this.scene.add(disc);
    this.scene.add(this.props);
    this.selectionMarker.visible = false;
    this.selectionMarker.renderOrder = 100;
    this.scene.add(this.selectionMarker);
    this.renderer.domElement.addEventListener('pointerdown', this.pickJoint);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    this.render();
    this.ready = this.loadRiggedCharacter();
  }

  private async loadRiggedCharacter() {
    const base = import.meta.env.BASE_URL;
    const response = await fetch(`${base}poses/manifest.json`);
    if (!response.ok) throw new Error(`No se pudo leer el catálogo de poses (${response.status}).`);
    const manifest = await response.json() as { poses: PoseFile[] };
    for (const entry of manifest.poses) this.poseFiles.set(entry.id, entry);
    const character = await loadCharacter(this.modelUrl);
    if (this.disposed) {
      character.root.traverse(this.disposeObject);
      throw new Error('El visor se cerró durante la carga.');
    }
    this.poseManager = new PoseManager(character);
    this.character = character;
    this.bodyMorphs = new BodyMorphController(character.skinnedMeshes);
    this.bodyConfiguration = loadBodyConfiguration();
    restoreBodyConfiguration(this.bodyMorphs, this.bodyConfiguration);
    this.bodyPreset = Object.keys(this.bodyConfiguration.manual).length ? 'custom' : this.bodyConfiguration.preset;
    this.mount.dataset.bodyPreset = this.bodyPreset;
    this.player = new AnimationPlayer(character, this.animationLibrary);
    this.referenceMaterials = new ReferenceMaterials(character.skinnedMeshes);
    this.editor = new PoseEditor(character);
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setMode('rotate');
    this.transform.setSpace('local');
    this.transform.setSize(.68);
    this.transform.addEventListener('dragging-changed', event => {
      this.draggingTransform = Boolean(event.value);
      this.controls.enabled = !this.draggingTransform;
      this.mount.dataset.orbitEnabled = String(this.controls.enabled);
    });
    this.transform.addEventListener('objectChange', () => this.editor?.clampSelected());
    this.transform.addEventListener('mouseUp', () => { this.editor?.commit(); this.notifyEdit(); });
    this.scene.add(this.transform.getHelper());
    this.mount.dataset.boneCount = String(character.skeleton.bones.size);
    this.scene.add(character.root);
  }

  /** Loads only the JSON files selected for this session; the GLB is loaded once. */
  async prepare(poses: Pose[]) {
    await this.ready;
    if (this.disposed || !this.poseManager) throw new Error('El visor ya no está disponible.');
    for (const pose of poses) if (pose.data) {
      const name = `local:${pose.id}`;
      this.poseManager.addStaticPose({ ...pose.data, name }); this.poseNames.set(pose.id, name);
    }
    const entries = [...new Set(poses.filter(pose => !pose.data).map(pose => pose.id))].map(id => {
      const entry = this.poseFiles.get(id);
      if (!entry || entry.type !== 'static') throw new Error(`No hay una pose riggeada para ${id}.`);
      return entry;
    });
    const loaded = await Promise.all(entries.map(async entry => {
      let promise = this.poseCache.get(entry.file);
      if (!promise) {
        promise = fetch(`${import.meta.env.BASE_URL}poses/${entry.file}`).then(async response => {
          if (!response.ok) throw new Error(`No se pudo cargar ${entry.file} (${response.status}).`);
          return await response.json() as StaticPose;
        }).catch(error => { this.poseCache.delete(entry.file); throw error; });
        this.poseCache.set(entry.file, promise);
      }
      return { id: entry.id, pose: await promise };
    }));
    if (this.disposed) throw new Error('El visor se cerró durante la carga.');
    for (const { id, pose } of loaded) {
      this.poseManager.addStaticPose(pose);
      this.poseNames.set(id, pose.name);
    }
  }

  private disposeObject = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
  };

  private resize() {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
  private render = () => {
    if (this.disposed) return;
    const now = performance.now();
    this.player?.update((now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.controls.update();
    if (this.editing && this.editor?.bone) {
      this.editor.bone.getWorldPosition(this.selectionMarker.position);
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.render);
  };

  setCamera(name: string) {
    this.camera.position.copy(cameraPosition(name));
    this.controls.target.set(0, 1.12, 0);
    this.controls.update();
  }
  randomCamera() {
    const names = CAMERA_PRESETS;
    this.setCamera(names[Math.floor(Math.random() * names.length)]!);
  }
  setTheme(dark: boolean) {
    this.scene.background = new THREE.Color(dark ? '#252725' : '#eee8df');
    (this.floor.material as THREE.MeshStandardMaterial).color.set(dark ? '#333633' : '#d8d0c5');
  }

  apply(pose: Pose) {
    const name = this.poseNames.get(pose.id);
    if (!name || !this.poseManager) throw new Error(`La pose ${pose.name} no está cargada.`);
    this.loadVersion++;
    this.player?.stop();
    this.poseManager.setStaticPose(name);
    this.currentPose = pose;
    this.currentCategory = pose.sourceCategory ?? pose.data?.category ?? this.poseFiles.get(pose.id)?.category ?? 'standing';
    this.editor?.beginPose(Boolean(pose.data));
    this.updateSelection();
    this.replaceProps(this.poseFiles.get(pose.id)?.props);
    this.mount.dataset.figureSource = 'rigged';
    this.mount.dataset.poseName = name;
    this.mount.dataset.animationId = '';
    this.mount.dispatchEvent(new Event('posechange'));
  }

  animationEntries() { return this.animationLibrary.entries(); }
  async loadAnimation(id: string) {
    await this.ready;
    const version = ++this.loadVersion;
    await this.animationLibrary.loadAnimation(id);
    if (this.disposed || version !== this.loadVersion) return;
    this.setEditMode(false);
    await this.player!.loadAnimation(id);
    if (this.disposed || version !== this.loadVersion) return;
    this.replaceProps(undefined);
    this.mount.dataset.animationId = id;
  }
  animationState() {
    const p = this.player;
    return { active: Boolean(p?.activeEntry), playing: p?.isPlaying ?? false, time: p?.currentTime ?? 0, duration: p?.duration ?? 0, progress: p?.progress ?? 0, source: p?.activeEntry?.id };
  }
  playAnimation() { this.player?.play(); }
  pauseAnimation() { this.player?.pause(); }
  seekAnimation(progress: number) { this.player?.setProgress(progress); }
  speedAnimation(speed: number) { this.player?.setSpeed(speed); }
  loopAnimation(loop: boolean) { this.player?.setLoop(loop); }
  stopAnimation() { this.player?.stop(); if (this.currentPose) this.apply(this.currentPose); return this.currentPose?.name; }
  freezeAnimation(name: string) {
    if (!this.player) throw new Error('No hay animación.');
    const pose = this.player.freezeFrame(name);
    this.useCustomPose(pose);
    return pose;
  }
  useCustomPose(pose: StaticPose) {
    if (!this.poseManager) throw new Error('El modelo aún no está cargado.');
    this.loadVersion++;
    this.player?.stop();
    const id = 'local-current';
    const name = `local:${id}`;
    this.poseNames.set(id, name);
    this.poseManager.addStaticPose({ ...pose, name });
    this.poseManager.setStaticPose(name);
    this.currentPose = { id, name: pose.name, category: 'Custom', data: pose };
    this.currentCategory = pose.category ?? 'custom';
    this.editor?.beginPose(true);
    this.replaceProps(undefined);
    this.updateSelection();
    this.notifyEdit();
    this.mount.dataset.poseName = pose.name;
    this.mount.dataset.animationId = '';
  }
  setFocal(mm: number) { this.camera.fov = mm === 0 ? 32 : focalFov(mm); this.camera.updateProjectionMatrix(); this.mount.dataset.focal = mm ? String(mm) : ''; }
  setMaterial(mode: MaterialMode) { this.referenceMaterials?.set(mode); this.mount.dataset.material = mode; }

  async setBodyPreset(id: BodyPresetId): Promise<void> {
    await this.ready;
    if (this.disposed || !this.bodyMorphs) throw new Error('El visor ya no está disponible.');
    applyBodyPreset(this.bodyMorphs, id);
    clearManualBodyControls(this.bodyMorphs);
    this.bodyPreset = id;
    this.bodyConfiguration = { version: 1, preset: id, manual: {} };
    this.bodyStorageSaved = saveBodyConfiguration(this.bodyConfiguration);
    this.mount.dataset.bodyPreset = id;
  }

  getBodyPreset(): BodyPresetId | 'custom' { return this.bodyPreset; }
  getBodyConfiguration(): BodyConfiguration {
    return { ...this.bodyConfiguration, manual: { ...this.bodyConfiguration.manual } };
  }
  bodyStorageMessage(): string {
    return this.bodyStorageSaved ? '' : 'Cambios aplicados. No se pudo guardar la configuración corporal.';
  }
  async resetBody(): Promise<void> { await this.setBodyPreset('neutral'); }

  async bodyControlStates(): Promise<BodyControlState[]> {
    await this.ready;
    if (this.disposed || !this.bodyMorphs) throw new Error('El visor ya no está disponible.');
    return getBodyControlStates(this.bodyMorphs);
  }

  setBodyControl(id: string, value: number): number {
    if (this.disposed || !this.bodyMorphs) throw new Error('El modelo no está disponible.');
    const applied = setBodyControl(this.bodyMorphs, id, value);
    this.bodyPreset = 'custom';
    this.bodyConfiguration.manual[id] = applied;
    this.bodyStorageSaved = saveBodyConfiguration(this.bodyConfiguration);
    this.mount.dataset.bodyPreset = 'custom';
    return applied;
  }

  private replaceProps(definitions: PropDefinition[] | undefined) {
    for (const child of [...this.props.children]) disposeProp(child as THREE.Group);
    for (const definition of validateProps(definitions)) this.props.add(createProp(definition));
    this.mount.dataset.propsCount = String(this.props.children.length);
    this.mount.dataset.propTypes = this.props.children.map(child => child.userData.propType).join(',');
  }

  private readonly pickJoint = (event: PointerEvent) => {
    if (!this.editing || !this.character || !this.editor || this.draggingTransform || this.transform?.dragging || this.transform?.axis) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObjects(this.character.skinnedMeshes, false)[0];
    if (!hit) return;
    let closest = '';
    let distance = Infinity;
    const location = new THREE.Vector3();
    for (const [name] of EDITABLE_JOINTS) {
      const bone = this.character.skeleton.bones.get(name);
      if (!bone) continue;
      bone.getWorldPosition(location);
      const current = location.distanceToSquared(hit.point);
      if (current < distance) { closest = name; distance = current; }
    }
    if (closest) this.selectJoint(closest);
  };

  private updateSelection() {
    if (!this.transform || !this.editor) return;
    this.transform.detach();
    this.selectionMarker.visible = this.editing;
    if (this.editing && this.editor.bone) this.transform.attach(this.editor.bone);
    this.mount.dataset.selectedBone = this.editor.selected;
  }
  private notifyEdit() {
    this.mount.dispatchEvent(new CustomEvent('poseedit', { detail: {
      selected: this.editor?.selected,
      canUndo: this.editor?.canUndo ?? false,
      canRedo: this.editor?.canRedo ?? false,
    } }));
  }
  setEditMode(enabled: boolean) {
    if (!this.editor) throw new Error('El modelo aún no está cargado.');
    if (enabled && this.player?.activeEntry) throw new Error('Congelá el frame antes de editar.');
    this.editing = enabled;
    this.transform?.setMode('rotate');
    this.controls.enabled = true;
    this.mount.dataset.orbitEnabled = 'true';
    this.updateSelection();
    this.mount.dataset.editMode = String(enabled);
    this.notifyEdit();
  }
  selectJoint(name: string) {
    this.editor?.select(name);
    this.updateSelection();
    this.notifyEdit();
  }
  setHipsTranslation(enabled: boolean) {
    if (!this.editing || !this.transform || !this.editor) return;
    if (enabled && this.editor.selected !== 'mixamorig:Hips') this.selectJoint('mixamorig:Hips');
    this.transform.setMode(enabled ? 'translate' : 'rotate');
    this.transform.showY = !enabled; // The figure stays grounded on Y=0.
    this.notifyEdit();
  }
  resetJoint() { this.editor?.resetJoint(); this.updateSelection(); this.notifyEdit(); }
  rotateJoint(axis: 'x' | 'y' | 'z', degrees: number) {
    const changed = this.editor?.rotateSelected(axis, degrees) ?? false;
    this.notifyEdit();
    return changed;
  }
  resetPose() { this.editor?.resetPose(); this.updateSelection(); this.notifyEdit(); }
  undo() { const changed = this.editor?.undo() ?? false; this.updateSelection(); this.notifyEdit(); return changed; }
  redo() { const changed = this.editor?.redo() ?? false; this.updateSelection(); this.notifyEdit(); return changed; }
  exportCurrentPose(name: string) {
    if (!this.editor) throw new Error('No hay una pose para exportar.');
    return this.editor.exportPose(name, this.currentCategory);
  }
  getEditState() { return { selected: this.editor?.selected ?? '', canUndo: this.editor?.canUndo ?? false, canRedo: this.editor?.canRedo ?? false }; }

  dispose() {
    this.disposed = true;
    this.loadVersion++;
    this.player?.dispose();
    this.referenceMaterials?.dispose();
    this.poseManager?.dispose();
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.pickJoint);
    this.transform?.detach();
    if (this.transform) this.scene.remove(this.transform.getHelper());
    this.transform?.dispose();
    for (const child of [...this.props.children]) disposeProp(child as THREE.Group);
    this.renderer.dispose();
    this.mount.replaceChildren();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
      else materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
}
