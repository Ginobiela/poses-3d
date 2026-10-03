# Presets corporales — Fase 3

El selector «Preset corporal» ofrece Neutral, Delgado, Atlético y Musculoso. Aplica los morph targets del GLB ya cargado a través de BodyMorphController. No descarga otro modelo ni cambia el skeleton, la pose, los materiales o la iluminación.

## Valores usados

Nombres exactos comprobados en `docs/MODEL_AUDIT.md`. Todos tienen deltas efectivos en Body. `bodyThinner` también tiene una ocurrencia en Tongue, sincronizada por el controlador.

| Morph real | Neutral | Delgado | Atlético | Musculoso |
| --- | ---: | ---: | ---: | ---: |
| bodyThinner | 0 | 0.65 | 0.15 | 0 |
| bodyMuscular | 0 | 0 | 0.35 | 0.65 |
| armsMuscular | 0 | 0 | 0.15 | 0.30 |
| thighsMuscular | 0 | 0 | 0.15 | 0.30 |
| calvesMuscular | 0 | 0 | 0.10 | 0.20 |
| chestPectorals | 0 | 0 | 0.10 | 0.20 |
| bellyToned | 0 | 0 | 0.25 | 0.40 |

Delgado usa el adelgazamiento general existente; no suma varios estrechamientos regionales. Atlético y Musculoso combinan musculatura general con influencias regionales menores para evitar acumular targets completos en la misma zona. Son decisiones de presentación evaluadas en capturas del modelo, no medidas de grasa corporal ni rangos anatómicos certificados.

No se aplican morphs de altura, longitud de extremidades ni sexo. El skeleton permanece idéntico: estos presets no ajustan articulaciones a nuevas proporciones. Los valores mayores se mantienen en 0.65 y los regionales entre 0.10 y 0.40. El controlador conserva su política operativa 0–1.

## API e integración

```ts
import { applyBodyPreset } from './anatomy/bodyPresets';
applyBodyPreset(bodyMorphs, 'athletic');

// El visor espera su carga inicial; reutiliza los cuatro SkinnedMesh.
await viewer.setBodyPreset('muscular');
viewer.getBodyPreset(); // 'muscular'
```

`BODY_PRESETS` y sus mapas son inmutables. `BODY_PRESET_MORPHS` contiene la unión de los siete nombres usados. Cada cambio valida todos los nombres y rangos antes de escribir. Los pesos de un preset anterior se limpian al aplicar el siguiente; Neutral pone esos siete pesos en 0, iguales a los valores base del GLB. Morphs ajenos al preset, como los faciales, permanecen intactos.

El visor crea un solo BodyMorphController después de CharacterLoader. Cambiar el preset únicamente escribe influences y actualiza el identificador seleccionado. No recalcula altura, colocación sobre el suelo o encuadre; no reinicia el editor ni su historial y no toca AnimationPlayer o props. Cargar una pose o animación mantiene las influences existentes.

La Fase 3 añadió un selector de cuatro opciones. La Fase 4 lo reúne con los sliders en «Tipo de cuerpo», según [BODY_CONTROLS.md](BODY_CONTROLS.md). Al elegir un preset desde el visor también se limpian las dimensiones manuales adicionales; la función independiente applyBodyPreset sigue escribiendo únicamente sus siete targets. La persistencia pertenece a Fase 5. La exportación de poses mantiene su formato actual: exporta articulaciones, no configuración corporal.

## Validación y límites visuales

- Pruebas unitarias con el GLB real: nombres y deltas presentes, valores finitos, cuatro superficies distintas, retorno exacto a la superficie base con Neutral, limpieza de pesos anteriores y preservación de geometría/materiales/bones.
- Poses JSON y muestreo de AnimationClip mantienen el preset. Una configuración incompatible se rechaza sin escritura parcial.
- Navegador: cambio entre los cuatro presets con una sola solicitud del GLB; misma instancia de personaje, editor y AnimationMixer; pose editada, historial, articulación seleccionada, props, cámara, luces y frame congelado intactos.
- Reproducción activa continúa tras el cambio de cuerpo. La práctica cronometrada continúa y el selector funciona a 1280×800 y 390×844.
- Revisión de capturas: los cuatro cuerpos en De pie 01; Neutral/Musculoso en Brazos arriba; Neutral/Atlético en una pose sentada con silla en móvil. No se observaron roturas nuevas de la malla en estas muestras. El cambio de volumen es moderado, con mayor efecto en extremidades para Musculoso.
- La geometría continúa suave, especialmente en torso y abdomen. Los presets no añaden detalles superficiales, normales ni correctivos. El contacto con la silla presenta intersecciones tanto en Neutral como en Atlético; queda registrado para la auditoría de deformaciones de Fase 6. Esta revisión limitada no reemplaza esa auditoría de las 20 poses.

Capturas reproducibles en `test-results/body-presets-presets-conse-6de4c-da-props-cámara-y-animación/` al ejecutar las pruebas; son artefactos locales ignorados por Git, sin herramienta de comparación publicada en producción.

```sh
pnpm test
pnpm build
pnpm exec playwright test e2e/body-presets.spec.ts e2e/rigged-character.spec.ts e2e/animations.spec.ts
```

El bundle JS pasa de 693.15 a 697.04 kB (+3.89 kB sin gzip) al incorporar los módulos existentes y los presets. CSS permanece en 13.64 kB. No hay nuevas dependencias ni cambios del GLB, poses JSON o clips.
