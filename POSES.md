# Modelo humano y poses

El visor carga una sola vez `public/models/human/human.glb` mediante `GLTFLoader`. El archivo contiene cuatro `SkinnedMesh`, materiales originales y un esqueleto de 52 huesos. `CharacterLoader` mide el personaje, lo escala a 1,8 m, centra X/Z y apoya su punto más bajo en Y=0. `SkeletonAdapter` registra los huesos, comprueba los principales y guarda la postura de reposo. Three.js cambia `:` por `_` en `Object3D.name`; el adaptador recupera los nombres exactos `mixamorig:*` desde `bone.userData.name`.

Las poses están separadas del GLB. `public/poses/manifest.json` indexa archivos JSON pequeños por categoría. Al iniciar una práctica, el visor carga solo las poses elegidas. Se pueden agregar muchas poses sin copiar la geometría, los materiales ni el esqueleto del personaje. Actualmente hay 20 poses disponibles. Si falla la carga del GLB o de una pose, la práctica muestra el error y no arranca el temporizador.

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
  },
  "positions": { "mixamorig:Hips": [0, 0.92, 0] }
}
```

Los huesos omitidos vuelven a su postura de reposo. `positions` es opcional y guarda traslaciones locales absolutas; en este catálogo solo se usa para la pelvis. Se rechazan nombres ausentes y quaternions o posiciones inválidos. Los nombres deben coincidir con el esqueleto Mixamo del GLB: `mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, extremidades y dedos. Los quaternions son reutilizables directamente en modelos con **los mismos nombres y la misma postura de reposo**. Para otro rig o postura de reposo hay que retargetear los datos; copiar los números sin conversión puede deformar el cuerpo.

## Añadir una pose

1. Diseñá una pose en un editor de rig humano o extraela de un recurso de animación cuya licencia permita redistribuirla. Conservá autor, enlace, licencia y versión de origen. No se generan ángulos aleatorios en el sitio.
2. Para el paquete MakeHuman Quaternius UAL, ejecutá `pnpm convert-pose -- ruta/MakeHumanPoses.glb public/poses/action/nueva.json --clip "Fight 02" --category action`. Podés añadir `--time 0.43` para escoger el 43 % de un clip animado. Requiere Python, NumPy y SciPy. La conversión usa un mapa de huesos, posturas de reposo y jerarquías; consultá [RETARGETING.md](RETARGETING.md). Para otros rigs fuente hace falta definir un mapa nuevo.
3. Agregá una entrada `id`, `name`, `category`, `type: "static"`, `file`, `source`, `sourceClip`, `sourceUrl`, `license`, `skeletonSource` y `retargetedTo` a `public/poses/manifest.json`. El catálogo lee el manifiesto al abrir el sitio. Usá un `id` distinto al de las poses existentes.
4. Ejecutá `pnpm validate:poses`, revisá el archivo en vista frontal y lateral, comprobá contacto con el suelo y ejecutá `pnpm test:e2e`.

Las 20 poses se extrajeron de datos MakeHuman reales. `scripts/extract-makehuman-poses.py` conserva la conversión inicial de tres poses para la auditoría; `scripts/convert_pose.py` añade la traslación de la pelvis y permite convertir clips nuevos. El paquete fuente es un insumo de generación y no se publica en este repositorio.

Para regenerar las 20 poses seleccionadas, ejecutá `python scripts/build_catalog.py ruta/MakeHumanPoses.glb`. `scripts/makehuman-source-metadata.json` fija los datos de licencia y procedencia inspeccionados al hacer esta migración. El script rechaza una entrada que no declare CC0.

## Importar una animación

`PoseManager` acepta `THREE.AnimationClip` cargados desde un GLB por `GLTFLoader`, o JSON creado con `THREE.AnimationClip.toJSON(clip)`. El clip debe estar vinculado al rig `mixamorig:*` o haber sido retargeteado a él. Un JSON de clip puede guardarse en `public/poses/` sin repetir el personaje.

```ts
manager.addAnimationClip(gltf.animations[0]);
manager.addAnimationJSON(await (await fetch('/poses-3d/poses/walking.json')).json());
manager.setPoseFromAnimation('walking', 0.43);
```

