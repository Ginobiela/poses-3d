# Plan: sitio de práctica de dibujo con poses 3D

## 1. Objetivo

Crear un sitio en español para practicar dibujo de figura mediante poses 3D y sesiones cronometradas. El usuario configura la práctica, observa una pose desde un ángulo elegido y dibuja en papel o en su aplicación de dibujo. Al terminar el intervalo, aparece la siguiente pose.

Se interpreta «tree.js» como **Three.js**. Posemaniacs es una referencia funcional; el diseño y los recursos serán propios o tendrán permiso de redistribución.

Programador previsto: **Luna**. Este documento prepara el trabajo; no inicia una ejecución con ese modelo ni publica código.

Estado inicial: carpeta con Git inicializado, sin código y sin remoto configurado al revisar el proyecto.

## 2. Primera versión utilizable

- Interfaz en español, adaptable a computadora y tablet; usable desde móvil.
- Visor 3D con rotación, zoom y botón para restablecer la vista.
- Un cuerpo humano articulado y 20 poses revisadas visualmente.
- Poses de pie, sentadas, agachadas y de acción; etiquetas para filtrar.
- Intervalos de 30, 60, 90, 120 y 300 segundos, más duración personalizada.
- Sesiones de 5, 10 o 20 poses, con resumen de duración antes de iniciar.
- Orden aleatorio sin repeticiones hasta agotar las poses disponibles.
- Pausar, continuar, pasar de pose y finalizar la sesión.
- Indicador de pose actual, tiempo restante y progreso de la sesión.
- Cuenta inicial de tres segundos y aviso sonoro opcional.
- Pantalla completa, fondo claro u oscuro y preferencias locales.
- Resumen final: poses completadas, omitidas y tiempo efectivo de práctica.

Para esta primera entrega se posponen cuentas, sincronización, pagos, editor de poses, evaluación automática del dibujo, anatomía muscular detallada y un lienzo para dibujar dentro del sitio.

## 3. Experiencia y diseño

### Configuración

Una pantalla breve para elegir duración, cantidad, categorías y cámara fija o ángulo aleatorio. Mostrar el total estimado. Si el filtro no devuelve poses, explicar cómo corregirlo antes de iniciar.

### Práctica

El modelo ocupa la mayor parte de la pantalla. Temporizador y progreso arriba; controles compactos abajo. Estética de estudio: fondo neutro, tipografía legible y pocos elementos mientras se dibuja.

Permitir rotación manual sin mover automáticamente la figura durante el intervalo. Para cámara aleatoria, elegir el ángulo solamente al cambiar de pose. Ofrecer vistas frontal, lateral, posterior y tres cuartos.

Atajos: espacio para pausar o continuar; flecha derecha para omitir. Los botones tendrán nombres accesibles y foco visible. Los avisos visuales acompañarán al sonido.

### Resumen

Mostrar resultados y ofrecer repetir la configuración o iniciar otra sesión. El tiempo de pausa y carga no cuenta como práctica.

## 4. Tecnología propuesta

| Parte | Elección | Motivo |
| --- | --- | --- |
| Aplicación | TypeScript y Vite | Proyecto estático y una base pequeña |
| Interfaz | HTML y CSS con módulos TypeScript | La primera versión tiene pocas pantallas |
| Visor | Three.js | Carga, iluminación, cámara y representación del cuerpo |
| Recursos | GLB/glTF mediante GLTFLoader | Separar los modelos del código |
| Cámara | OrbitControls | Rotación y zoom |
| Preferencias | localStorage | Persistencia sencilla en el dispositivo |
| Pruebas de lógica | Vitest | Comprobar tiempos, transiciones y selección de poses |
| Prueba de flujo | Playwright | Comprobar una sesión completa en navegador |
| Código | GitHub | Historial, revisión y validación automática |

No hace falta un servidor propio para este alcance. Elegir alojamiento estático al preparar la publicación; guardar el código en GitHub no publica automáticamente el sitio. Fijar las versiones de dependencias con el archivo de bloqueo al implementar.

