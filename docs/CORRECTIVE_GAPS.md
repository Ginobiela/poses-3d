# Correctivos faltantes y origen de la anatomía — Fase 8

## Comprobación del asset actual

Inspección directa con `auditModel()` de `scripts/audit-model.mjs`, el 3 de octubre de 2026:

- Archivo: `public/models/human/human.glb`.
- SHA-256: `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`.
- Cuatro SkinnedMesh: Body, Eyes, Teeth y Tongue; 52 huesos Mixamo.
- 306 nombres únicos de morph target, 395 slots entre los cuatro meshes.
- Los 26 nombres propuestos abajo están ausentes de todos los meshes.
- Ningún target existente fue identificado y validado como correctivo articular. `POSE_CORRECTIVES` permanece vacío.

La ausencia de un nombre exacto es comprobable. La existencia de una corrección equivalente bajo otro nombre exigiría revisar sus deltas y calibración; la auditoría actual no identifica ninguna. Los nombres de la tabla son propuestas del proyecto, no targets disponibles ni nombres impuestos por Mixamo.

## Inventario de faltantes

Las referencias a poses remiten a [DEFORMATION_AUDIT.md](DEFORMATION_AUDIT.md) y sus capturas. «Prioritario» indica un candidato después de comprobar pose y pesos; la ausencia de una shape key no demuestra por sí sola que deba crearse.

| Nombres propuestos, ambos ausentes | Región o comportamiento esperado | Evidencia y prioridad de evaluación |
| --- | --- | --- |
| `bicepsFlex_L`, `bicepsFlex_R` | Variación de masa del brazo durante flexión | 13/16/20 muestran forma suave en flexión fuerte. Evaluar anatomía base y correctivo después de pesos; el ángulo de codo no demuestra contracción muscular. |
| `elbowFlex_L`, `elbowFlex_R` | Compresión interior y continuidad exterior del codo | Candidato prioritario: 03/13/16/20 presentan pliegue angular o aplanamiento. |
| `shoulderRaise_L`, `shoulderRaise_R` | Transición deltoide, axila y tórax al elevar brazo | Candidato prioritario: 02/15/18 presentan transición larga o angular. |
| `shoulderForward_L`, `shoulderForward_R` | Unión brazo-torso al adelantar hombro | Candidato prioritario: 07/09/12/17/19 muestran pinzamiento o volumen desigual. |
| `shoulderBack_L`, `shoulderBack_R` | Unión posterior del hombro al llevarlo atrás | Falta cobertura específica calibrada. Evaluar después de rig y pesos; la muestra no aísla un defecto inequívoco de extensión posterior. |
| `chestCompress` | Compresión del tórax anterior | Candidato en flexión extrema: 20; confirmar distribución de rotación y cuello antes de corregir superficie. |
| `abdomenCrunch` | Compresión abdominal y transición hacia pelvis | Candidato en 17/20. Revisar primero reparto de flexión entre segmentos de columna. |
| `torsoTwist_L`, `torsoTwist_R` | Superficie de cintura y espalda durante torsión | Candidato prioritario: 19 muestra surco irregular; también revisar 07/09/12. |
| `lateralBend_L`, `lateralBend_R` | Compresión y estiramiento laterales del torso | Candidato: 15 muestra cintura comprimida y lado convexo largo. |
| `kneeFlex_L`, `kneeFlex_R` | Pliegue posterior y volumen articular de rodilla | Candidato prioritario en flexión profunda: 07/08/11/13/20. |
| `quadFlex_L`, `quadFlex_R` | Variación de la masa anterior del muslo | Evaluación pendiente de anatomía superficial. No se verificó un colapso específico del cuádriceps ni se deduce contracción de la flexión de rodilla. |
| `hipFlex_L`, `hipFlex_R` | Pliegue inguinal y continuidad pelvis-muslo | Candidato prioritario: 07/11/14/20. La abertura extrema de 18 requiere además evaluar abducción. |
| `gluteFlex_L`, `gluteFlex_R` | Forma glútea y transición posterior muslo-pelvis | Necesidad no demostrada: 12/13 sin props conservan masa. Corregir el apoyo del asiento antes de atribuir la oclusión al skinning. |
| `calfFlex_L`, `calfFlex_R` | Variación de masa de pantorrilla | Necesidad no demostrada en esta muestra; evaluar forma base y movimiento validado antes de decidir su creación. |