`0.43` selecciona el 43 % de la duración. El mezclador evalúa ese instante y queda pausado; el renderizador no lo avanza. Cada cambio de pose restaura primero el rig de reposo, incluidas las traslaciones de los huesos. Si el clip anima desplazamiento de cadera, el personaje se vuelve a apoyar en el suelo tras tomar el fotograma.

## Props de referencia

Una entrada del manifiesto puede incluir `props`, una lista opcional de objetos `chair`, `bench`, `box` o `platform`. Cada objeto acepta `position`, `rotation` y `scale` como tres números; la rotación usa radianes. Son geometrías livianas de Three.js, independientes del GLB humano. El visor elimina los props de la pose anterior al cambiar de referencia. `Sentada 02` usa una silla y `Sentada 04` un banco. Las otras sentadas se apoyan cerca del suelo y no necesitan asiento elevado.

```json
"props": [{ "type": "chair", "position": [0, 0, -0.12], "rotation": [0, 0, 0], "scale": [1, 1, 1] }]
```

## Editar y exportar

En una práctica, activá **Editar pose**, elegí una articulación o hacé clic cerca de ella sobre el cuerpo. El aro de `TransformControls` rota el hueso en su espacio local. También podés girarlo en pasos de 5° usando un eje; esos botones son cómodos en móvil. **Mover pelvis (X/Z)** habilita traslación horizontal de la cadera. Los demás huesos solo rotan. La figura sigue apoyada en el suelo. Mientras se arrastra el manipulador, `OrbitControls` se desactiva y vuelve a activarse al soltarlo.

Los límites de seguridad están en `src/editor/limits.ts` y se calculan respecto de la pose cargada, sin alterar el JSON fuente. **Restablecer articulación**, **Restablecer pose completa**, **Deshacer** y **Rehacer** afectan solo la sesión actual; también sirven Ctrl+Z y Ctrl+Y o Ctrl+Shift+Z. **Duplicar como variante** propone un nombre nuevo para la copia local. **Exportar pose** descarga `mi-pose.json` con los 52 quaternions normalizados y la cadera en `positions` y `hipsPosition`. El campo `positions` mantiene compatibilidad directa con `PoseManager` al volver a cargar el archivo.

## Procedencia y licencias

- **Modelo:** `parametric-base.glb` de [nirholas/three.ws](https://github.com/nirholas/three.ws), revisión fija y SHA-256 en `public/models/human/SOURCE.txt`. El [README de los datos de origen](https://github.com/nirholas/three.ws/blob/309cb37e870e7bba2179cc55a2ad0936ed53f2fe/avatar-sources/anny/README.md) indica que se creó con datos MakeHuman/MPFB2 CC0. El texto completo CC0 está en `public/models/human/LICENSE.txt`. El código de three.ws usa Apache-2.0; aquí solo se distribuye el asset generado.
- **Poses:** 20 clips del [paquete MakeHumanPoses de Cinevva](https://app.cinevva.com/tools/animations). Su [manifiesto de procedencia](https://app.cinevva.com/rigging/clips/MakeHumanPoses.json) marca el paquete y cada pose como `CC0-1.0`, con autor y URL individual registrados en el manifiesto local. GLB fuente: `https://app.cinevva.com/rigging/clips/MakeHumanPoses.glb`; SHA-256 `58A1975A260EDDE6E217B8D1B0AF4194D06ADA365A192C7623A6E6A0BE4FFBCC`. Solo se publican los datos retargeteados, sin duplicar el GLB.
- **MakeHuman/MPFB2:** su [licencia de assets](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md) incluye expresamente mallas, rigs y poses bajo CC0 1.0.

## Frames y poses personales

El reproductor y el flujo de congelar frames están documentados en [ANIMATIONS.md](ANIMATIONS.md). La exportación añade `modelPosition` para recuperar exactamente la ubicación del modelo, incluso en saltos. `PoseManager` admite también `hipsPosition` cuando no se declara pelvis en `positions`. Las poses personales se almacenan en este navegador y pueden importarse desde JSON, renombrarse, eliminarse y exportarse en Mis poses. El editor conserva la ubicación de estos frames al editar, restablecer y deshacer. Los archivos originales del catálogo permanecen independientes.