## 5. Modelos y biblioteca de poses: dependencia principal

### Decisión propuesta

Usar un único modelo humano con esqueleto compatible y guardar poses como transformaciones de sus huesos. Cada pose incluye identificador, nombre, etiquetas, referencia al rig y cámara sugerida. Las rotaciones se guardan como cuaterniones locales y deben corresponder al mismo esqueleto y postura de referencia.

Antes de construir el catálogo, validar **un modelo y cinco poses**. Revisar hombros, caderas, manos, contacto con el suelo e intersecciones. Un maniquí de formas simples sirve para probar el programa; la calidad del cuerpo y las poses debe ser suficiente para estudiar dibujo antes de considerar lista la primera versión.

Si no se consigue un rig adecuado, evaluar poses exportadas como GLB independientes. Es más simple, pero aumenta el tamaño de descarga. Registrar esa decisión antes de ampliar el catálogo.

### Recursos y procedencia

- Seleccionar o producir un cuerpo y poses con permiso para su uso y redistribución pública.
- Guardar autor, fuente, licencia y atribución exigida en `ASSET_LICENSES.md`.
- Mantener separadas la licencia del código y las licencias de los modelos.
- No extraer modelos ni poses de Posemaniacs.
- Si hacen falta recursos comprados o trabajo en Blender, identificar la dependencia y su costo antes de comprometer la calidad visual final.
- Luna implementa la aplicación y la integración; el modelado y la curaduría visual requieren una revisión específica.

## 6. Arquitectura

```text
src/
  main.ts
  viewer/       escena, cámara, luces, carga y aplicación de poses
  session/      estados, reloj, secuencia y resultados
  catalog/      tipos, manifiesto y filtros
  ui/           configuración, controles y resumen
  storage/      preferencias versionadas
  styles/
public/
  models/
  poses/
tests/
ASSET_LICENSES.md
README.md
```

Separar el reloj del renderizado. Estados explícitos: configuración, carga, preparación, ejecución, pausa, finalización y error.

- Medir el tiempo con `performance.now()` y un instante límite; evitar restar un segundo en cada llamada de `setInterval`.
- Al ocultar la pestaña, pausar la sesión. Al regresar, pedir que se reanude mediante el control habitual.
- Iniciar el intervalo cuando la pose esté visible y lista.
- Evitar avances dobles si coinciden el fin del tiempo y el botón siguiente.
- Guardar el tiempo restante al pausar y reconstruir el instante límite al continuar.
- Barajar el catálogo filtrado y no repetir hasta agotarlo; evitar repetir la última pose al empezar otro ciclo cuando existan alternativas.
- Registrar una pose omitida por separado de una completada.
- Validar duraciones y cantidades; propuesta inicial: 5–1800 segundos y 1–100 poses.

Para el visor: encuadrar el cuerpo completo, limitar zoom y densidad de píxeles, reutilizar el modelo, liberar recursos reemplazados y mostrar un error comprensible si falla la carga o no hay soporte gráfico. Mantener la figura inmóvil durante la práctica.

## 7. Entregas para Luna

### Entrega 1 — Base y prueba 3D

Crear proyecto, comandos de desarrollo y compilación, visor, luces, controles de cámara y carga de un modelo. Probar cinco poses antes de fijar el formato del catálogo.

**Aceptación:** el proyecto arranca desde una instalación limpia; el cuerpo se ve entero; rotación y zoom funcionan; no hay errores de consola; se documenta la procedencia del recurso y la decisión de rig.

### Entrega 2 — Catálogo

Definir esquema de datos, cargar poses, filtrar categorías, aplicar poses y generar la secuencia aleatoria. Ampliar gradualmente hasta 20 poses revisadas.

**Aceptación:** ninguna pose aparece deformada por errores de rig; los filtros funcionan; un catálogo vacío tiene una salida clara; no hay repeticiones antes de agotar las opciones.

