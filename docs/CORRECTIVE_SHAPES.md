# Especificación de corrective shape keys para Blender — Fase 9

## Alcance y estado

Este documento es una guía de trabajo para un artista que revise el rig y esculpa correctivos. Los 26 nombres siguientes están ausentes del GLB actual, según [CORRECTIVE_GAPS.md](CORRECTIVE_GAPS.md). No se crearon shape keys, archivos Blender, drivers ni bindings; `POSE_CORRECTIVES` sigue vacío.

Base: `public/models/human/human.glb`, SHA-256 `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`. Cuatro meshes, 52 huesos `mixamorig:*`, 306 nombres únicos de morph. La procedencia MakeHuman/MPFB2 CC0 permanece en SOURCE.txt y LICENSE.txt.

Todos los correctivos se plantean inicialmente sobre **Body**. Las partes auxiliares de la cabeza conservan sus targets actuales. La forma muscular procede de la malla esculpida; el código únicamente mezcla deltas exportados.

## Convenciones de trabajo y calibración

- L/R identifica el lado anatómico del personaje, no el lado de la pantalla.
- Los grados de las tablas son **propuestas iniciales de esculpido**, no límites anatómicos ni umbrales comprobados del GLB. Un artista debe ajustarlos al resultado real y registrar la calibración antes de activar cualquier regla.
- Codo/rodilla: segmento recto = 0°. Medir con centros Arm → ForeArm → Hand y UpLeg → Leg → Foot, como el sensor `bend` de Fase 7.
- Para hombro, torso, cadera y tobillo: preparar una pose de referencia neutra explícita y registrar el quaternion local del hueso controlador. El eje y sentido se determinan en ese espacio local; no se presupone X/Y/Z ni un signo idéntico a ambos lados.
- La referencia neutra de hombro se calibra con brazo junto al torso. Puede diferir de la bind pose importada. No usar la T-pose como si representara automáticamente elevación 0°.
- Las poses de esculpido se diseñan manualmente sobre el rig existente. Los IDs del catálogo son casos de revisión, no la única pose de calibración.
- Infl. 0 = ninguna contribución del correctivo; infl. 1 = el delta completo esculpido. Entre umbrales, probar interpolación y continuidad. Una pose inversa debe dejar a cero los targets direccionales.
- Los correctivos de volumen nombrados biceps/quad/glute/calf describen respuesta geométrica a una pose. El ángulo no determina esfuerzo ni contracción muscular. Si una forma necesita distinguir esfuerzo de relajación en la misma pose, su activación queda pendiente de un control adicional diseñado para ese propósito.

## Brazos y hombros

En cada fila, los demás segmentos se mantienen en la referencia neutra salvo las compensaciones de clavícula indicadas. Evitar añadir volumen ya cubierto por otro correctivo.

