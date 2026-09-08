# Futuro Responsivo: Arquitectura de "Widgets / Bloques"

## 1. Visión General (El Objetivo)
El objetivo es transformar la aplicación de un único lienzo estático (donde la plantilla es un SVG de fondo de pantalla completa y Excalidraw se superpone por completo) a un documento HTML fluido y responsivo.

En lugar de que Excalidraw abarque toda la pantalla, la página se construirá con componentes estándar de React (`div`, `flexbox`, `grid`). Dentro de este diseño responsivo, incrustaremos componentes más pequeños llamados `DrawingBlock` (Bloques de Dibujo) en las áreas específicas donde el usuario necesite escribir a mano.

## 2. Ventajas de esta Arquitectura
- **Responsividad Real:** Los elementos pueden apilarse en móvil (una columna) y expandirse en tablet (dos o tres columnas) usando CSS estándar.
- **Tinta Anclada:** Como cada `DrawingBlock` tiene su propio lienzo de Excalidraw independiente, si el contenedor cambia de posición por el tamaño de pantalla, la tinta viaja junto con su contenedor.
- **Interacción Nativa:** Al ser HTML, se pueden usar inputs nativos (`<input>`, `<textarea>`) en lugar del complejo sistema de `CellFields` absolutos, y botones reales en lugar de `Hotspots`.

## 3. Plan de Implementación (Paso a Paso)

### Fase 1: Actualización de la Base de Datos
Actualmente `db.ts` guarda una única escena de Excalidraw usando la clave: `[fecha]::[sección]`.
Para soportar múltiples bloques, necesitamos actualizar el esquema para guardar por bloque:
- Nueva clave: `[fecha]::[sección]::[block_id]` (ej. `2026-09-08::timeblocking::notas`).
- Esto permitirá que cada bloque guarde y cargue sus propios trazos independientemente.

### Fase 2: Creación del Componente `DrawingBlock`
Refactorizar el `Canvas.tsx` actual para crear un nuevo componente `DrawingBlock.tsx`.
- Este componente será un contenedor HTML (`div`) con `position: relative`.
- Instanciará un lienzo de Excalidraw que ocupe el `100%` del ancho y alto de ese contenedor.
- Tendrá la opción de deshabilitar la interfaz de Excalidraw (barras de herramientas) para que se sienta como parte transparente de la página, controlando la herramienta activa desde una barra de herramientas global.

### Fase 3: Refactorización de las Plantillas (Templates) a HTML
Tomar las plantillas actuales (ej. `TimeBlockingTemplate.tsx`) que están hechas en SVG estricto, y reescribirlas como layouts HTML.
*Ejemplo para Time Blocking:*
- Crear un contenedor CSS Grid/Flexbox.
- **Prioridades:** Una caja HTML. En su interior, un `DrawingBlock` transparente para permitir dibujar o tachar.
- **Descarga Mental:** Otra caja HTML al lado (o debajo en móvil), con su propio `DrawingBlock`.
- Sustituir los elementos de SVG (`<rect>`, `<text>`) por divs con clases CSS.

### Fase 4: Reemplazar Cells y Hotspots
- **Cells (Celdas):** En lugar de usar `CellFields.tsx` superpuesto en coordenadas absolutas de toda la página, podemos insertar simples `<input type="text">` dentro del layout HTML.
- **Hotspots (Zonas interactivas):** Reemplazar `SheetHotspots.tsx` por simples `<button>` o `<a>` de HTML dentro del flujo normal del documento.

### Fase 5: Barra de Herramientas Global
Como ahora habrá múltiples mini-lienzos de Excalidraw en la pantalla, la barra de herramientas global (`Toolbar.tsx`) deberá comunicarse con el lienzo que esté "activo" en ese momento, o difundir el cambio de herramienta (Lápiz, Borrador, Selección) a todas las instancias de Excalidraw de la página simultáneamente.

## 4. Desafíos a tener en cuenta
1. **Líneas Continuas:** El usuario no podrá dibujar una línea gigante que atraviese toda la pantalla pasando de un bloque a otro. El lápiz se cortará en los bordes de cada `DrawingBlock`.
2. **Rendimiento:** Excalidraw es bastante pesado. Instanciar 10 lienzos de Excalidraw en una sola vista podría afectar el rendimiento. Habrá que ser estratégicos y quizás usar un solo lienzo HTML5 simple si los dibujos son solo firmas o marcas muy pequeñas, o limitar la cantidad de bloques activos a la vez.

---
*Este documento sirve como hoja de ruta para la refactorización hacia un modelo responsivo manteniendo la tinta digital.*
