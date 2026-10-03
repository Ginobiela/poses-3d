# Fase 11B.1 — Candidato offline de forma base

## Estado y decisión

**Candidato experimental generado y comprobado; no aprobado para producción. Fase 11B completa aún pendiente.**

Se dividió 11B antes de implementar: 11B.1 prepara una forma base reproducible y comparación; 11B.2 revisará pesos/correctivos y decidirá si se conserva esta base o se necesita otra malla. No se confunde una variación de volumen con una reparación del skinning.

Las auditorías existentes justifican conservar provisionalmente la topología para probar deltas ya esculpidos: rig válido, masas generales útiles y targets efectivos. También muestran que estos deltas no bastan para referencia muscular detallada. No se repitieron las auditorías generales. No se encontró Blender en PATH ni en las ubicaciones habituales de instalación consultadas; no se afirma haber ejecutado escultura o weight painting en Blender.

## Archivos y reproducción

```sh
node scripts/anatomy-candidate.mjs
pnpm dev --host 127.0.0.1 --port 4173
```

Abrir `http://127.0.0.1:4173/poses-3d/dev/compare.html`. La página ofrece **Modelo actual**, **Modelo candidato** y **Ambos**, las veinte poses, vistas de cámara, una prueba de edición de codo y un frame de walk-01. Las cámaras sincronizan OrbitControls. En móvil puede mostrarse un modelo por vez.

- `dev/models/human-current.glb`: copia exacta del modelo actual, 6.806.984 bytes.
- `dev/models/human-anatomy-v2.glb`: candidato, 7.207.176 bytes (+5,88 %).
- SHA-256 original: `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`.
- SHA-256 candidato: `7337020285b5d1b97b4f2ca4eae5a93bfc70bd3798c754f6305869fa3920519e`.
- `dev/models/LICENSE.txt` y `SOURCE.txt`: procedencia CC0 conservada.

El comparador y los dos GLB de desarrollo quedan fuera de `dist/`. El visor productivo sigue usando `public/models/human/human.glb`. Su único cambio es admitir una URL opcional de modelo en el constructor, manteniendo el valor predeterminado y toda la carga actual.

Usar un puerto distinto al de otra sesión del sitio si se quiere separar localStorage: el comparador selecciona Neutral mediante la API corporal existente y comparte almacenamiento con páginas del mismo origen.

## Modificación geométrica

