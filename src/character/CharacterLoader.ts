import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkeletonAdapter } from './SkeletonAdapter';

export type Character = {
  root: THREE.Group;
  model: THREE.Group;
  skinnedMeshes: THREE.SkinnedMesh[];
  skeleton: SkeletonAdapter;
  animations: THREE.AnimationClip[];
  placeOnFloor: () => void;
};

export async function loadCharacter(url: string, height = 1.8): Promise<Character> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  model.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) {
      skinnedMeshes.push(object);
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  if (!skinnedMeshes.length || skinnedMeshes.every(mesh => mesh.skeleton.bones.length === 0)) {
    throw new Error('El GLB no contiene un SkinnedMesh con esqueleto. Exportá el personaje con rig y pesos de skinning.');
  }
  const skeleton = new SkeletonAdapter(model, skinnedMeshes);
  const root = new THREE.Group();
  root.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const currentHeight = box.max.y - box.min.y;
  if (!Number.isFinite(currentHeight) || currentHeight <= 0) throw new Error('No se pudo medir la altura del personaje.');
  model.scale.multiplyScalar(height / currentHeight);
  model.updateMatrixWorld(true);
  box.setFromObject(model, true);
  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  const placeOnFloor = () => {
    model.updateMatrixWorld(true);
    const posed = new THREE.Box3().setFromObject(model, true);
    model.position.y -= posed.min.y;
    model.updateMatrixWorld(true);
  };
  return { root, model, skinnedMeshes, skeleton, animations: gltf.animations, placeOnFloor };
}
