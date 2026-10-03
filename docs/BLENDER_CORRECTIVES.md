# Fase 11B.2 — Blender y correctivos de volumen

## Resultado y decisión

Se utilizó **Blender 5.2.2 LTS** instalado en el equipo. Se generaron cuatro shape keys geométricas reales y un GLB separado que puede cargarse en el comparador. Los correctivos mejoran la conservación de volumen del skinning en los frames calibrados, pero **no están aprobados para producción**: las rodillas siguen angulares, falta escultura anatómica y la activación por un único ángulo no contempla todas las torsiones.

El modelo actual merece conservarse como base de autoría por su topología continua, rig compatible y targets existentes; no alcanza aún la calidad pedida como referencia muscular detallada. No hay evidencia de que sea imposible mejorarlo artísticamente. No se prepara una sustitución externa ni se descarga un asset sin licencia clara.

La subfase termina con el experimento reproducible, inspección de pesos, GLB, archivo Blender editable, tests y decisión explícita de no integrar. La aceptación artística y optimización necesarias se registran como **11B.3 pendiente de aprobación**. No se presenta la Fase 11B completa como terminada ni se solicita integrar un candidato rechazado.

## Reproducción

```powershell
node scripts/blender/build_correctives.mjs 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
pnpm test
pnpm exec playwright test e2e/volume-correctives.spec.ts
pnpm build
```

El runner se detiene si cualquier paso falla y usa `--python-exit-code 1`: no exporta desde resultados viejos después de un error de Blender.

Herramientas en `scripts/blender/`:

- `prepare_skinning.mjs`: reconstruye la base 11B.1 desde el GLB original y prepara matrices de poses **existentes**, no poses aleatorias.
- `inspect_skinning.py`: importa el GLB y mide distribución de pesos, vértices huérfanos y coincidencias de costuras. Excluye widgets de visualización de huesos creados por el importador de Blender.
- `volume_correctives.py`: verifica coordenadas y la deformación contra Three.js, compara LBS/Preserve Volume y convierte la diferencia a deltas anteriores al skinning.
- `export_correctives.mjs`: inserta targets sparse POSITION y NORMAL sin exportar nuevamente el armature a través de Blender. Conserva exactamente el rig original.
- `build_correctives.mjs`: ejecuta y comprueba todo el pipeline.

El archivo editable generado es `dev/blender/anatomy-correctives.blend`. Incluye Basis, los targets existentes y cuatro keys nuevas a 0, con armature en reposo y LBS. `dev/blender/` está ignorado por Git: contiene intermediarios y un archivo Blender grande, reproducibles mediante el runner. Los scripts y deltas finales sí se versionan.

## Inspección de pesos

[skin-report.json](audit/volume-correctives/skin-report.json) contiene todos los grupos de los cuatro meshes y los 52 huesos importados. En Body: 14.517 vértices, 307 keys contando Basis, suma de pesos entre 0.999999955 y 1.000000042; **0 vértices huérfanos y 0 vértices coincidentes con pesos distintos**. Lo mismo se verifica en Eyes/Teeth/Tongue.

| Región / grupos | Vértices influenciados | Vértices con mezcla |
| --- | --- | --- |
| Clavícula L / R | 247 / 231 | 247 / 231 |
| Antebrazo L / R | 438 / 443 | 296 / 287 |
| Hips | 635 | 635 |
| Spine / Spine1 / Spine2 | 460 / 830 / 1323 | 460 / 830 / 1295 |
| Muslo L / R | 740 / 738 | 582 / 585 |
| Pierna L / R | 489 / 485 | 342 / 336 |

Hombro/axila, pelvis/glúteo y cintura presentan mezcla entre grupos; eso no prueba que la distribución sea correcta anatómicamente. No se encontró un defecto de costura, normalización o asignación faltante que justificara redistribuir pesos automáticamente. Se conservan todos los pesos y se deja pendiente revisión artística de esas transiciones.

La pérdida de volumen que sí se mide procede de la mezcla matricial LBS en los codos/rodillas seleccionados. El determinante mínimo de su parte lineal va de 0.176 a 0.614 en los vértices de calibración: demuestra contracción local del transform de skinning. **No es una medición del volumen total de un músculo ni una prueba de pesos incorrectos.**

## Qué se generó

| Key real | Pose fuente / flexión medida | Vértices con delta | Determinante LBS mínimo | Delta máximo en reposo |
| --- | --- | ---: | ---: | ---: |
| elbowFlex_L | 13 — Sentada 04, 145.00° | 141 | 0.3998 | 26.48 mm |
| elbowFlex_R | 20 — Contracción, 122.88° | 147 | 0.6136 | 13.93 mm |
| kneeFlex_L | 08 — Salto en vuelo, 137.72° | 186 | 0.1764 | 100.16 mm |
| kneeFlex_R | 06 — Guardia 02, 130.38° | 186 | 0.2274 | 81.41 mm |

Los deltas grandes de rodilla son anteriores al skinning: invertir un transform comprimido amplifica el delta en reposo. No deben interpretarse como desplazamiento final de 10 cm de una rodilla. Tampoco certifican calidad anatómica.

La referencia deseada es la deformación **Preserve Volume** del Armature de Blender, basada en dual quaternions. Se utiliza la misma geometría, mismos pesos y misma pose. Solo se incluyen vértices cuya mezcla pertenece exclusivamente a los dos segmentos de la articulación: no se añaden formas en bíceps, torso, manos, pies o cara.

Para cada vértice elegible:

`deltaRest = inverse(linear(LBS)) × (puntoBlenderPreserveVolume − puntoLBS)`

