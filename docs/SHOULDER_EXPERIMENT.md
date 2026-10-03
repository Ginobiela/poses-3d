# Fase 11B.3A — Ensayo de hombros y axilas

**Gate visual NO APROBADO. Fase 11B.3 pendiente.** Las pruebas técnicas pasan, pero no acreditan calidad anatómica. No se avanzó a cintura/pelvis, no se reemplazó `human.glb` ni el candidato anterior `human-anatomy-v2.glb`. Los cuatro correctivos de codos/rodillas de 11B.2 se conservan exactamente. El usuario los considera aceptables para esta etapa.

## Diagnóstico específico

Se usaron MODEL_AUDIT, DEFORMATION_AUDIT, ANATOMY_AUDIT y CORRECTIVE_SHAPES existentes. La nueva medición se limita al comportamiento de hombros en las veinte poses: [kinematics.json](audit/shoulders/kinematics.json).

- La clavícula no está congelada. En pose 02, las rotaciones locales respecto de bind pose son 63,3° izquierda y 51,9° derecha; la dirección del brazo respecto del pecho tiene elevaciones de 153,1°/146,6°. En pose 05 son 92,9°/86,0°. Son mediciones del asset, **no valores anatómicos recomendados** ni un desglose puro de elevación clavicular.
- La medida de elevación transforma el vector Arm→ForeArm al sistema local de Spine2; así no confunde inclinación del torso con brazo elevado. Las rotaciones locales preservan la contribución de padres, pecho, columna alta y cuello.
- No se cambió posición, orientación de reposo, jerarquía o nombres de ningún hueso. No se añadió seguimiento automático de clavícula: los datos no justifican duplicar ese movimiento. La presencia de movimiento tampoco certifica que la distribución sea anatómicamente óptima.
- El blend entre Spine2/Shoulder/Arm pierde volumen con LBS y presenta bordes angulares. Se ensayó una difusión de los pesos existentes, consciente de costuras, sobre 350 vértices. No se tocaron pesos de cuello, antebrazos, manos, pelvis, piernas o pies. Sumas normalizadas y finitud se verifican automáticamente; esto no certifica weight painting artístico.
- La mejora de continuidad de algunos bordes es parcial. Persisten la transición deltoides/axila/tórax demasiado larga y planos/picos visibles al elevar brazos. La recuperación automática de volumen no crea el deltoides, pectoral o trapecio que falta en la forma base.

## Pipeline reproducible

```powershell
node scripts/blender/build_shoulders.mjs 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
pnpm test
pnpm exec playwright test e2e/shoulders.spec.ts
pnpm build
```

1. `shoulder_weights.mjs`: vecinos de triángulos, costuras con posición coincidente, tres pasos de difusión con factor numérico 0,5; solo soporte de clavícula/pecho/brazo y un anillo adicional compatible. Ni vértices de reposo ni anatomía se generan mediante fórmulas. Los parámetros son de difusión, no constantes anatómicas.
2. `prepare_shoulders.mjs`: captura las mismas poses CC0 diseñadas del catálogo y las matrices de reposo/globales del GLB.
3. `shoulder_correctives.py`: Blender 5.2.2, importación sin fusionar vértices; transferencia de deformación global entre bases diferentes. Compara LBS con Preserve Volume y Corrective Smooth relativo al reposo, cinco iteraciones, factor 0,5. La máscara se desvanece con el blend existente para evitar un corte brusco. **No es escultura muscular**.
4. Invierte el skinning LBS por vértice para guardar deltas locales. Rechaza matrices casi singulares, NaN o una discrepancia Three.js/Blender superior a 0,05 mm.
5. `export_shoulders.mjs`: GLB sparse POSITION/NORMAL y JSON de calibración. Solo el navegador de desarrollo aplica influences: no reconstruye geometría.

Blender maestro versionado: `dev/blender/anatomy-shoulders.blend` (6.613.042 bytes). Guarda originales más los seis ensayos con influence 0, rig en reposo y listas SHOULDER/TORSO/PELVIS/ELBOW/KNEE en la propiedad de Body `corrective_regions` y texto `CORRECTIVE_REGIONS.json`. Blender no proporciona carpetas nativas de shape keys; los nombres compatibles se conservan. TORSO y PELVIS están vacías porque esta ejecución no las modifica.

Los intermedios grandes quedan en `dev/blender/` ignorados. El pipeline se detiene si una herramienta falla, antes de exportar datos anteriores.

Si el maestro ya existe, una regeneración guarda `anatomy-shoulders-generated.blend` y conserva el maestro editable. El pipeline genera estos ensayos desde el asset de 11B.2; todavía no exporta una escultura manual posterior. Antes de integrar trabajo artístico habrá que añadir su exportación desde el maestro, sin regenerarlo encima de las ediciones.

## Correctivos y activación

| Ensayo | Referencia diseñada | Vértices | Resultado |
| --- | --- | ---: | --- |
| shoulderRaise_L/R | 02 Brazos arriba | 183/167 | Recupera volumen; persisten picos/planos de axila. Rechazado. |
| shoulderForward_L/R | 20 Contracción | 183/167 | Cambia el volumen del blend; caso extremo comprimido. No aprobado. |
| shoulderBack_L/R | 07 Carrera 01 | 183/167 | Cambio pequeño de transición posterior. No demuestra mejora suficiente. No aprobado. |

Los seis permanecen **desactivados por defecto** y fuera de la configuración productiva. Son archivos de ensayo, no correctivos aceptados. Solo se activan expresamente para comparar.