Se hornean exclusivamente deltas del GLB original, cuya procedencia son los [datos CC0 MakeHuman/MPFB2](https://github.com/nirholas/three.ws/blob/309cb37e870e7bba2179cc55a2ad0936ed53f2fe/avatar-sources/anny/README.md). No se copió código del generador upstream ni se descargaron otros modelos.

| Target exacto | Influencia horneada |
| --- | ---: |
| armsMuscular | 0.45 |
| thighsMuscular | 0.45 |
| calvesMuscular | 0.30 |
| chestPectorals | 0.40 |
| bellyToned | 0.60 |
| torsoLatsWider | 0.20 |
| gluteusBigger | 0.15 |

Son valores experimentales moderados, no parámetros anatómicos medidos. El cambio está almacenado en POSITION de la Basis del GLB; no depende de sliders activados en el navegador. Es una nueva base corporal derivada de formas existentes, no una nueva escultura de músculos ni nuevos correctivos.

Las normales de Body se recalculan a partir de la geometría modificada; se agrupan costuras con posición/normal original coincidentes para evitar añadir discontinuidades por UV. No hay normal maps ni relieve artificial. Los targets siguen sin NORMAL: al aplicar modificaciones corporales adicionales permanece esa limitación del asset original.

Se conservan nombres/transformaciones de los 52 huesos, inverse bind matrices, índices, UV, pesos, cuatro SkinnedMesh, materiales y 306 nombres de morph. Eyes/Teeth/Tongue no se modifican. Los siete deltas seleccionados se multiplican por `1 - influenciaHorneada`: así su slider llega al extremo original en el contexto de los demás cambios horneados. Los demás deltas se conservan. Esto cambia la referencia corporal del candidato y necesita revisar los presets y combinaciones opuestas antes de integrarlo.

Se escriben accessors sparse para los deltas ajustados; sin subdivisión ni nuevas dependencias. Se conservan algunos bloques binarios antiguos sin uso para mantener el resto del asset intacto; una integración futura puede compactarlos offline tras validar la geometría. El generador rechaza una fuente cuyo hash haya cambiado.

## Comparación visual

Las mismas poses, cámaras, material Anatomía y luces existentes se aplican a ambos modelos. No se aumenta el contraste solo al candidato. Evidencia en [audit/anatomy-candidate](audit/anatomy-candidate/): 24 comparaciones desktop de ocho poses × frente/perfil/3⁄4 y seis capturas móviles de tres poses × dos modelos.

| Caso | Evidencia | Resultado observado |
| --- | --- | --- |
| Neutral, flexión leve — 01 | [Frente](audit/anatomy-candidate/01-Frente.png) | Mayor masa en brazos, muslos y pantorrillas; contorno general conservado. Cambio moderado. |
| Brazo flexionado — 16 | [Frente](audit/anatomy-candidate/16-Frente.png) | Volumen de brazo algo mayor; el interior del codo sigue sin correctivo. |
| Brazos elevados — 02 | [Frente](audit/anatomy-candidate/02-Frente.png), [perfil](audit/anatomy-candidate/02-Perfil-izquierdo.png) | Más masa en extremidades; transición de axila/hombro larga y genérica persiste. |
| Torso inclinado — 17 | [Perfil](audit/anatomy-candidate/17-Perfil-izquierdo.png) | Ligero cambio posterior/torso; definición abdominal y espalda todavía suave. |
| Sentada — 13 | [Perfil](audit/anatomy-candidate/13-Perfil-izquierdo.png) | Muslo algo más lleno. Banco sigue sin sostener el cuerpo; no se compensó con geometría. |
| Corrida — 07 | [3⁄4](audit/anatomy-candidate/07-34-derecho.png) | Mayor masa en brazo y muslo; unión del hombro y pliegue inguinal continúan necesitando revisión. |
| Rodilla muy flexionada — 08 | [Perfil](audit/anatomy-candidate/08-Perfil-izquierdo.png) | Silueta más llena; bisagra sigue simplificada, sin mejora demostrada del pliegue. |
| Contracción — 20 | [Perfil](audit/anatomy-candidate/20-Perfil-izquierdo.png) | Compresión anterior y arco posterior siguen presentes; no se declara reparación. |

Se revisaron directamente las capturas de estos casos y la muestra móvil de corrida. No se observó una regresión grande en cara/manos/pies a esta escala; esto no reemplaza revisión cercana de contactos e intersecciones. Los tests garantizan compatibilidad y finitud, no precisión anatómica.

**Aceptación:** mejora modesta de algunos volúmenes, insuficiente para cumplir todos los criterios de 11B. No se puede afirmar mejora objetiva en rodillas o poses flexionadas. No integrar aún. Tampoco hay evidencia que pruebe que la topología no puede mejorarse mediante autoría artística; no se declara obligatorio reemplazarla.

## Correctivos y pesos pendientes de 11B.2

No hay nuevos `elbowFlex`, `bicepsFlex`, `shoulderRaise`, `shoulderForward`, `kneeFlex`, `hipFlex`, `gluteFlex`, `abdomenCrunch` o `torsoTwist`. No se simulan con escalado de regiones. Necesitan revisar pesos, referencias de pose, esculpir deltas coherentes y validar su activación según [CORRECTIVE_SHAPES.md](CORRECTIVE_SHAPES.md).

Pesos conservados exactamente: esta subfase no garantiza su calidad ni presenta una corrección de weight painting. Próxima subfase: inspección focal de distribución y deformación de hombro/axila, codo, pelvis/glúteo y rodilla; corregir solo defectos demostrables. Si falta una forma muscular que los targets disponibles no representan, necesitará escultura manual o una fuente anatómica superior con licencia verificada. No es fiable inventarla mediante fórmulas.

## Verificaciones

- `pnpm test`: 58 tests en 16 archivos. Generación idéntica byte a byte, source hash intacto, normales unitarias, posiciones iguales a los deltas autorados, morphs rebased, rig/pesos/topología/auxiliares conservados.
- `pnpm exec playwright test e2e/anatomy-candidate.spec.ts`: las veinte poses sobre ambos GLB, vértices finitos, 52 huesos, quaternions iguales, props equivalentes, edición y exportación de estado, walk-01 al 43 %, tres poses móviles. Cada modelo se solicita una vez; consola sin errores. [Resultado](audit/anatomy-candidate/validation.json).
- `pnpm exec playwright test e2e/anatomy-candidate.spec.ts e2e/anatomy-material.spec.ts`: 4 tests aprobados, incluidas funciones de producción.
- `pnpm build`: aprobado, 31 módulos, JS 702.35 kB (+0.04 kB), gzip 181.70 kB y CSS 13.64 kB. Los assets experimentales no aumentan la descarga de producción. Advertencia previa de chunk grande permanece.
- Primer ensayo del comparador detectó favicon ausente; se añadió favicon inline. El primer test de reproducibilidad agotaba tiempo al comparar buffers con igualdad profunda; se cambió a comparación binaria exacta con `Buffer.equals`. Accessors nuevos incluyen min/max para evitar warnings del loader.

No se publica el comparador ni se sustituye el modelo de producción en esta subfase.
