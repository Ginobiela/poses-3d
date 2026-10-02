import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Pose } from '../catalog/poses';
import { loadCharacter } from '../character/CharacterLoader';
import { PoseManager } from '../character/PoseManager';
import type { StaticPose } from '../character/SkeletonAdapter';

type PoseFile = { id: string; file: string; type: string };

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
  private animationFrame = 0;
  private disposed = false;

  constructor(private readonly mount: HTMLElement) {
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
    const character = await loadCharacter(`${base}models/human/human.glb`);
    if (this.disposed) {
      character.root.traverse(this.disposeObject);
      throw new Error('El visor se cerró durante la carga.');
    }
    this.poseManager = new PoseManager(character);
    this.mount.dataset.boneCount = String(character.skeleton.bones.size);
    this.scene.add(character.root);
  }

  /** Loads only the JSON files selected for this session; the GLB is loaded once. */
  async prepare(poses: Pose[]) {
    await this.ready;
    if (this.disposed || !this.poseManager) throw new Error('El visor ya no está disponible.');
    const entries = [...new Set(poses.map(pose => pose.id))].map(id => {
      const entry = this.poseFiles.get(id);
      if (!entry || entry.type !== 'static') throw new Error(`No hay una pose riggeada para ${id}.`);
      return entry;
    });
    const loaded = await Promise.all(entries.map(async entry => {
      const response = await fetch(`${import.meta.env.BASE_URL}poses/${entry.file}`);
      if (!response.ok) throw new Error(`No se pudo cargar ${entry.file} (${response.status}).`);
      return { id: entry.id, pose: await response.json() as StaticPose };
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.render);
  };

  setCamera(name: string) {
    const positions: Record<string, THREE.Vector3> = {
      Frontal: new THREE.Vector3(0, 2.05, 4.9),
      'Tres cuartos': new THREE.Vector3(3.5, 2.05, 3.5),
      Lateral: new THREE.Vector3(4.9, 2.05, 0),
      Posterior: new THREE.Vector3(0, 2.05, -4.9),
    };
    this.camera.position.copy(positions[name] ?? positions.Frontal!);
    this.controls.target.set(0, 1.12, 0);
    this.controls.update();
  }
  randomCamera() {
    const names = ['Frontal', 'Tres cuartos', 'Lateral', 'Posterior'];
    this.setCamera(names[Math.floor(Math.random() * names.length)]!);
  }
  setTheme(dark: boolean) {
    this.scene.background = new THREE.Color(dark ? '#252725' : '#eee8df');
    (this.floor.material as THREE.MeshStandardMaterial).color.set(dark ? '#333633' : '#d8d0c5');
  }

  apply(pose: Pose) {
    const name = this.poseNames.get(pose.id);
    if (!name || !this.poseManager) throw new Error(`La pose ${pose.name} no está cargada.`);
    this.poseManager.setStaticPose(name);
    this.mount.dataset.figureSource = 'rigged';
    this.mount.dataset.poseName = name;
  }

  dispose() {
    this.disposed = true;
    this.poseManager?.dispose();
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
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
