import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Pose } from '../catalog/poses';
import { loadCharacter, type Character } from '../character/CharacterLoader';
import { PoseManager } from '../character/PoseManager';
import type { StaticPose } from '../character/SkeletonAdapter';

type Profile = readonly (readonly [number, number, number])[];
type Limb = { upperArm: THREE.Mesh; forearm: THREE.Mesh; hand: THREE.Mesh; thigh: THREE.Mesh; calf: THREE.Mesh; foot: THREE.Mesh };
type Joints = { shoulder: THREE.Mesh; elbow: THREE.Mesh; wrist: THREE.Mesh; knee: THREE.Mesh; ankle: THREE.Mesh };

const Y = new THREE.Vector3(0, 1, 0);
const radians = (degrees: number) => degrees * Math.PI / 180;

/** Smooth, elliptical cross sections. The y coordinate is later scaled to the bone length. */
function profileGeometry(profile: Profile, sides = 24): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [t, width, depth] of profile) {
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2;
      positions.push(Math.cos(angle) * width, t - .5, Math.sin(angle) * depth);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side;
      const b = ring * sides + (side + 1) % sides;
      const c = (ring + 1) * sides + side;
      const d = (ring + 1) * sides + (side + 1) % sides;
      indices.push(a, c, b, b, c, d);
    }
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, -.5, 0);
  const topCenter = positions.length / 3;
  positions.push(0, .5, 0);
  const topStart = (profile.length - 1) * sides;
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    indices.push(bottomCenter, side, next);
    indices.push(topCenter, topStart + next, topStart + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const BODY: Profile = [
  [0, .20, .14], [.12, .23, .16], [.29, .22, .16],
  [.48, .25, .18], [.68, .30, .20], [.84, .34, .19], [.94, .18, .14], [1, .095, .09],
];
const HEAD: Profile = [[0, .055, .06], [.13, .1, .105], [.32, .14, .135], [.58, .15, .14], [.85, .115, .11], [1, .035, .04]];
const PELVIS: Profile = [[0, .19, .14], [.2, .27, .19], [.55, .29, .20], [1, .22, .15]];
const UPPER_ARM: Profile = [[0, .095, .09], [.2, .115, .105], [.5, .105, .095], [.8, .083, .078], [1, .07, .065]];
const FOREARM: Profile = [[0, .073, .07], [.28, .092, .085], [.6, .073, .07], [.9, .052, .048], [1, .045, .043]];
const HAND: Profile = [[0, .045, .04], [.28, .075, .045], [.66, .071, .043], [1, .028, .025]];
const THIGH: Profile = [[0, .14, .135], [.2, .16, .15], [.5, .148, .14], [.82, .108, .105], [1, .09, .09]];
const CALF: Profile = [[0, .09, .09], [.28, .118, .11], [.55, .112, .10], [.86, .064, .065], [1, .058, .058]];
const FOOT: Profile = [[0, .075, .068], [.36, .105, .065], [.75, .102, .055], [1, .074, .04]];

export class PoseViewer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly root = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly pelvis: THREE.Mesh;
  private readonly head: THREE.Group;
  private readonly neck: THREE.Mesh;
  private readonly limbs: Limb[] = [];
  private readonly joints: Joints[] = [];
  private readonly floor: THREE.Mesh;
  private readonly seat = new THREE.Group();
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private disposed = false;
  private character?: Character;
  private poseManager?: PoseManager;
  private characterPoses = new Map<string, { name: string; file: string }>();
  private poseRequests = new Map<string, Promise<void>>();
  private activePose?: Pose;

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

    const seatMaterial = new THREE.MeshStandardMaterial({ color: '#8f8b82', roughness: .9 });
    const seatTop = new THREE.Mesh(new THREE.BoxGeometry(.72, .07, .56), seatMaterial);
    seatTop.position.set(0, .62, -.17);
    seatTop.castShadow = true;
    seatTop.receiveShadow = true;
    this.seat.add(seatTop);
    for (const x of [-.28, .28]) for (const z of [-.38, .04]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .58, 8), seatMaterial);
      leg.position.set(x, .3, z);
      leg.castShadow = true;
      this.seat.add(leg);
    }
    this.seat.visible = false;
    this.scene.add(this.seat);

    const clay = new THREE.MeshStandardMaterial({ color: '#b96e53', roughness: .79 });
    const makeMesh = (geometry: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geometry, clay);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    const sphere = (x: number, y: number, z: number) => {
      const mesh = makeMesh(new THREE.SphereGeometry(1, 24, 18));
      mesh.scale.set(x, y, z);
      return mesh;
    };
    this.torso = makeMesh(profileGeometry(BODY));
    this.pelvis = makeMesh(profileGeometry(PELVIS));
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(profileGeometry(HEAD), clay);
    skull.scale.y = .34;
    skull.castShadow = true;
    this.head.add(skull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.042, .095, 12), clay);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -.008, .15);
    nose.castShadow = true;
    this.head.add(nose);
    for (const sign of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), clay);
      ear.scale.set(.025, .052, .028);
      ear.position.set(sign * .148, -.02, 0);
      ear.castShadow = true;
      this.head.add(ear);
    }
    this.root.add(this.head);
    this.neck = sphere(.075, .15, .07);

    for (let side = 0; side < 2; side++) {
      this.limbs.push({
        upperArm: makeMesh(profileGeometry(UPPER_ARM)),
        forearm: makeMesh(profileGeometry(FOREARM)),
        hand: makeMesh(profileGeometry(HAND)),
        thigh: makeMesh(profileGeometry(THIGH)),
        calf: makeMesh(profileGeometry(CALF)),
        foot: makeMesh(profileGeometry(FOOT)),
      });
      this.joints.push({
        shoulder: sphere(.095, .095, .09),
        elbow: sphere(.071, .071, .067),
        wrist: sphere(.045, .045, .043),
        knee: sphere(.09, .09, .087),
        ankle: sphere(.058, .058, .055),
      });
    }
    this.scene.add(this.root);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    this.render();
    void this.loadRiggedCharacter();
  }

  private async loadRiggedCharacter() {
    try {
      const base = import.meta.env.BASE_URL;
      const manifestResponse = await fetch(`${base}poses/manifest.json`);
      if (!manifestResponse.ok) throw new Error(`No se pudo leer el catálogo de poses (${manifestResponse.status}).`);
      const manifest = await manifestResponse.json() as { poses: { id: string; name: string; file: string; type: string }[] };
      const character = await loadCharacter(`${base}models/human/human.glb`);
      if (this.disposed) { character.root.traverse(this.disposeObject); return; }
      const manager = new PoseManager(character);
      for (const entry of manifest.poses) {
        if (entry.type !== 'static') continue;
        this.characterPoses.set(entry.id, { name: entry.file.replace(/^.*\//, '').replace(/\.json$/, ''), file: entry.file });
      }
      this.character = character;
      this.poseManager = manager;
      this.mount.dataset.boneCount = String(character.skeleton.bones.size);
      character.root.visible = false;
      this.scene.add(character.root);
      if (this.activePose) this.apply(this.activePose);
    } catch (error) {
      if (!this.disposed) {
        const message = error instanceof Error ? error.message : String(error);
        const status = this.mount.querySelector<HTMLElement>('.loading-error');
        if (status) status.textContent = `Modelo 3D: ${message} Se muestra el maniquí anterior.`;
        console.warn('No se pudo iniciar el personaje riggeado:', error);
      }
    }
  }

  private loadPose(id: string, name: string, file: string) {
    if (this.poseRequests.has(id)) return;
    const request = fetch(`${import.meta.env.BASE_URL}poses/${file}`).then(async response => {
      if (!response.ok) throw new Error(`No se pudo cargar ${file} (${response.status}).`);
      return response.json() as Promise<StaticPose>;
    }).then(pose => {
      if (this.disposed || !this.poseManager) return;
      this.poseManager.addStaticPose(pose);
      if (this.activePose?.id === id) this.apply(this.activePose);
    }).catch(error => {
      this.poseRequests.delete(id);
      if (!this.disposed) console.warn(`No se pudo cargar la pose ${name}; se usa el maniquí anterior.`, error);
    });
    this.poseRequests.set(id, request);
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

  private placeBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    const delta = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(Y, delta.clone().normalize());
    mesh.scale.set(1, delta.length(), 1);
  }

  apply(pose: Pose) {
    this.activePose = pose;
    const rigged = this.characterPoses.get(pose.id);
    if (rigged && this.character && this.poseManager && !this.poseManager.hasStaticPose(rigged.name)) {
      this.loadPose(pose.id, rigged.name, rigged.file);
    }
    if (rigged && this.character && this.poseManager && this.poseManager.hasStaticPose(rigged.name)) {
      try {
        this.poseManager.setStaticPose(rigged.name);
        this.mount.dataset.figureSource = 'rigged';
        this.mount.dataset.poseName = rigged.name;
        this.root.visible = false;
        this.seat.visible = false;
        this.character.root.visible = true;
        return;
      } catch (error) {
        console.warn('La pose riggeada falló; se usa el maniquí anterior:', error);
      }
    }
    this.root.visible = true;
    this.mount.dataset.figureSource = 'procedural';
    this.mount.dataset.poseName = pose.name;
    if (this.character) this.character.root.visible = false;
    const seated = pose.category === 'Sentada';
    const low = pose.category === 'Agachada';
    this.seat.visible = seated;
    const hipHeight = seated ? .72 : low ? Math.max(.55, 1.34 - (pose.crouch ?? 0) * 1.1) : 1.34;
    const hip = new THREE.Vector3(pose.twist ? Math.sin(radians(pose.twist)) * .13 : 0, hipHeight, 0);
    const lean = radians(pose.lean ?? 0);
    const shoulder = new THREE.Vector3(hip.x + Math.sin(lean) * .48, hip.y + .61 - (low ? (pose.crouch ?? 0) * .12 : 0), Math.sin(radians(pose.twist ?? 0)) * .13);
    const headCenter = new THREE.Vector3(shoulder.x + Math.sin(lean) * .08, shoulder.y + .32, shoulder.z);
    this.placeBetween(this.torso, hip.clone().add(new THREE.Vector3(0, .06, 0)), shoulder);
    this.torso.rotateY(radians(pose.twist ?? 0) * .45);
    this.pelvis.position.copy(hip.clone().add(new THREE.Vector3(0, -.04, 0)));
    this.pelvis.scale.set(1, .32, 1);
    this.pelvis.rotation.y = -radians(pose.twist ?? 0) * .25;
    this.head.position.copy(headCenter);
    this.head.rotation.z = -lean * .15;
    this.neck.position.copy(shoulder.clone().lerp(headCenter, .25));

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const arm = this.limbs[side]!;
      const joint = this.joints[side]!;
      const twist = radians(pose.twist ?? 0);
      const shoulderPoint = shoulder.clone().add(new THREE.Vector3(sign * .31 * Math.cos(twist), -.025, -sign * .31 * Math.sin(twist)));
      const armAngle = radians(pose.arms[side] ?? 0);
      const elbowAngle = armAngle + radians(pose.elbows[side] ?? 0);
      const depth = Math.sin(radians(pose.depth ?? 0)) * .13;
      let elbow = shoulderPoint.clone().add(new THREE.Vector3(Math.sin(armAngle) * .38, -Math.cos(armAngle) * .38, depth));
      let wrist = elbow.clone().add(new THREE.Vector3(Math.sin(elbowAngle) * .32, -Math.cos(elbowAngle) * .32, .025));
      let fingers = wrist.clone().add(new THREE.Vector3(Math.sin(elbowAngle) * .16, -Math.cos(elbowAngle) * .16, .015));
      if (pose.id === '03') {
        elbow = shoulderPoint.clone().add(new THREE.Vector3(sign * .23, -.22, 0));
        wrist = hip.clone().add(new THREE.Vector3(sign * .22, .13, .11));
        fingers = hip.clone().add(new THREE.Vector3(sign * .17, .08, .1));
      }

      const hipPoint = hip.clone().add(new THREE.Vector3(sign * .16, -.1, 0));
      const legAngle = radians(pose.legs[side] ?? 0);
      const kneeAngle = legAngle + radians(pose.knees[side] ?? 0);
      let knee: THREE.Vector3;
      let ankle: THREE.Vector3;
      if (seated) {
        const spread = sign * (pose.id === '14' ? .05 : .17);
        knee = new THREE.Vector3(hip.x + spread, hip.y - .19, .48 + (side === 1 && pose.id === '12' ? .12 : 0));
        ankle = new THREE.Vector3(knee.x + sign * .035, .095, knee.z + (pose.id === '14' && side === 0 ? -.28 : .07));
      } else if (low && pose.id !== '17') {
        knee = new THREE.Vector3(hip.x + sign * .33, Math.max(.28, hip.y - .24), .28);
        ankle = new THREE.Vector3(hip.x + sign * .34, .095, pose.id === '16' && side === 1 ? -.25 : .22);
      } else {
        knee = hipPoint.clone().add(new THREE.Vector3(Math.sin(legAngle) * .57, -Math.cos(legAngle) * .57, .04 + Math.abs(Math.sin(legAngle)) * .17));
        ankle = knee.clone().add(new THREE.Vector3(Math.sin(kneeAngle) * .58, -Math.cos(kneeAngle) * .58, .01));
        if (pose.id === '05' && side === 1) ankle.y += .26;
      }
      const toe = ankle.clone().add(new THREE.Vector3(sign * .035, -.025, .24));

      this.placeBetween(arm.upperArm, shoulderPoint, elbow);
      this.placeBetween(arm.forearm, elbow, wrist);
      this.placeBetween(arm.hand, wrist, fingers);
      this.placeBetween(arm.thigh, hipPoint, knee);
      this.placeBetween(arm.calf, knee, ankle);
      this.placeBetween(arm.foot, ankle, toe);
      joint.shoulder.position.copy(shoulderPoint);
      joint.elbow.position.copy(elbow);
      joint.wrist.position.copy(wrist);
      joint.knee.position.copy(knee);
      joint.ankle.position.copy(ankle);
    }
    this.root.position.y = pose.id === '08' ? .2 : 0;
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