### Entrega 3 — Sesión cronometrada

Implementar la máquina de estados, configuración, cuenta inicial, pausa, avance, finalización y resumen. Agregar pruebas del reloj con tiempo simulado.

**Aceptación:** los intervalos son correctos, pausar conserva el tiempo, ocultar la pestaña pausa, cargar no consume tiempo y la última pose lleva al resumen una sola vez.

### Entrega 4 — Interfaz de práctica

Construir las tres pantallas, diseño adaptable, atajos, pantalla completa, sonido opcional y preferencias. Incorporar cámara aleatoria limitada a ángulos útiles y revisión visual en móvil.

**Aceptación:** se completa una sesión con teclado o controles táctiles; los controles no tapan la figura; el audio se habilita desde una interacción del usuario; las preferencias sobreviven a la recarga.

### Entrega 5 — Verificación y GitHub

Agregar una prueba de sesión completa, documentación y automatización para comprobar tipos, pruebas y compilación en GitHub. Revisar errores de carga, secuencias largas y liberación de recursos.

**Aceptación:** otra persona puede clonar, instalar y ejecutar siguiendo el README; las verificaciones pasan; no se incluyen secretos, dependencias instaladas ni archivos generados innecesarios en Git.

Configurar el repositorio del usuario cuando se conozcan cuenta, nombre y visibilidad. Subir el código y verificar el remoto como parte de la implementación futura. Para una web pública, elegir alojamiento y comprobar allí las rutas de modelos y recursos.

## 8. Forma de trabajar con Luna

- Seleccionar Luna en el chat de implementación cuando comience la programación.
- Darle una entrega por vez, con objetivo, archivos implicados y criterios de aceptación.
- Pedir una compilación y las pruebas relevantes antes de cerrar cada entrega.
- Revisar el resultado 3D visualmente: una compilación correcta no garantiza buenas poses.
- Mantener cambios pequeños y commits por entrega; usar ramas con prefijo `codex/`.
- Pedir un resumen de cambios, verificación y pendientes al terminar cada bloque.
- Evitar ampliar el alcance hasta completar una sesión real de punta a punta.

### Prompt inicial preparado

> Implementá la entrega 1 de PLAN.md con TypeScript, Vite y Three.js. Primero leé el repositorio y sus instrucciones. Prepará un visor con cámara, iluminación, rotación, zoom y restablecimiento. Validá un modelo articulado y cinco poses compatibles con recursos que puedan redistribuirse. Documentá su procedencia. Si faltan esos recursos, podés usar un maniquí provisional propio para probar el visor, dejando explícito que la validación del catálogo sigue pendiente. Separá visor, catálogo y sesión. Ejecutá la compilación y verificá el resultado visual. Entregá un resumen con los archivos cambiados, las comprobaciones y los pendientes.

## 9. Hitos y decisiones pendientes

1. **Prueba técnica:** cuerpo visible y cinco poses útiles.
2. **Práctica funcional:** sesión de diez poses con cambio automático y pausa.
3. **Primera versión:** 20 poses, interfaz pulida y verificaciones completas.
4. **Entrega:** código en la cuenta de GitHub y, si se decide publicar, URL comprobada.

Decisiones propuestas para arrancar: español, maniquí neutro, 20 poses, sin cuentas y prioridad a computadora/tablet. Pendientes para la implementación: fuente del modelo, nombre y visibilidad del repositorio y proveedor de alojamiento. El mayor factor de esfuerzo será conseguir y revisar las poses, por lo que conviene estimar fechas después del primer hito.

## 10. Fuentes consultadas

- Referencia de práctica cronometrada: https://www.posemaniacs.com/en/tools/thirtyseconds
- Carga de modelos: https://threejs.org/docs/pages/GLTFLoader.html
- Controles de cámara: https://threejs.org/docs/pages/OrbitControls.html
- Guía de modelos 3D: https://threejs.org/manual/pages/loading-3d-models.html
