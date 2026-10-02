# Modelo humano y poses

El visor carga una sola vez `public/models/human/human.glb` mediante `GLTFLoader`. El archivo contiene cuatro `SkinnedMesh`, materiales originales y un esqueleto de 52 huesos. `CharacterLoader` mide el personaje, lo escala a 1,8 m, centra X/Z y apoya su punto más bajo en Y=0. `SkeletonAdapter` registra los huesos, comprueba los principales y guarda la postura de reposo. Three.js cambia `:` por `_` en `Object3D.name`; el adaptador recupera los nombres exactos `mixamorig:*` desde `bone.userData.name`.

Las poses están separadas del GLB. `public/poses/manifest.json` indexa archivos JSON pequeños por categoría. Al iniciar una práctica, el visor carga solo las poses elegidas. Se pueden agregar muchas poses sin copiar la geometría, los materiales ni el esqueleto del personaje. Actualmente hay tres poses disponibles. Si falla la carga del GLB o de una pose, la práctica muestra el error y no arranca el temporizador.

## Formato estático

Cada archivo en `public/poses/standing/`, `sitting/`, `action/` o `dynamic/` contiene quaternions **locales absolutos** en orden `[x, y, z, w]`:

```json
{
  "name": "standing_relaxed_01",
  "category": "standing",
  "bones": {
    "mixamorig:Hips": [0, 0, 0, 1],
    "mixamorig:Spine": [0, 0, 0, 1],
    "mixamorig:LeftArm": [0, 0, 0, 1]
  }
}
```

Los huesos omitidos vuelven a su postura de reposo. Se rechazan nombres ausentes y quaternions inválidos. Los nombres deben coincidir con el esqueleto Mixamo del GLB: `mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, extremidades y dedos. Los quaternions son reutilizables directamente en modelos con **los mismos nombres y la misma postura de reposo**. Para otro rig o postura de reposo hay que retargetear los datos; copiar los números sin conversión puede deformar el cuerpo.

## Añadir una pose

1. Diseñá una pose en un editor de rig humano o extraela de un recurso de animación cuya licencia permita redistribuirla. Conservá autor, enlace, licencia y versión de origen. No se generan ángulos aleatorios en el sitio.
2. Exportá quaternions locales para el rig `mixamorig:*` y guardá el JSON en la carpeta de categoría. Si la fuente usa otra postura de reposo, retargeteala antes de exportar.
3. Agregá una entrada `id`, `name`, `category`, `type: "static"` y `file` a `public/poses/manifest.json`. El catálogo de la práctica lee el manifiesto al abrir el sitio, por lo que la nueva pose queda disponible sin editar el código. Usá un `id` distinto al de las poses existentes.
4. Probá el archivo en vista frontal y lateral, comprobá contacto con el suelo y ejecutá `pnpm test:e2e`.

Las tres poses iniciales se extrajeron de datos MakeHuman reales. `scripts/extract-makehuman-poses.py` documenta y reproduce su retargeting desde la T-pose del paquete fuente hacia la A-pose de este modelo. Requiere Python con NumPy y SciPy; el paquete fuente es un insumo de generación y no se publica en este repositorio.

## Importar una animación

`PoseManager` acepta `THREE.AnimationClip` cargados desde un GLB por `GLTFLoader`, o JSON creado con `THREE.AnimationClip.toJSON(clip)`. El clip debe estar vinculado al rig `mixamorig:*` o haber sido retargeteado a él. Un JSON de clip puede guardarse en `public/poses/` sin repetir el personaje.

```ts
manager.addAnimationClip(gltf.animations[0]);
manager.addAnimationJSON(await (await fetch('/poses-3d/poses/walking.json')).json());
manager.setPoseFromAnimation('walking', 0.43);
```

`0.43` selecciona el 43 % de la duración. El mezclador evalúa ese instante y queda pausado; el renderizador no lo avanza. Cada cambio de pose restaura primero el rig de reposo, incluidas las traslaciones de los huesos. Si el clip anima desplazamiento de cadera, el personaje se vuelve a apoyar en el suelo tras tomar el fotograma.

## Procedencia y licencias

- **Modelo:** `parametric-base.glb` de [nirholas/three.ws](https://github.com/nirholas/three.ws), revisión fija y SHA-256 en `public/models/human/SOURCE.txt`. El [README de los datos de origen](https://github.com/nirholas/three.ws/blob/309cb37e870e7bba2179cc55a2ad0936ed53f2fe/avatar-sources/anny/README.md) indica que se creó con datos MakeHuman/MPFB2 CC0. El texto completo CC0 está en `public/models/human/LICENSE.txt`. El código de three.ws usa Apache-2.0; aquí solo se distribuye el asset generado.
- **Poses:** `Standing 01`, `Fight 01` y `Run 01` del [paquete MakeHumanPoses de Cinevva](https://app.cinevva.com/tools/animations). Su [manifiesto de procedencia](https://app.cinevva.com/rigging/clips/MakeHumanPoses.json) marca el paquete y cada pose como `CC0-1.0`, con fuente MakeHuman. GLB fuente: `https://app.cinevva.com/rigging/clips/MakeHumanPoses.glb`; SHA-256 `58A1975A260EDDE6E217B8D1B0AF4194D06ADA365A192C7623A6E6A0BE4FFBCC`. Solo se publican los quaternions retargeteados de estas tres poses.
- **MakeHuman/MPFB2:** su [licencia de assets](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md) incluye expresamente mallas, rigs y poses bajo CC0 1.0.