| Shape key | Región que modifica | Pose de Blender para modelar influencia 1 | Articulación/controlador | Influencia 0 | Influencia 1 propuesta |
| --- | --- | --- | --- | --- | --- |
| `bicepsFlex_L` | Masa anterior del brazo izquierdo, transición hacia codo; conservar inserciones | Flexionar codo izquierdo 120°, antebrazo sin torsión añadida; esculpir acortamiento/redistribución moderada, separada del pliegue del codo | Codo: LeftArm → LeftForeArm → LeftHand | Flexión ≤ 40° | Flexión ≥ 120°; revisar relajación/esfuerzo antes de automatizar |
| `bicepsFlex_R` | Misma región del brazo derecho | Codo derecho 120°, antebrazo sin torsión añadida; verificar asimetría real del rig | Codo: RightArm → RightForeArm → RightHand | Flexión ≤ 40° | Flexión ≥ 120°; misma reserva sobre esfuerzo |
| `elbowFlex_L` | Pliegue interior, olécranon y transición exterior del codo izquierdo | Codo izquierdo 130°; preservar espacio del pliegue y continuidad alrededor del hueso, sin sumar el bíceps | Codo: LeftArm → LeftForeArm → LeftHand | Flexión ≤ 20° | Flexión ≥ 130° |
| `elbowFlex_R` | Pliegue y contorno del codo derecho | Codo derecho 130°; revisar ambas caras y perfil | Codo: RightArm → RightForeArm → RightHand | Flexión ≤ 20° | Flexión ≥ 130° |
| `shoulderRaise_L` | Unión deltoide-axila-tórax izquierdo | Abducir brazo izquierdo hasta elevación humeral local de 100° respecto de referencia con brazo abajo; acompañar clavícula de manera validada | Hombro: LeftArm respecto de LeftShoulder; registrar también pose de LeftShoulder | Elevación local ≤ 30°, y fuera del plano calibrado | Elevación local ≥ 100° en el plano de abducción calibrado |
| `shoulderRaise_R` | Unión deltoide-axila-tórax derecho | Abducción derecha a 100° con compensación de clavícula equivalente, revisada individualmente | RightArm respecto de RightShoulder | Elevación local ≤ 30°, y fuera del plano calibrado | Elevación local ≥ 100° en el plano calibrado |
| `shoulderForward_L` | Unión anterior/posterior del hombro izquierdo al adelantar brazo | Flexión anterior del brazo a 70°, codo recto; revisar avance de clavícula sin trasladar arbitrariamente el joint | LeftArm respecto de LeftShoulder; documentar contribución de clavícula | Flexión anterior ≤ 15° o movimiento posterior | Flexión anterior ≥ 70° en el plano sagital calibrado |
| `shoulderForward_R` | Misma unión del hombro derecho | Flexión anterior derecha a 70°; comparar axila y deltoide con lado izquierdo | RightArm respecto de RightShoulder | Flexión anterior ≤ 15° o movimiento posterior | Flexión anterior ≥ 70° en el plano calibrado |
| `shoulderBack_L` | Unión posterior del hombro izquierdo y pliegue axilar | Extensión posterior del brazo izquierdo a 35°, torso neutro; confirmar que el defecto persista tras revisar pesos | LeftArm respecto de LeftShoulder, sentido posterior | Extensión posterior ≤ 10° o movimiento anterior | Extensión posterior ≥ 35° |
| `shoulderBack_R` | Misma región del hombro derecho | Extensión posterior derecha a 35°, sin compensar con torsión del torso | RightArm respecto de RightShoulder, sentido posterior | Extensión posterior ≤ 10° o movimiento anterior | Extensión posterior ≥ 35° |

Prioridad de evidencia: shoulderRaise/Forward y elbowFlex. Revisar 02/07/09/12/15/18/19 para hombros, 03/13/16/20 para codos. shoulderBack y bicepsFlex requieren confirmar necesidad y activación.

## Torso

La flexión y torsión se distribuyen por Spine/Spine1/Spine2 según la pose diseñada. Las cantidades indicadas son **totales relativos a pelvis**; registrar también los quaternions de cada segmento, no asignar todo el giro a un solo hueso.