No se inflan zonas mediante porcentajes o escalas improvisadas. El resultado es una corrección mecánica de deformación; **no equivale a un correctivo esculpido por un anatomista ni simula contracción muscular**. LBS/Preserve Volume se evalúan offline; el navegador sigue usando su skinning habitual y targets del GLB.

Los ejes y bases del importador se resuelven mediante matrices mundiales y la conversión Y-up → Z-up, no copiando quaternions locales a los PoseBone. Error de correspondencia de vértices: 1.27e-7 m. Error máximo Blender LBS frente a Three.js en las cuatro calibraciones: 4.38e-7 m. Los tests vuelven a comprobar que aplicar cada key a 1 en Three.js reproduce los puntos Preserve Volume con tolerancia de 2e-6 m.

Se recalculan deltas de normales a partir de la geometría de cada key; soporte limitado a la región afectada y sus vecinos/costuras. La Basis, UV, índices, materiales, pesos, inverse bind matrices y transformaciones del skeleton permanecen intactos. No se exporta otra jerarquía desde Blender.

## Comparador y evidencia

`http://127.0.0.1:4173/poses-3d/dev/compare.html` muestra el original y `human-anatomy-correctives.glb`. **Probar correctivos de volumen (no aprobados)** está desactivado inicialmente. El selector **Detalle** permite acercar cada codo/rodilla; las cámaras siguen sincronizadas. `?base` conserva el comparador de 11B.1.

El controlador existente se configura únicamente en esta página de desarrollo, con las cuatro keys inspeccionadas. Los inicios de 20°/25° proceden de la especificación anterior; los máximos son los ángulos medidos arriba. Esa interpolación es experimental: la exactitud geométrica solo se certifica en el frame calibrado. La flexión por centros no detecta hiperextensión ni todos los giros axiales.

Se actualizan targets al cambiar pose, usar el botón de edición, arrastrar TransformControls o seleccionar el frame walk-01 al 43 %. No se añade integración de animación continua a producción. Después se coloca el candidato sobre Y=0 para que recuperar volumen no lo hunda en el suelo.

Evidencia nueva en [audit/volume-correctives](audit/volume-correctives/), sin sobrescribir las auditorías anteriores:

- 27 comparaciones de nueve poses desde frente/perfil/3⁄4, incluida Neutral 01.
- 18 capturas on/off sobre el mismo candidato y la misma cámara.
- Ocho detalles de codos/rodillas on/off.
- Tres capturas móviles y [validación de las veinte poses](audit/volume-correctives/validation.json).

Revisión directa: [codo izquierdo off](audit/volume-correctives/detail-LeftForeArm-off.png) / [on](audit/volume-correctives/detail-LeftForeArm-on.png); [rodilla izquierda off](audit/volume-correctives/detail-LeftLeg-off.png) / [on](audit/volume-correctives/detail-LeftLeg-on.png); detalles derechos, sentada 13, salto 08, guardia 06 y contracción 20. Se observa recuperación de masa local, más visible en rodillas; **la rodilla queda demasiado angulosa**, y los codos todavía necesitan comprobar pliegue/inserción y torsiones. No se aprueba ninguno como correctivo anatómico final.

Hombros, axilas, pelvis y torso mantienen los problemas anteriores. No se generaron bicepsFlex, shoulderRaise/Forward, hipFlex/gluteFlex, abdomenCrunch o torsoTwist porque requieren autoría anatómica y condiciones más ricas que un único ángulo. Su trabajo manual está especificado en CORRECTIVE_SHAPES.md.

## Rendimiento, licencia y pruebas

- GLB experimental: 7.233.036 bytes, +25.860 frente a 11B.1; cuatro nuevos targets y ninguna subdivisión.
- SHA-256: `2859a2327aab883667670b257983dd287d06e8e7f16b1df066235b567003c363`.
- Misma procedencia CC0 del mesh; LICENSE.txt/SOURCE.txt actualizados. No se descargaron assets externos.
- Añadir NORMAL a morphs hace que Three.js reserve dos entradas por vértice en su textura de morphs, según `WebGLMorphtargets.js` instalado: para Body, aproximadamente 137 MiB frente a 68 MiB de datos sin normales, antes de padding. **El poco aumento del GLB no representa el costo GPU.** Se necesita optimizar/profilar el catálogo de morphs antes de una integración móvil; las capturas a 390 px no certifican rendimiento en un teléfono físico.
- Producción no carga este asset/controlador de desarrollo; el bundle conserva JS 702.35 kB y CSS 13.64 kB, sin nuevas dependencias.
- `pnpm test`: 60 tests aprobados en 17 archivos. Export binario reproducible, rig/atributos conservados, soporte sparse y normales finitas/locales, correspondencia con Blender y rechazo de base incorrecta.
- Playwright: veinte poses con correctivos activados, cuatro presets corporales sin perder pose/valores finitos, mismos quaternions, props, Y=0, edición, frame de animación, reset on/off, móvil y dos descargas (una por visor), sin errores de consola. La comprobación numérica de presets no certifica su calidad visual con cada correctivo.
- `pnpm build`: aprobado; advertencia previa del chunk mayor a 500 kB permanece.

## Próximo criterio de aceptación — 11B.3

Trabajar sobre el `.blend` preparado para revisar pesos con referencias anatómicas y **esculpir los correctivos que no sean convincentes**, empezando por rodillas y hombro/axila. Validar varias flexiones, giros, presets y contactos; comprobar rendimiento/memoria móvil y la definición del torso. No es fiable automatizar esa escultura añadiendo masas matemáticas. Si la malla no alcanza la calidad tras esa autoría, buscar una sustitución anatómica con licencia verificable.

Hasta cumplir esos criterios, `human.glb` de producción permanece intacto y `POSE_CORRECTIVES` de producción continúa vacío.
