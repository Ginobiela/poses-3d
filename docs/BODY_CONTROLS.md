# Controles manuales — Fase 4

El panel plegable «Tipo de cuerpo» reúne los presets y diez sliders. Los controles se crean después de cargar el personaje y solo si están disponibles todos los morphs y rangos que necesitan. Utiliza el mismo BodyMorphController y los cuatro SkinnedMesh existentes.

## Controles disponibles

| Control | Sentido negativo | Sentido positivo | Rango del slider |
| --- | --- | --- | --- |
| Musculatura | — | bodyMuscular | 0 a 0.65 |
| Peso / grasa | bodyThinner | bodyHeavier | −0.65 a 0.65 |
| Altura (ajuste leve) | heightShorter | heightTaller | −0.04 a 0.04 |
| Hombros | shouldersNarrower | shouldersWider | −0.35 a 0.35 |
| Pecho | chestNarrower | chestWider | −0.35 a 0.35 |
| Torso | torsoLatsNarrower | torsoLatsWider | −0.35 a 0.35 |
| Cintura | waistNarrower | waistWider | −0.35 a 0.35 |
| Caderas | hipsNarrower | hipsWider | −0.35 a 0.35 |
| Brazos | armsThinner | armsThicker | −0.35 a 0.35 |
| Piernas | thighsThinner, calvesThinner | thighsThicker, calvesThicker | −0.35 a 0.35 |

Todos los nombres se comprobaron directamente en el GLB y tienen deltas efectivos en Body. Piernas aplica el mismo valor a muslos y pantorrillas; Torso ajusta el ancho de los dorsales. Musculatura controla el target general, mientras los targets regionales del preset elegido permanecen como estaban.

El valor negativo activa únicamente el target negativo con su magnitud absoluta; el positivo activa únicamente el positivo. El otro sentido se lleva a 0 para evitar acumular morphs opuestos. El centro corresponde a la forma base en esa dimensión. Los porcentajes mostrados son influencias del target; no miden grasa corporal, centímetros o porcentajes reales de altura.

Los topes son protecciones de UI, no límites anatómicos declarados por el asset. La altura tiene un tope especialmente pequeño porque el target completo desplaza puntos hasta aproximadamente 0.72 unidades del modelo. El ajuste no mueve el skeleton ni recalcula escala, cámara o posición sobre el suelo. Puede variar ligeramente el contacto con el suelo y la relación de superficie/articulaciones; no reemplaza un sistema de proporciones que adapte el rig.

## API y comportamiento

`src/anatomy/bodyControls.ts` mantiene el catálogo separado de la UI:

```ts
getBodyControlStates(controller); // descriptores soportados y valores actuales
setBodyControl(controller, 'shoulders', -0.2); // limita y aplica ambos sentidos
clearManualBodyControls(controller); // dimensiones ajenas al preset, a 0
```

En el visor:

```ts
const controls = await viewer.bodyControlStates();
viewer.setBodyControl('weight', -0.3); // síncrono para responder al evento input
viewer.getBodyPreset(); // 'custom'
await viewer.setBodyPreset('athletic');
```

- El evento `input` modifica influences inmediatamente, sin callbacks nuevos de render ni cargas adicionales.
- Un cambio manual muestra «Personalizado» en el selector. Esa opción describe el estado actual y no es un quinto preset.
- Elegir un preset aplica sus siete valores y limpia las dimensiones manuales adicionales. Los sliders se sincronizan con la configuración resultante. Neutral vuelve a los valores base de todos los targets expuestos.
- El controlador subyacente sincroniza nombres compartidos entre meshes: los dos targets de altura afectan Body, Eyes, Teeth y Tongue.
- NaN, infinitos y controles ausentes se rechazan antes de escribir. Los valores finitos fuera del rango de UI se limitan.
- Cambiar poses mantiene los valores manuales. No se modifican JSON, skeleton, editor/historial, props, materiales, luces, cámara ni AnimationPlayer.
- Se usan etiquetas accesibles y rangos nativos con el estilo existente, en escritorio y móvil. El panel empieza plegado.

La Fase 4 dejó los valores en la sesión del visor. La Fase 5 añade persistencia y «Restablecer cuerpo», descritos en [BODY_CONFIGURATION.md](BODY_CONFIGURATION.md). El formato de exportación de poses permanece igual.

## Verificación

- 5 pruebas unitarias nuevas con GLTFLoader y el GLB real: diez controles efectivos, omisión de controles incompletos, límites y exclusión de opuestos, sincronización de altura sin mover bones, limpieza al elegir presets y rechazo de valores inválidos sin escrituras parciales.
- 35 tests unitarios totales aprobados; la auditoría confirma que human.glb permanece intacto.
- 7 tests de navegador aprobados en body-presets, rigged-character y animations. Incluyen sliders en ambos sentidos, selección Personalizado, sincronización al cambiar presets, una descarga del GLB, continuidad de práctica, valores conservados entre poses y ausencia de errores en consola.
- El test del visor compara pose editada, historial, selección, props, cámara, luces e instancias antes/después de recorrer los controles. También comprueba que los ajustes manuales no cambian el frame de un AnimationClip pausado.
- Capturas revisadas a 1280×800 y 390×844: panel desplazable y plegable; diez controles operables; combinaciones de máximos sin roturas nuevas evidentes en las muestras. Esta comprobación no reemplaza la auditoría de deformaciones en todas las poses de Fase 6.
- Build estático aprobado: 29 módulos, JS 700.12 kB (+3.08 kB frente a Fase 3), gzip 181.08 kB; CSS 13.64 kB sin cambios. Sin nuevas dependencias.

```sh
pnpm test
pnpm build
pnpm exec playwright test e2e/body-presets.spec.ts e2e/rigged-character.spec.ts e2e/animations.spec.ts
```
