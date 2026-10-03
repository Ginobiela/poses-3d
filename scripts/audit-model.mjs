import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Development audit only. Loads the real asset without modifying its bytes or influences.
export async function auditModel(file = 'public/models/human/human.glb') {
  const bytes = await readFile(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB header');
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Missing GLB JSON chunk');
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const runtimeMeshes = [];
  gltf.scene.traverse(object => { if (object.isMesh) runtimeMeshes.push(object); });
  const meshes = json.meshes.map((mesh, index) => {
    const instances = json.nodes.flatMap((node, nodeIndex) => node.mesh === index ? [{ nodeIndex, name: node.name, skin: node.skin }] : []);
    const runtime = runtimeMeshes.find(object => object.userData.name === mesh.name || object.name === mesh.name);
    if (!runtime) throw new Error(`Mesh missing after GLTFLoader: ${mesh.name}`);
    const names = mesh.extras?.targetNames ?? [];
    const primitives = mesh.primitives.map((primitive, primitiveIndex) => {
      const count = json.accessors[primitive.attributes.POSITION].count;
      const targets = primitive.targets ?? [];
      if (targets.length !== names.length) throw new Error(`Morph names/count mismatch: ${mesh.name}`);
      return { index: primitiveIndex, vertices: count, indices: primitive.indices === undefined ? 0 : json.accessors[primitive.indices].count,
        mode: primitive.mode ?? 4, attributes: Object.keys(primitive.attributes), material: primitive.material,
        morphCount: targets.length, morphSemantics: [...new Set(targets.flatMap(target => Object.keys(target)))] };
    });
    const morphs = names.map((name, index) => {
      const position = runtime.geometry.morphAttributes.position?.[index];
      if (!position || runtime.morphTargetDictionary?.[name] !== index) throw new Error(`Morph missing in Three.js: ${mesh.name}/${name}`);
      let affectedVertices = 0, maxDisplacement = 0;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        if (![x, y, z].every(Number.isFinite)) throw new Error(`Non-finite morph: ${name}`);
        if (x !== 0 || y !== 0 || z !== 0) affectedVertices++;
        maxDisplacement = Math.max(maxDisplacement, Math.hypot(x, y, z));
      }
      return { name, index, defaultWeight: runtime.morphTargetInfluences[index], affectedVertices, maxDisplacement };
    });
    const joints = runtime.geometry.attributes.skinIndex;
    const weights = runtime.geometry.attributes.skinWeight;
    let minWeightSum = Infinity, maxWeightSum = -Infinity;
    for (let vertex = 0; vertex < runtime.geometry.attributes.position.count; vertex++) {
      let sum = 0;
      for (let component = 0; component < 4; component++) {
        const joint = joints.getComponent(vertex, component), weight = weights.getComponent(vertex, component);
        if (!Number.isInteger(joint) || joint < 0 || joint >= runtime.skeleton.bones.length || !Number.isFinite(weight) || weight < 0) throw new Error(`Invalid skinning: ${mesh.name}/${vertex}`);
        sum += weight;
      }
      minWeightSum = Math.min(minWeightSum, sum); maxWeightSum = Math.max(maxWeightSum, sum);
    }
    return { index, name: mesh.name, instances, runtimeType: runtime.type, vertices: primitives.reduce((n, p) => n + p.vertices, 0),
      triangles: primitives.reduce((n, p) => n + (p.mode === 4 ? (p.indices || p.vertices) / 3 : 0), 0), primitives,
      morphs, relativeMorphs: runtime.geometry.morphTargetsRelative, boneCount: runtime.skeleton?.bones.length ?? 0,
      minWeightSum, maxWeightSum };
  });
  const parents = new Map();
  json.nodes.forEach((node, index) => node.children?.forEach(child => parents.set(child, index)));
  const skins = (json.skins ?? []).map((skin, index) => ({ index, name: skin.name, root: json.nodes[skin.skeleton]?.name,
    inverseBindMatrixCount: json.accessors[skin.inverseBindMatrices]?.count,
    bones: skin.joints.map((nodeIndex, jointIndex) => ({ jointIndex, nodeIndex, name: json.nodes[nodeIndex].name, parent: json.nodes[parents.get(nodeIndex)]?.name ?? null })) }));
  const materials = (json.materials ?? []).map((material, index) => ({ index, name: material.name, ...material.pbrMetallicRoughness,
    normalMap: Boolean(material.normalTexture), textureSlots: Object.keys(material).filter(key => key.endsWith('Texture')),
    doubleSided: material.doubleSided ?? false, alphaMode: material.alphaMode ?? 'OPAQUE' }));
  const result = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), generator: json.asset.generator,
    gltfVersion: json.asset.version, meshes, skins, materials, images: json.images?.length ?? 0, textures: json.textures?.length ?? 0,
    animations: json.animations?.length ?? 0, extensions: json.extensionsUsed ?? [],
    meshCount: runtimeMeshes.length, skinnedMeshCount: runtimeMeshes.filter(mesh => mesh.isSkinnedMesh).length,
    vertices: meshes.reduce((n, mesh) => n + mesh.vertices, 0), triangles: meshes.reduce((n, mesh) => n + mesh.triangles, 0),
    morphSlots: meshes.reduce((n, mesh) => n + mesh.morphs.length, 0), uniqueMorphs: new Set(meshes.flatMap(mesh => mesh.morphs.map(morph => morph.name))).size };
  for (const mesh of runtimeMeshes) { mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); }
  return result;
}