El controlador añade `rotation-match`: evalúa conjuntamente brazo y clavícula contra quaternions locales medidos de cada referencia diseñada. Su radio procede de la mitad de la distancia a las otras referencias y la pose neutral; evita solapar familias. Es una activación conservadora para este ensayo, no una generalización validada de todo el espacio articular. Diferencia sentidos mediante referencias reales, sin ángulos humanos aleatorios.

Soporta linear, smoothstep, smootherstep y curvas de puntos monotónicos de 0 a 1. Valida/calca la configuración, rechaza referencias no normalizadas y protege NaN. No escribe en el skeleton ni crea objetos temporales por articulación en cada update. Los correctivos anteriores mantienen interpolación lineal y sus deltas originales.

## Comparación y gate

- [Original productivo vs ensayo](http://127.0.0.1:4173/poses-3d/dev/compare.html?shoulders).
- [11B.2 vs pesos del ensayo](http://127.0.0.1:4173/poses-3d/dev/compare.html?shoulders&reference=11b2): aísla el cambio de pesos. Ambos aplican los mismos cuatro correctivos previos. El checkbox de hombros permite probar los deltas rechazados.
- Frente, espalda, perfil y 3/4 de 01/02/05/07/20; detalles on/off; las mismas cámaras, luces y material. 05 aporta elevación lateral cercana a 90°, 02 supera 120°, 20 flexión anterior y 07 extensión posterior. No se inventaron nuevas poses.
- [Comparación de pesos, brazo elevado](audit/shoulders/weights-02-Frente.png), [ensayo elevado on](audit/shoulders/02-Frente-on.png), [off](audit/shoulders/02-Frente-off.png).
- [Ensayo posterior](audit/shoulders/07-34-derecho-on.png), [anterior](audit/shoulders/20-34-derecho-on.png).
- 79 capturas: 20 comparaciones completas, 40 detalles on/off, 16 comparaciones aisladas de pesos y tres móviles. La evaluación numérica recorre las veinte poses, pero las capturas detalladas se limitan a esos cinco casos.

**Decisión:** no se aprueban los seis correctivos. El suavizado de pesos reduce un escalón del brazo elevado, pero no cumple una mejora anatómica clara en todas las vistas. El ensayo de recuperación de volumen conserva masa y también conserva/amplifica defectos de la forma original. No se presentan estos resultados como mejora anatómica terminada.

Para superar el gate falta modelado/escultura y revisión artística de la transición deltoides–pectoral–trapecio y axila sobre este maestro, con pesos revisados en las mismas poses. Los seis keys existentes sirven de punto de comparación; no deben aceptarse solo por suavizar o aumentar volumen. Si esa corrección no es convincente, reconsiderar un mesh anatómico mejor sin alterar el rig. No se preparó ni descargó un sustituto externo en esta subfase.

## Coste registrado

GLB de ensayo: **7.628.192 bytes**, frente a 7.233.036 de 11B.2. El reemplazo de atributos de pesos añade aproximadamente 349 kB; el GLB conserva los bloques anteriores para no alterar otros accessors. Hay margen de compactación antes de integrar. Se conserva una única malla Body y el mismo número de vértices/triángulos.

| Key | Bytes adicionales GLB | CPU POSITION+NORMAL | Textura GPU antes de padding |
| --- | ---: | ---: | ---: |
| shoulderRaise_L | 8.004 | 348.408 | 464.544 |
| shoulderRaise_R | 7.412 | 348.408 | 464.544 |
| shoulderForward_L | 8.000 | 348.408 | 464.544 |
| shoulderForward_R | 7.416 | 348.408 | 464.544 |
| shoulderBack_L | 8.004 | 348.408 | 464.544 |
| shoulderBack_R | 7.416 | 348.408 | 464.544 |

Fuente reproducible: [budget.json](audit/shoulders/budget.json). Todos afectan SHOULDER; no se justifica su coste para producción dado el gate rechazado. Sparse reduce descarga, no la expansión que hace GLTFLoader. Los seis suman aproximadamente 2 MiB de atributos CPU y 2,66 MiB de textura GPU sin padding. El total Body de 316 targets POSITION/NORMAL ronda 140 MiB de textura sin padding, heredando el coste de NORMAL introducido en 11B.2. El comparador de dos personajes demanda aún más; capturas móviles emuladas no certifican memoria en un teléfono físico.

## Verificación y pendientes

63 tests unitarios; exactitud reproducible del GLB, pesos finitos/normalizados, conservación de los cuatro correctivos, soporte protegido, seis referencias L/R y coincidencia con Blender menor a 0,002 mm. Controlador con curvas, brazo/clavícula, reset y NaN. Dos pruebas de navegador: veinte poses, exportación sin cambios de huesos, edición, reset exacto, AnimationClip al 43 %, cambios repetidos, tres muestras móviles, dos GLB (uno por visor), consola sin errores y comparación aislada de pesos.

Regresión conjunta de hombros, 11B.2, candidato base y material Anatomía: siete tests de navegador aprobados en modo CI. Build aprobado; JS `index-CHVX4fXg.js` 702,35 kB y CSS 13,64 kB, idénticos a 11B.2. Presets corporales conservados por los tests existentes; el ensayo no está validado artísticamente con todas sus combinaciones.

Falta completar el gate artístico de hombros. **11B.3B (cintura/pelvis), contrapposto, torsoTwist, abdomenCrunch, hipFlex y gluteFlex no se iniciaron.** No se sustituyó `human-anatomy-v2.glb` porque este ensayo no reúne las condiciones visuales para convertirse en el candidato aprobado. No hay despliegue ni cambios productivos.
