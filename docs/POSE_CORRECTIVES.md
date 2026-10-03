# Correctivos dependientes de la pose — Fase 7

## Estado del modelo

`human.glb` conserva 306 nombres de morph targets, cuatro SkinnedMesh y 52 huesos. MODEL_AUDIT.md no identifica targets correctivos articulares; DEFORMATION_AUDIT.md documenta defectos que todavía requieren revisar pose y pesos.

`POSE_CORRECTIVES` en `src/anatomy/correctives.ts` está vacío deliberadamente. Ningún morph corporal se activa por flexionar una articulación. El controlador está preparado para shape keys reales, inspeccionadas y calibradas, sin añadir geometría, sustituir el GLB ni alterar el skeleton.

Esta fase aporta la API independiente y sus pruebas. El visor de producción conserva su comportamiento y bundle: no necesita instanciar un controlador sin bindings. La integración de eventos de edición manual corresponde a Fase 14; la especificación de shape keys faltantes corresponde a Fase 9.

## API

```ts
const correctives = new PoseCorrectiveController(
  character.model,
  character.skeleton.bones,
  bodyMorphController,
  POSE_CORRECTIVES,
);
correctives.update();
const diagnostics = correctives.getStates();
correctives.reset();
```

Los nombres se resuelven desde el mapa del SkeletonAdapter, que conserva `mixamorig:*` aunque GLTFLoader sanitice Object3D.name. Los huesos deben pertenecer al personaje recibido; los sensores bend deben seguir el orden de la jerarquía A → B → C, admitiendo huesos intermedios.

- `update()`: actualiza matrices mundiales, mide los sensores activos y escribe solamente sus morphTargetInfluences mediante BodyMorphController.
- `getStates()`: copia de diagnóstico por regla: ID, articulación, morph, binding activo, motivo, último ángulo e influencia.
- `reset()`: pone a cero solamente correctivos activos. Conserva morphs corporales, pose, geometría, materiales y estado de animación.

El propietario debe llamar `update()` después de aplicar una pose o avanzar el AnimationMixer, antes de renderizar. No hay temporizador, callback por frame ni suscripción implícita. Los huesos, vectores, ejes y quaternions de trabajo se resuelven una vez; update reutiliza los objetos existentes. Una lista vacía no actualiza siquiera las matrices.

## Medición de ángulos

### `bend`: tres centros articulares

`boneA` identifica el inicio del primer segmento, `boneB` la articulación y `boneC` el final del segundo. Para un codo Mixamo: Arm → ForeArm → Hand; para una rodilla: UpLeg → Leg → Foot.

Se calcula `180° − acos(dot(normalize(A−B), normalize(C−B)))`. Un segmento recto produce 0° y una flexión completa 180°. La medición no depende de Y-up/Z-up, orientación global, rotaciones de padres, traslación o escala uniforme. No distingue flexión de hiperextensión ni elimina efectos de escala no uniforme; no debe usarse para activar una corrección direccional del hombro o torso.

### `local-axis`: giro firmado respecto del reposo

Requiere el nombre del hueso, un eje de tres componentes, un quaternion de reposo explícito y `direction: 1 | -1`. No captura la pose actual como supuesto reposo.

La rotación relativa es `inverse(restQuaternion) * bone.quaternion`. Se extrae su componente de giro sobre el eje mediante proyección del vector del quaternion: `2 * atan2(dot(q.xyz, axis), q.w)`, ajustada a −180°…180°. El sentido configurado activa solo los ángulos positivos. Quaternions q y −q representan el mismo giro, salvo la ambigüedad inevitable del signo exactamente a 180°.

El eje está expresado en el espacio local de reposo del hueso. Debe calibrarse con el rig y las poses usados al esculpir la shape key. No se adivinan ejes anatómicos ni se usan Euler globales. La extracción de giro no es un solver de límites anatómicos o IK; una rotación de 180° perpendicular al eje tiene giro indeterminado y se desactiva con diagnóstico.

## Configuración y activación

Una regla contiene:

| Campo | Significado |
| --- | --- |
| id | Identificador único de regla |
| joint | Etiqueta de articulación para diagnóstico |
| morph | Nombre exacto de un target correctivo inspeccionado |
| measurement | Sensor bend o local-axis y su calibración |
| startAngle | Grados hasta los que influencia = 0 |
| fullAngle | Grados desde los que influencia = 1, o el tope permitido del morph |

Entre ambos umbrales se interpola linealmente. Debe cumplirse `0 ≤ startAngle < fullAngle ≤ 180`. BodyMorphController limita el resultado al rango permitido; un tope .4 convierte el máximo en .4. Los correctivos deben admitir influencia 0.

Los valores de umbral deben provenir de la shape key diseñada, no de asumir compatibilidad entre nombres. Para añadir una regla:

1. Inspeccionar el GLB actualizado y verificar que el target realmente exista y tenga los deltas correctos.
2. Identificar su articulación, sensor, reposo, eje/sentido si corresponde y poses de calibración.
3. Añadir una regla tipada a `POSE_CORRECTIVES` con el nombre exacto y sus umbrales validados.
4. Probar reposo, valores intermedios, activación completa, sentido contrario y conservación de los morphs corporales.
5. Revisar visualmente las poses afectadas antes de conectar eventos del visor.

La configuración actual no incluye ejemplos activos con nombres inventados. Los targets de las pruebas sintéticas existen exclusivamente en fixtures de test.

## Protecciones

- Morph o hueso ausente: binding desactivado con diagnóstico, sin excepción ni escritura.
- ID/morph repetido, umbrales inválidos o calibración inválida: error explícito al construir; ningún morph se escribe en el constructor.
- Segmento de longitud cero, coordenadas/quaternion inválidos o giro indeterminado: correctivo a 0, ángulo null y diagnóstico; se recupera al volver a una pose válida.
- Una regla por target: evita sobrescrituras ambiguas. No se combinan reglas ni se superponen correctivos con controles corporales sin calibración.
- No se modifican huesos, JSON fuente, historial del editor, mixer, props, cámara, iluminación o temporizador.

## Pruebas

```sh
pnpm test
pnpm exec playwright test e2e/pose-correctives.spec.ts e2e/rigged-character.spec.ts
pnpm build
```

Las pruebas cubren umbrales, flexión, calibración local con reposo distinto de identidad, sentidos, equivalencia q/−q, límites de influencia, targets/huesos ausentes, valores inválidos, recuperación y AnimationMixer. El GLB real se prueba con las veinte poses y configuración vacía para confirmar que no modifica cuerpo ni skeleton. Eso valida la arquitectura, no una mejora anatómica visual: no hay correctivos articulares activos en el asset actual.