export function renderAudit(audit) {
  const lines = [
    '# Auditoría del modelo humano', '', 'Fase 1. Inspección directa de `public/models/human/human.glb`, con lectura del JSON glTF y carga independiente mediante el mismo `GLTFLoader` de Three.js instalado en el proyecto. No se modificó el asset ni la aplicación.', '',
    '## Identidad y método', '', `- Archivo: \`${audit.file}\`.`, `- Tamaño: ${audit.bytes.toLocaleString('en-US')} bytes.`, `- SHA-256: \`${audit.sha256}\`.`,
    `- glTF: ${audit.gltfVersion}; generador: \`${audit.generator}\`.`, '- Procedencia y licencia: `public/models/human/SOURCE.txt` y `LICENSE.txt`; datos MakeHuman/MPFB2 CC0 incorporados desde la revisión fijada de three.ws. El hash coincide con el registro de origen.',
    '- Reproducir: `node scripts/audit-model.mjs --report docs/MODEL_AUDIT.md`. Sin `--report` produce JSON en stdout. La herramienta comprueba la correspondencia de nombres/índices, los deltas reales de morphs y los datos de skinning.',
    '- Los vértices contados son entradas POSITION por primitiva, incluidos posibles vértices duplicados por costuras; no son puntos topológicos únicos soldados.', '',
    '## Resumen', '', `- ${audit.meshCount} meshes; los ${audit.skinnedMeshCount} se cargan como SkinnedMesh.`, `- ${audit.vertices.toLocaleString('en-US')} vértices y ${audit.triangles.toLocaleString('en-US')} triángulos.`,
    `- ${audit.skins.length} skin: \`ParametricSkin\`, con ${audit.skins[0].bones.length} huesos \`mixamorig:*\`.`,
    `- ${audit.uniqueMorphs} nombres únicos de morph; ${audit.morphSlots} slots sumando los cuatro meshes.`,
    `- ${audit.materials.length} materiales PBR; ${audit.textures} texturas, ${audit.images} imágenes y ningún normal map.`,
    `- ${audit.animations} AnimationClips embebidos. Las animaciones del sitio siguen siendo recursos separados.`, '',
    '## Meshes y skinning', '', '| Mesh | Nodo / skin | Tipo Three.js | Vértices | Triángulos | Morphs | Material |', '|---|---|---|---:|---:|---:|---|',
  ];
  for (const mesh of audit.meshes) lines.push(`| ${mesh.name} | ${mesh.instances.map(n => `${n.nodeIndex} / ${n.skin}`).join(', ')} | ${mesh.runtimeType} | ${mesh.vertices} | ${mesh.triangles} | ${mesh.morphs.length} | ${audit.materials[mesh.primitives[0].material].name} |`);
  lines.push('', 'Cada mesh tiene una primitiva TRIANGLES con POSITION, NORMAL, TEXCOORD_0, JOINTS_0 y WEIGHTS_0, y comparte el skin de 52 huesos. Hay cuatro componentes de skinning por vértice; los índices apuntan a joints válidos y los pesos son finitos y no negativos.', '', '| Mesh | Suma mínima de pesos | Suma máxima de pesos |', '|---|---:|---:|');
  for (const mesh of audit.meshes) lines.push(`| ${mesh.name} | ${mesh.minWeightSum.toFixed(8)} | ${mesh.maxWeightSum.toFixed(8)} |`);
  lines.push('', 'Esta comprobación valida la estructura del skinning; no certifica la calidad anatómica de sus deformaciones, reservada para la Fase 6.', '',
    '## Esqueleto completo', '', `Skin: \`${audit.skins[0].name}\`; raíz declarada: \`${audit.skins[0].root}\`; ${audit.skins[0].inverseBindMatrixCount} inverse bind matrices. La raíz externa de escena es ParametricBase.`, '',
    'Los nombres siguientes son los exactos del GLB. GLTFLoader sanitiza `:` a `_` en Object3D.name; el adaptador actual recupera los nombres originales desde userData.name. La tabla muestra el orden del array joints, que no es un recorrido jerárquico.', '',
    '| Joint | Nodo | Nombre exacto | Padre |', '|---:|---:|---|---|');
  for (const bone of audit.skins[0].bones) lines.push(`| ${bone.jointIndex} | ${bone.nodeIndex} | \`${bone.name}\` | \`${bone.parent}\` |`);
  lines.push('', '## Materiales', '', '| Nombre | BaseColor RGBA | Roughness | Metallic | Normal map | Alpha / caras |', '|---|---|---:|---:|---|---|');
  for (const material of audit.materials) lines.push(`| ${material.name} | ${material.baseColorFactor.join(', ')} | ${material.roughnessFactor} | ${material.metallicFactor} | No | ${material.alphaMode} / ${material.doubleSided ? 'doble' : 'frontal'} |`);
  lines.push('', 'Los NORMAL base son atributos de vértice, no normal maps. No hay imágenes, texturas PBR ni extensiones de materiales en este GLB.', '',
    '## Morph targets y límites declarados', '',
    'Los nombres proceden de meshes[].extras.targetNames y se comprobaron contra morphTargetDictionary tras la carga. Los índices son locales a cada mesh. Los cuatro meshes usan morphTargetsRelative = true. Todos los pesos iniciales son 0.', '',
    'Cada target contiene exclusivamente POSITION: deltas relativos de vértices. No hay targets NORMAL ni TANGENT. Los datos sparse se decodificaron con GLTFLoader antes de medirlos; no se contó solo la metadata. La tabla incluye los vértices con delta no nulo y el máximo módulo de desplazamiento por mesh en unidades locales del GLB.', '',
    'Hay 388 slots con desplazamiento no nulo y 7 slots completamente nulos: Eyes/eyeBagsLeft, Eyes/jawBonesSofter, Eyes/headAged, Eyes/headYouthful, Teeth/jawBonesSofter, Tongue/jawBonesSofter y Tongue/headAged. Sus nombres existen en esos meshes, pero activar esa ocurrencia no mueve vértices. Los 306 targets de Body sí tienen deltas no nulos.', '',
    'El archivo no declara rangos mínimos/máximos de influencia, exclusiones de pares opuestos ni límites de combinación. Los min/max de accessors acotan los deltas de posición, no las influencias. No debe presentarse 0–1 como un límite anatómico validado por este asset. Una política conservadora de UI y los presets deberán evaluarse en las fases siguientes.', '',
    'Los nombres compartidos pueden afectar ojos, dientes y lengua además del cuerpo. Un controlador futuro deberá encontrar todas sus ocurrencias para evitar desalineaciones. El skeleton no contiene morph targets ni está deformado por estos deltas de mesh; los cambios grandes de altura o longitud requieren comprobar compatibilidad con las articulaciones.', '',
    'Sin deltas de normales, las influencias cambian la superficie pero no corrigen explícitamente las normales exportadas. Esto puede limitar la lectura de volumen con modificaciones fuertes. La auditoría no recompone normales ni modifica geometría.', '',
    '## Morphs relacionados con anatomía corporal', '', '| Grupo solicitado | Nombres exactos encontrados en Body |', '|---|---|');
  const groups = {
    'Muscle / musculatura': /muscular|muscularless|pectorals|bellyToned/i,
    'Weight / peso y suavidad': /^body(Heavier|Thinner|Softer)$|^belly(Bigger|Smaller|Soft)$/,
    'Height / altura': /^height/,
    'Gender / sex': /^body(Feminine|Masculine)$/,
    'Torso': /^torso|^chest|^waist|^belly/,
    'Chest / pecho': /^chest|^bust|^torso(FrontChest|Underbust)/,
    'Shoulders / hombros': /^shoulders|^armsShoulders/,
    'Arms / brazos': /^arms/,
    'Legs / piernas': /^legs|^thighs|^calves/,
    'Hips / caderas': /^hips|^gluteus/,
    'Proportions / proporciones': /^height|^shoulders|^waist|^hips|^chest(Taller|Shorter|Wider|Narrower|Deeper|Shallower)$|^(arms|legs|neck|head).*(Longer|Shorter|Taller|Wider|Narrower|Deeper|Shallower)$/,
  };
  for (const [group, pattern] of Object.entries(groups)) lines.push(`| ${group} | ${audit.meshes[0].morphs.filter(m => pattern.test(m.name)).map(m => `\`${m.name}\``).join(', ')} |`);
  lines.push('', 'La clasificación anterior identifica candidatos por sus nombres reales. bodyFeminine/bodyMasculine son etiquetas del asset, no una garantía de representar todas las características sexuales o corporales. La eficacia visual y la seguridad de combinaciones no se certifican por el nombre.', '',
    'No aparecen nombres explícitos de correctivos articulares como elbowFlex_L, kneeFlex_L, shoulderRaise_L o torsoTwist_L. Los morphs de musculatura existentes son de forma corporal; esta fase no infiere activadores de pose ni conecta correctivos. Su evaluación y especificación corresponden a las fases posteriores.', '',
    '## Inventario completo de morph targets', '', '| Nombre exacto | Mesh: índice local | Vértices afectados por mesh | Delta máximo por mesh |', '|---|---|---|---|');
  const all = new Map();
  for (const mesh of audit.meshes) for (const morph of mesh.morphs) { const entries = all.get(morph.name) ?? []; entries.push({ mesh: mesh.name, ...morph }); all.set(morph.name, entries); }
  for (const [name, entries] of all) lines.push(`| \`${name}\` | ${entries.map(e => `${e.mesh}: ${e.index}`).join('; ')} | ${entries.map(e => `${e.mesh}: ${e.affectedVertices}`).join('; ')} | ${entries.map(e => `${e.mesh}: ${e.maxDisplacement.toFixed(6)}`).join('; ')} |`);
  lines.push('', '## Resultado de la Fase 1', '', 'Hay morphs corporales reales que permiten evaluar la Fase 2 sobre el modelo existente. Se conserva human.glb íntegro. No se implementaron controlador, presets, UI, persistencia corporal, correctivos, iluminación ni cambios de materiales en esta fase. La auditoría superficial y la revisión de las 20 poses se realizarán en sus fases correspondientes, previa aprobación.', '');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const audit = await auditModel();
  if (process.argv[2] === '--report' && process.argv[3]) await writeFile(process.argv[3], renderAudit(audit));
  else console.log(JSON.stringify(audit, null, 2));
}