Total: 26 nombres ausentes. La tabla registra exactamente los candidatos pedidos; no define todavía su pose de esculpido, ejes ni umbrales de activación.

También falta cobertura correctiva identificada para apertura/cierre de axila, abducción de cadera y flexión fuerte de cuello. La auditoría justifica evaluar esas regiones, pero aún no determina shape keys independientes. Muñeca y tobillo no presentan un fallo crítico inequívoco en las capturas disponibles.

## Morphs existentes que conservan su función corporal

| Targets reales | Función actual y límite |
| --- | --- |
| `bodyMuscular`, `armsMuscular`, `chestPectorals`, `thighsMuscular`, `calvesMuscular`, `bellyToned` | Modifican forma corporal en presets/sliders. No están calibrados como respuestas de una articulación. |
| `armsShouldersLessMuscular`, `armsLessMuscular`, `thighsLessMuscular`, `calvesLessMuscular` | Cambios de forma presentes en el inventario; su nombre no acredita una corrección del skinning. |
| `legsKneesIn`, `legsKneesOut` | Cambios de proporción/alineación de la malla; no equivalen a kneeFlex ni a corregir una rodilla flexionada. |

Activar estos targets a partir de ángulos alteraría el tipo de cuerpo y podría ocultar una orientación o distribución de pesos incorrecta. Se mantienen las funciones corporales existentes.

## Procedencia de la superficie anatómica

La superficie humana procede de la malla y de los deltas de morph target del GLB MakeHuman/MPFB2 CC0 ya documentado en [MODEL_AUDIT.md](MODEL_AUDIT.md), `public/models/human/SOURCE.txt` y `LICENSE.txt`.

El código corporal escribe `morphTargetInfluences`. Las futuras correcciones deben usar shape keys diseñadas y exportadas desde el modelo. La política del proyecto excluye construir músculos con esferas, cilindros, metaballs, primitivas Three.js, desplazamiento arbitrario de vértices o fórmulas improvisadas.

La revisión de código encuentra primitivas existentes para props, suelo/plataforma visual y marcador de selección de articulación. El marcador es una SphereGeometry del editor; los props usan BoxGeometry y el suelo usa CircleGeometry. Ninguno forma parte de la anatomía del personaje. Esta fase conserva esos objetos funcionales.

## Resultado y límites de esta fase

- Inventario de faltantes comprobado contra el GLB actual y relacionado con la evidencia existente.
- Arquitectura de correctivos de Fase 7 conservada, con cero bindings activos.
- Modelo, geometría, skeleton, materiales, poses, editor, animaciones y UI permanecen idénticos.
- Este documento no representa una mejora visual ni decide sustituir el modelo.

La especificación de esculpido y activadores en Blender pertenece a Fase 9 (`CORRECTIVE_SHAPES.md`). La evaluación por grupo muscular pertenece a Fase 10. Ambas esperan aprobación explícita.

## Verificación

`scripts/audit-model.test.mjs` comprueba el inventario, los deltas, el hash y la sincronización de MODEL_AUDIT.md con el GLB. `PoseCorrectiveController.test.mjs` comprueba la configuración vacía sobre las veinte poses y que los morphs corporales y huesos permanezcan intactos.

```sh
pnpm test
pnpm build
```

La comprobación de los 26 nombres se hizo contra el conjunto de nombres de todos los meshes obtenido con `auditModel()`, sin depender de búsquedas parciales en el nombre de un target. Si cambia el asset, este inventario debe volver a verificarse antes de activar correctivos.