| Shape key | Región que modifica | Pose de Blender para modelar influencia 1 | Articulación/controlador | Influencia 0 | Influencia 1 propuesta |
| --- | --- | --- | --- | --- | --- |
| `chestCompress` | Tórax anterior y transición pectoral, conservando volumen costal | Flexión anterior total de tronco de 35°, brazos relajados; repartir flexión y esculpir solo región torácica | Flexión torácica distribuida Spine1/Spine2 respecto de pelvis | Flexión total ≤ 10° o extensión | Flexión total ≥ 35° con reparto torácico calibrado |
| `abdomenCrunch` | Abdomen, cintura anterior y unión con pelvis | Flexión anterior total de 50°, pelvis estable; corregir compresión abdominal sin repetir el delta torácico | Flexión distribuida Spine/Spine1/Spine2 | Flexión total ≤ 15° o extensión | Flexión total ≥ 50° con reparto calibrado |
| `torsoTwist_L` | Cintura y espalda en giro hacia la izquierda del personaje | Torsión total izquierda de 45° con pelvis estable; corregir surcos conservando contorno | Torsión distribuida Spine/Spine1/Spine2 relativa a Hips, sentido izquierdo | Giro izquierdo ≤ 10° o giro derecho | Giro izquierdo ≥ 45° con distribución calibrada |
| `torsoTwist_R` | Cintura y espalda en giro hacia derecha | Torsión total derecha de 45°, sin inclinar el torso para simular giro | Misma cadena, sentido derecho | Giro derecho ≤ 10° o giro izquierdo | Giro derecho ≥ 45° con distribución calibrada |
| `lateralBend_L` | Cintura izquierda comprimida y lado derecho estirado | Inclinación lateral total izquierda de 30°, pelvis estable; preservar costillas y transición lumbar | Flexión lateral distribuida Spine/Spine1/Spine2, sentido izquierdo | Inclinación izquierda ≤ 5° o inclinación derecha | Inclinación izquierda ≥ 30° con distribución calibrada |
| `lateralBend_R` | Cintura derecha comprimida y lado izquierdo estirado | Inclinación lateral total derecha de 30°; revisar que el resultado no sea solo un espejo geométrico | Misma cadena, sentido derecho | Inclinación derecha ≤ 5° o inclinación izquierda | Inclinación derecha ≥ 30° con distribución calibrada |

Revisar 19 para torsión, 15 para inclinación lateral y 17/20 para compresión. El pliegue anterior de una pose extrema debe separarse de errores de distribución de rotación.

## Piernas

| Shape key | Región que modifica | Pose de Blender para modelar influencia 1 | Articulación/controlador | Influencia 0 | Influencia 1 propuesta |
| --- | --- | --- | --- | --- | --- |
| `kneeFlex_L` | Rodilla izquierda, pliegue poplíteo y contorno anterior | Rodilla izquierda flexionada 130°, pie neutro; recuperar transición local sin inflar muslo | Rodilla: LeftUpLeg → LeftLeg → LeftFoot | Flexión ≤ 25° | Flexión ≥ 130° |
| `kneeFlex_R` | Misma región de rodilla derecha | Rodilla derecha 130°, comprobar frente, espalda y perfil | Rodilla: RightUpLeg → RightLeg → RightFoot | Flexión ≤ 25° | Flexión ≥ 130° |
| `quadFlex_L` | Masa anterior/lateral del muslo izquierdo | Rodilla izquierda 110°, cadera neutra; redistribuir volumen si se demuestra defecto, sin duplicar kneeFlex | Rodilla izquierda como referencia geométrica; no sensor de esfuerzo | Flexión ≤ 40° | Flexión ≥ 110° en la condición geométrica calibrada |
| `quadFlex_R` | Masa anterior/lateral del muslo derecho | Rodilla derecha 110°, revisar continuidad de tendón y separación de región articular | Rodilla derecha como referencia geométrica | Flexión ≤ 40° | Flexión ≥ 110° en condición calibrada |
| `hipFlex_L` | Ingle y transición anterior pelvis-muslo izquierdo | Flexión de cadera izquierda 100°, abducción/rotación axial neutras; flexionar rodilla solo para evitar contactos ajenos al defecto | LeftUpLeg respecto de Hips, flexión anterior calibrada | Flexión de cadera ≤ 25° o extensión | Flexión ≥ 100° con abducción/rotación neutras |
| `hipFlex_R` | Ingle y transición anterior pelvis-muslo derecho | Cadera derecha 100° con las mismas condiciones de aislamiento | RightUpLeg respecto de Hips | Flexión ≤ 25° o extensión | Flexión ≥ 100° con condiciones calibradas |
| `gluteFlex_L` | Masa glútea izquierda y transición posterior del muslo | Cadera izquierda flexionada 110°, rodilla 90°, sin asiento; mantener volumen posterior bajo flexión, no simular contracción | LeftUpLeg respecto de Hips; revisar influencia de rodilla | Flexión de cadera ≤ 40° o extensión | Flexión ≥ 110° solo si se valida esta condición geométrica |
| `gluteFlex_R` | Masa glútea derecha y transición posterior | Cadera derecha 110°, rodilla 90°, sin prop; evaluar ambos perfiles | RightUpLeg respecto de Hips; revisar rodilla | Flexión ≤ 40° o extensión | Flexión ≥ 110° en condición calibrada |
| `calfFlex_L` | Masa posterior de pantorrilla izquierda y transición hacia Aquiles | Flexión plantar izquierda 35° respecto del tobillo neutro, rodilla casi recta; confirmar defecto antes de esculpir | LeftFoot respecto de LeftLeg, sentido de flexión plantar | Flexión plantar ≤ 10° o dorsiflexión | Flexión plantar ≥ 35° con rodilla en condición calibrada |
| `calfFlex_R` | Misma región de pantorrilla derecha | Flexión plantar derecha 35°, comparar con rodilla flexionada antes de aprobar activador | RightFoot respecto de RightLeg, flexión plantar | Flexión plantar ≤ 10° o dorsiflexión | Flexión plantar ≥ 35° con condición calibrada |

Priorizar kneeFlex y hipFlex: 07/08/11/13/14/20. quadFlex, gluteFlex y calfFlex son candidatos condicionados a un defecto comprobado. La revisión sin props de 12/13 no mostró colapso glúteo grave. hipFlex no cubre por sí solo la abducción extrema de 18.

## Flujo de autoría en Blender

1. Trabajar en una copia de desarrollo y registrar versión de Blender, archivo fuente y hash. Importar el GLB y comprobar nombres, jerarquía, bind pose, meshes y shape keys existentes antes de editar.
2. Preparar referencia neutral con morphs corporales a 0. Guardar su pose y las poses de calibración por separado; verificar que permanezcan los 52 huesos y las mismas transformaciones de objeto.
3. Revisar pesos y reparto de rotación en la región. Definir el defecto residual que corregirá la shape key antes de esculpirla.
4. Añadir una key relativa en Body con el nombre de la tabla, referida a Basis, conservando número/orden de vértices y UV. Los pesos 0 y 1 representan la mezcla entre referencia y key según el [manual de Shape Keys](https://docs.blender.org/manual/en/4.2/animation/shape_keys/shape_keys_panel.html).
5. Posar el armature en la condición de influencia 1. Para editar sobre la deformación del rig, usar visualización en Edit Mode y edición de jaula del modificador Armature, conforme al [flujo oficial de correctivos](https://docs.blender.org/manual/en/2.80/animation/drivers/workflow_examples.html). Comprobar estas opciones en la versión utilizada; esta referencia documenta el método, no certifica una sesión de Blender ejecutada aquí.
6. Editar únicamente el delta de la key seleccionada, observando la región posada. Volver a reposo y comprobar que el delta es previo al skinning. Evitar guardar la malla completa ya posada como key sobre la Basis: sumaría de nuevo la deformación del armature. Una transferencia desde copia esculpida necesita conversión inversa del skinning verificada.
7. Alternar key 0/1 en la misma pose y revisar valores intermedios. Mantener fuera de la región el contorno y evitar intersecciones, bultos y duplicación de volumen con otros correctivos.
8. Modelar L/R por separado o usar espejo como punto de partida, verificando correspondencia topológica y orientación de cada lado. No alterar la Basis ni la topología para forzar simetría.
9. Validar sobre los cuatro presets y varias combinaciones manuales. Si un único delta no sirve para todos, registrar la limitación; no habilitar una corrección que empeore otros cuerpos.
10. Registrar capturas, pose y parámetros. Los drivers de Blender sirven para previsualización; el controlador del navegador requiere su propia configuración explícita.

## Compatibilidad con PoseCorrectiveController

La arquitectura de Fase 7 admite un sensor por target: `bend` de tres centros o `local-axis` de un hueso con referencia y sentido explícitos. No admite aún sumas de segmentos ni condiciones múltiples.

| Familia | Posible sensor existente | Condición para conectar en el futuro |
| --- | --- | --- |
| elbowFlex / kneeFlex | bend en la cadena de la tabla | Verificar umbrales con los centros reales, dirección de flexión y resultado visual |
| bicepsFlex / quadFlex | bend como indicador geométrico | Confirmar que el delta responde a deformación de pose; esfuerzo/contracción requieren información adicional |
| shoulderRaise/Forward/Back | local-axis de Arm con referencia calibrada | Validar plano y contribución de clavícula; si requiere separar planos o gates, dejar binding pendiente |
| hipFlex / gluteFlex | local-axis de UpLeg | Confirmar que rotación axial/abducción/rodilla no activen indebidamente el delta |
| calfFlex | local-axis de Foot | Confirmar respuesta con rodilla extendida y flexionada; condición doble requiere ampliar sensores en una fase autorizada |
| chestCompress / abdomenCrunch / torsoTwist / lateralBend | Ningún sensor actual reproduce directamente la suma de la cadena | Calibrar medición compuesta o justificar un único hueso representativo; no equiparar el ángulo total de la tabla con el local de Spine2 |

La tabla especifica el comportamiento deseado incluso cuando el controlador actual necesita capacidades posteriores para representarlo. Esta fase no cambia el controlador ni añade esas capacidades.

### Registro mínimo por key aprobada

- Nombre exacto, mesh, versión de autoría y hash del export de prueba.
- Región editada, defecto residual y referencia anatómica utilizada.
- Pose de referencia y poses 0/intermedia/1, con quaternions locales y posiciones de huesos conservadas.
- Tipo de sensor, nombres de huesos; para local-axis: restQuaternion normalizado, eje unitario y direction calibrados por lado.
- Calibración en el espacio del GLB exportado y vuelto a cargar con GLTFLoader. Los ejes/quaternions locales de Blender no se copian directamente: importación/exportación puede cambiar las bases locales aunque la pose mundial se vea igual. Capturar la referencia en el skeleton de destino y comprobar 0/intermedia/1 allí.
- startAngle/fullAngle finalmente medidos; las propuestas de este documento no se copian automáticamente a correctives.ts.
- Condiciones adicionales, combinaciones fallidas y prioridad de resolución.
- Capturas antes/después de la misma pose, cámara, cuerpo e iluminación.

## Export de prueba y aceptación

Guardar primero un GLB de desarrollo separado, fuera del human.glb de producción. Exportar shape keys y skinning; conservar la posición de reposo del armature y la jerarquía original. El [exportador glTF oficial](https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html) documenta estas opciones y la exportación opcional de normales de morph target.

Los correctivos se guardan como deltas de key respecto de la referencia, con pesos iniciales 0. No hornear poses de calibración en el modelo base. Evaluar normales de morph en el export de prueba por calidad visual y tamaño; el asset actual contiene solo deltas POSITION. La exportación de animación puede almacenar valores muestreados de shape keys, pero no proporciona al controlador del sitio la lógica dinámica de activación que esta especificación requiere. El manual explica el [muestreo de shape keys controladas por drivers](https://docs.blender.org/manual/es/4.2/addons/import_export/scene_gltf2.html).

Antes de autorizar una sustitución del asset:

- Auditar el export: mismos huesos/nombres, jerarquía, bind pose, skinning, transformaciones y materiales; targets actuales conservados y nuevos nombres efectivos.
- Comparar vértices/triángulos con la base; justificar cualquier cambio por partición de normales/UV del exportador, no aceptar cambios topológicos accidentales.
- Comprobar que reposo y morphs corporales con correctivos a 0 reproducen la base dentro de una tolerancia documentada.
- Probar las 20 poses, clips y edición manual; cada correctivo en 0/intermedia/1 y sentido contrario; revisar mezclas de keys en zonas compartidas.
- Revisar sombras, normales, intersecciones y volumen desde frente, perfiles y espalda en desktop/móvil.
- Verificar finitud, rangos, una carga de modelo, JSON lazy, ausencia de errores y tamaño de descarga/memoria.

El trabajo de esta fase entrega únicamente la especificación. La creación de shape keys, calibración visual en Blender, export candidato e integración requieren trabajo posterior autorizado; no se afirman como realizados.
