# INDEX — Journal de Horas

Índice completo de archivos del proyecto **Journal de Horas** (app de productividad y registro por horas construida sobre `@excalidraw/excalidraw`, React, TypeScript, Vite, Dexie/IndexedDB y Capacitor para iPad).

> **Nota:** Se omiten los directorios de dependencias y artefactos compilados (`node_modules/`, `dist/`, `.vite/`, `ios/App/App/public/assets/`).

---

## Raíz y Configuración

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `index.html` | Documento HTML raíz con metadatos para iPad/PWA, fuente Google Fonts *Jost* y el punto de montaje `#root`. | Al modificar el título de la app, etiquetas `<meta>` de viewport/iOS o fuentes globales. |
| `package.json` | Manifiesto npm con dependencias (`@excalidraw/excalidraw` fijado en `0.18.1`, `dexie`, `react`, `@capacitor/*`) y scripts de desarrollo, build, test e iOS. | Al añadir/actualizar dependencias o consultar los comandos disponibles (`dev`, `build`, `test`, `cap:sync`). |
| `package-lock.json` | Árbol de dependencias exacto bloqueado por npm para instalaciones reproducibles. | Solo cuando se instalan o actualizan paquetes mediante npm (no editar manualmente). |
| `vite.config.ts` | Configuración de Vite con soporte React, `BASE_PATH` dinámico para GitHub Pages y definición de `process.env.IS_PREACT`. | Al cambiar la configuración del servidor de desarrollo, alias, plugins de Vite o rutas base de despliegue. |
| `capacitor.config.ts` | Configuración de Capacitor (`appId`, `appName`, `webDir`, `contentInset: "never"` y manejo del teclado en iOS). | Al ajustar la configuración nativa de iOS o habilitar temporalmente `server.url` para recarga en vivo en iPad. |
| `tsconfig.json` | Configuración raíz de TypeScript que referencia `tsconfig.app.json` y `tsconfig.node.json`. | Al añadir nuevos subproyectos o referencias de TypeScript. |
| `tsconfig.app.json` | Opciones estrictas del compilador TypeScript para el código fuente de la app en `src/`. | Al ajustar reglas de compilación o librerías DOM/ES para el código de la aplicación. |
| `tsconfig.node.json` | Opciones de compilación TypeScript para scripts/configuración en Node (`vite.config.ts`). | Al incluir nuevos archivos de configuración ejecutados en entorno Node. |
| `tsconfig.app.tsbuildinfo` | Caché incremental de compilación generada por TypeScript para `tsconfig.app.json`. | Archivo autogenerado por `tsc`; ignorar o eliminar si se requiere recompilación limpia. |
| `tsconfig.node.tsbuildinfo` | Caché incremental de compilación generada por TypeScript para `tsconfig.node.json`. | Archivo autogenerado por `tsc`; ignorar o eliminar si se requiere recompilación limpia. |
| `.gitignore` | Lista de archivos y carpetas ignorados por Git (dependencias, builds web, builds temporales de iOS y logs). | Al añadir nuevos archivos generados o credenciales locales que no deban versionarse. |

---

## Documentación y Hoja de Ruta

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `README.md` | Documentación principal del proyecto con estado actual, estructura de carpetas, comandos, despliegue en Pages y guía de build iOS. | Como punto de partida para entender la arquitectura general, comandos y flujo de despliegue. |
| `Implementacion Timer.md` | Especificación funcional, modelo de datos y notas de implementación del temporizador por fila y cronómetro libre. | Antes de modificar la lógica de `Esp`/`Ti`/`Tf`/`Real`, el cronómetro o el diálogo "Tiempo finalizado". |
| `Implementacion Habitos.md` | Especificación funcional, arquitectura, modelo Dexie v5 y reglas de negocio de la pestaña de Hábitos. | Antes de cambiar reglas de rachas, vista mensual ("Extender"), pausas o recordatorios de hábitos. |
| `Futuro responsivo.md` | Propuesta de refactorización futura hacia bloques HTML responsivos con múltiples mini-lienzos `DrawingBlock`. | Al planificar la migración de plantillas SVG estáticas a un diseño fluido/responsivo por bloques. |

---

## CI/CD Workflows (`.github/workflows/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `.github/workflows/pages.yml` | Workflow de GitHub Actions que compila con `BASE_PATH` y despliega la web en GitHub Pages en cada push a `main`. | Al ajustar el despliegue automático web o los permisos/pasos de publicación en GitHub Pages. |
| `.github/workflows/ios.yml` | Workflow manual de GitHub Actions en macOS que compila la app y genera un `.ipa` sin firmar para sideload en iPad. | Al lanzar manualmente una compilación iOS en la nube o actualizar la versión de Xcode/Node del runner. |

---

## Código Fuente — Shell de la App (`src/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/main.tsx` | Punto de entrada de React que importa los estilos de Excalidraw y monta `<App />` dentro de `#root`. | Solo si cambia la inicialización global de React o los estilos base de entrada. |
| `src/App.tsx` | Contenedor principal que coordina las pestañas de sección, fecha global, capas sincronizadas por `transform` y diálogo/toolbar globales. | Al agregar nuevas capas sobre la hoja, cambiar la navegación entre pestañas o modificar el layout de `.app-shell`. |
| `src/index.css` | Estilos globales del shell, pestañas de sección, marco `.page-frame`, capas superpuestas y ocultamiento de la UI nativa de Excalidraw. | Al ajustar el diseño general de la barra superior, z-index de capas o reglas táctiles para iPad. |
| `src/dates.ts` | Utilidades puras para fechas en formato ISO local `YYYY-MM-DD` (`todayISO`, `shiftISO`, `formatHuman`, `formatShort`). | Al formatear o desplazar fechas en cualquier componente manteniendo consistencia local sin zona horaria. |
| `src/DateBar.tsx` | Selector de fecha global (botones ◀/▶, `<input type="date">` nativo y botón "Hoy") en la barra de pestañas. | Al modificar la navegación por fechas de la barra superior. |
| `src/DateBar.css` | Estilos del selector de fecha global (`DateBar`). | Al cambiar la apariencia de los botones o el input de fecha en la cabecera. |
| `src/saveStatus.ts` | Tienda externa (`useSyncExternalStore`) que rastrea el estado global de guardado (`saved`, `pending`, `error`) y su marca de tiempo. | Al conectar nuevas operaciones de persistencia con el indicador visual de guardado. |
| `src/SaveIndicator.tsx` | Botón de disquete con insignia de estado y tooltip interactivo que muestra la hora del último guardado. | Al modificar la presentación o mensajes del estado de guardado en la cabecera. |
| `src/SaveIndicator.css` | Estilos del indicador de guardado, colores por estado (`pending`/`error`) y tooltip. | Al ajustar los colores o posición del icono de guardado. |
| `src/vite-env.d.ts` | Declaración de tipos de cliente Vite (`/// <reference types="vite/client" />`). | Al añadir tipados globales específicos de variables o imports de Vite. |

---

## Código Fuente — Lienzo, Celdas y Persistencia (`src/canvas/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/canvas/Canvas.tsx` | Wrapper de `<Excalidraw>` transparente que carga/guarda escenas o plantillas en IndexedDB, encaja la hoja y emite cambios de viewport. | Al modificar el autoguardado de tinta, la lógica de sembrado de plantillas o el encaje inicial (`fitSheet`). |
| `src/canvas/types.ts` | Tipos TypeScript de Excalidraw derivados de `ComponentProps<typeof Excalidraw>` para evitar acoplarse a subrutas internas. | Al necesitar tipos adicionales de la API, estado o elementos de Excalidraw. |
| `src/canvas/fitConfig.ts` | Constantes de padding y escala inicial para encajar la hoja dentro del marco; fuerza recarga completa vía HMR al editarse. | Al ajustar los márgenes iniciales alrededor de la hoja al abrir o cambiar de pestaña. |
| `src/canvas/db.ts` | Esquema Dexie v5 de IndexedDB (`scenes`, `cells`, `templates`, `timers`, `sessions`, `habits`, `habitLogs`) y operaciones CRUD. | Al añadir tablas/índices nuevos o modificar consultas y transacciones en IndexedDB. |
| `src/canvas/persistence.ts` | Funciones de serialización/restauración de escenas, versiones de plantilla, clonado de elementos y limpieza de semillas heredadas. | Al cambiar cómo se serializan escenas/plantillas o cómo se clonan trazos al sembrar un día nuevo. |
| `src/canvas/cellsStore.ts` | Tienda única de lectura/escritura de celdas por parches transaccionales, con caché en memoria, debounce y sincronización `BroadcastChannel`. | Al leer o modificar valores de celdas desde cualquier módulo sin colisiones entre escritores. |
| `src/canvas/CellFields.tsx` | Capa SVG de valores de celdas más un único `<input>` reposicionable para editar en modo celdas (con soporte Scribble/iPad). | Al cambiar el comportamiento de edición de celdas, normalizadores al confirmar o renderizado de texto en celdas. |
| `src/canvas/CellFields.css` | Estilos de la capa SVG de valores y del editor `<input>` flotante. | Al ajustar tipografía, alineación o borde de foco del editor de celdas. |
| `src/canvas/sceneClipboard.ts` | Lógica pura y almacén en `localStorage` para copiar/pegar trazos de Excalidraw entre días conservando coordenadas o desplazando colisiones. | Al modificar el comportamiento de Copiar/Pegar tinta o la preservación de vínculos entre elementos. |
| `src/canvas/SheetTemplate.tsx` | Plantilla SVG "CONCENTRACIÓN" (20 filas), definición de `CELLS`, `HOTSPOTS` y `COLUMN_MEANINGS`. | Al modificar la geometría, columnas o textos de ayuda de la hoja de Concentración. |
| `src/canvas/hotspot.ts` | Interfaces TypeScript para zonas interactivas (`Hotspot`) y leyendas de escala 1–10 (`ScaleLegend`, `ScaleRow`). | Al extender las opciones o metadatos de los popovers de ayuda en las plantillas. |
| `src/canvas/scales.ts` | Definición de las escalas 1–10 (Energía, Agradabilidad, Activación, Evitación) y sus acciones enlazadas. | Al editar las etiquetas, colores o accesos directos de las escalas emocionales/productivas. |
| `src/canvas/SheetHotspots.tsx` | Renderiza los botones transparentes sobre las cabeceras y abre por portal el popover explicativo o los modales asociados. | Al cambiar el posicionamiento o interacción de los popovers de ayuda sobre las hojas. |
| `src/canvas/SheetHotspots.css` | Estilos de las zonas táctiles `.hs-dot` y de los popovers de texto y escala 1–10. | Al ajustar la apariencia de los popovers de ayuda o sus botones de acción. |
| `src/canvas/MoodMeter.tsx` | Modal con la matriz de emociones 10×10 (Energía × Agrado) accesible desde la escala de Activación. | Al modificar las palabras o colores de la matriz emocional. |
| `src/canvas/MoodMeter.css` | Estilos compartidos de modal (`.mm-backdrop`, `.mm-panel`, `.mm-head`, `.mm-x`) y de la rejilla del Mood Meter. | Al ajustar el estilo base de modales en toda la app o la cuadrícula de emociones. |
| `src/canvas/Reappraisal.tsx` | Modal de "Reapreciación" cognitiva con flujo Situación → Interpretación → Agrado y preguntas guía. | Al editar el contenido educativo o ejemplos de la tarjeta de Reapreciación. |
| `src/canvas/Reappraisal.css` | Estilos específicos del modal de Reapreciación. | Al ajustar el diseño visual de la tarjeta de Reapreciación. |
| `src/canvas/Avoidance.tsx` | Modal interactivo con el diagrama de decisión "¿Estoy evitando?" y enlaces a Descansos activos y Reapreciación. | Al cambiar los pasos, preguntas o acciones del flujo anti-evitación. |
| `src/canvas/Avoidance.css` | Estilos del diagrama de flujo del modal "¿Estoy evitando?". | Al modificar la disposición responsiva o colores del diagrama de evitación. |

---

## Código Fuente — Secciones y Plantillas (`src/sections/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/sections/registry.ts` | Registro central `SECTIONS` que define cada pestaña (plantilla SVG, tamaño, `dateScoped`, celdas, temporizador, `overlay`, insignia). | Al añadir una nueva pestaña/sección o activar funciones (`supportsTemplate`, `timer`, `overlay`) en una existente. |
| `src/sections/TimeBlockingTemplate.tsx` | Plantilla SVG vertical "TIME BLOCKING" (3 prioridades, Descarga mental, bloque horario 4:00 AM–12:00 AM, Notas e Inicio) y sus hotspots. | Al ajustar el diseño SVG o los textos de ayuda de la hoja de Time blocking. |
| `src/sections/MenuDiaTemplate.tsx` | Plantilla SVG apaisada "MENÚ DESCANSOS ACTIVA" (pausas activas, hobbies, sociales, etc.) sin fecha diaria y sus hotspots. | Al modificar las categorías o diseño de la hoja de Descansos activos. |
| `src/sections/HabitosTemplate.tsx` | Plantilla SVG vertical "HÁBITOS" que dibuja la rejilla y exporta la geometría `HB` compartida con `HabitsLayer`. | Al cambiar dimensiones, columnas o franja de notas de la hoja de Hábitos. |

---

## Código Fuente — Temporizador y Cronómetro (`src/timer/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/timer/timerCore.ts` | Lógica pura del temporizador (`parseEsp`, formato de tiempo, máquina de estados, parches Ti/Tf/Real, cronómetro libre y descanso sugerido). | Al cambiar reglas de parsing de `Esp`, cálculo de `Real`, umbral accidental o formato del contador. |
| `src/timer/timerStore.ts` | Tienda externa del temporizador activo y del aviso "Tiempo finalizado", con persistencia en Dexie y sincronización `BroadcastChannel`. | Al modificar el ciclo de vida del timer, guardado de sesiones o comunicación multi-pestaña. |
| `src/timer/clock.ts` | Reloj único compartido (`useNow`) alineado cada 250 ms y activo solo mientras hay suscriptores visibles. | Al ajustar la frecuencia de refresco del contador sin provocar re-renders en `App`. |
| `src/timer/timerAudio.ts` | Programación de tono suave de fin con Web Audio API (`unlockAudio`, `scheduleChime`, `cancelChime`) independiente de `setTimeout`. | Al cambiar las notas, volumen o programación del sonido de finalización. |
| `src/timer/TimerChip.tsx` | Chip de la cabecera que muestra el cronómetro libre (`00:00 ▶`) o la cuenta atrás activa (`Fila N · mm:ss · ⏸ · ■`) y actualiza `document.title`. | Al cambiar la interfaz o acciones del contador en la barra superior. |
| `src/timer/RowPlayLayer.tsx` | Capa sobre la hoja que pinta el botón ▶/⏸ en el margen izquierdo de la fila `Esp` seleccionada y resalta la fila activa en gris. | Al modificar cómo se muestra o interactúa el botón de inicio/pausa por fila sobre la tabla. |
| `src/timer/TimeUpDialog.tsx` | Vigilante de cruce por cero y modal "Tiempo finalizado" con opciones Replantear y Descansar (15–20 % del tiempo trabajado). | Al ajustar el contenido del aviso de fin de bloque o su comportamiento al llegar a cero. |
| `src/timer/Timer.css` | Estilos de `TimerChip`, botones `.tm-play`, resaltado de fila activa y modal `.tu-panel`. | Al ajustar colores de estado (corriendo, pausado, tiempo extra) o estilos del modal de fin. |

---

## Código Fuente — Hábitos y Recordatorios (`src/habits/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/habits/habitCore.ts` | Lógica pura de hábitos: calendario versionado, pausas, `resolveState`, `nextLog`, cálculo de rachas/récord, porcentajes y `dueReminders`. | Al modificar cualquier regla de negocio de hábitos, rachas, porcentajes o recordatorios. |
| `src/habits/habitsStore.ts` | Tienda optimista en memoria sincronizada con Dexie v5 y `BroadcastChannel`, más importación única de nombres heredados. | Al cambiar acciones CRUD, marcado de días o sincronización de hábitos entre pestañas. |
| `src/habits/habitSettings.ts` | Tienda en `localStorage` para ajustes globales de hábitos (campana general y últimos minutos de "Luego"). | Al añadir nuevas preferencias globales para la sección de Hábitos. |
| `src/habits/minute.ts` | Reloj compartido de 1 minuto (`useMinute`) para actualizar estados "Pendiente" sin pasar por `App`. | Al ajustar la detección de cambio de minuto o de medianoche local. |
| `src/habits/HabitsLayer.tsx` | Capa interactiva sobre la hoja de Hábitos (resumen diario, campana, botón Extender, filas de hábito, sección En pausa y carga diferida de modales). | Al modificar la interfaz diaria de la hoja de Hábitos. |
| `src/habits/HabitDialog.tsx` | Diálogo modal (carga diferida) para crear, editar, describir, programar días/hora, pausar o eliminar un hábito. | Al cambiar el formulario o validaciones de configuración de un hábito. |
| `src/habits/HabitInfo.tsx` | Componentes `DescriptionText`, `InfoIcon` y `HabitInfoPopover` para mostrar Propósito / Versión mínima / Versión completa. | Al modificar cómo se formatea o posiciona el popover de descripción de un hábito. |
| `src/habits/MonthView.tsx` | Modal "Extender" (carga diferida) con cuadrícula mensual editable, totales diarios, estadísticas por hábito y salto a cualquier día. | Al ajustar la vista de calendario mensual de hábitos. |
| `src/habits/reminders.ts` | Motor planificador de recordatorios (popup en app, `Notification` en segundo plano, deduplicación por `localStorage` + Web Locks y snooze). | Al modificar el disparo, posposición ("Luego") o deduplicación de recordatorios. |
| `src/habits/ReminderHost.tsx` | Componente anfitrión global que arranca el motor de recordatorios y renderiza el popup "Recuerda tu hábito" sin solaparse con `TimeUpDialog`. | Al cambiar la UI del popup de recordatorio o sus controles rápidos (Hecho / Luego / ×). |
| `src/habits/TabBadge.tsx` | Componente aislado que muestra en la pestaña "Hábitos" la insignia con el conteo de hábitos pendientes cuya hora ya pasó. | Al cambiar el criterio visual o de accesibilidad de la insignia de la pestaña. |
| `src/habits/Habits.css` | Estilos completos de `HabitsLayer`, diálogo de ajustes, vista mensual `MonthView`, popup de recordatorios y popovers de descripción. | Al ajustar cualquier estilo visual del módulo de Hábitos. |

---

## Código Fuente — Barra de Herramientas (`src/tools/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `src/tools/Toolbar.tsx` | Barra vertical propia que controla Excalidraw (deshacer/rehacer, modo celdas, mover, 4 lápices, borrador, selección, copiar/pegar y modo lápiz). | Al añadir herramientas, cambiar atajos o modificar el panel de configuración de lápices. |
| `src/tools/Toolbar.css` | Estilos de la barra flotante izquierda y del panel lateral de color/grosor/opacidad. | Al ajustar el diseño o espaciado de la barra de herramientas. |
| `src/tools/toolPresets.ts` | Configuración por defecto de los 4 lápices y persistencia en `localStorage` (siempre abre en herramienta "hand"). | Al cambiar los presets iniciales de color/grosor/opacidad o cómo se guardan las preferencias. |

---

## Pruebas (`tests/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `tests/timerCore.test.ts` | Pruebas unitarias con `node:test` para `parseEsp`, formato de tiempo, estados, parches de celdas, descansos y cronómetro libre. | Al modificar `src/timer/timerCore.ts` y verificar con `npm test`. |
| `tests/habitCore.test.ts` | Pruebas unitarias con `node:test` para calendario, `resolveState`, `nextLog`, rachas, porcentajes, descripciones y recordatorios. | Al modificar `src/habits/habitCore.ts` y verificar con `npm test`. |
| `tests/sceneClipboard.test.ts` | Pruebas unitarias con `node:test` para selección de copia, archivos, cálculo de offset sin colisión e instanciación de elementos. | Al modificar `src/canvas/sceneClipboard.ts` y verificar con `npm test`. |

---

## Proyecto Nativo iOS / Capacitor (`ios/`)

| Ubicación | Descripción | Cuándo usarlo |
|---|---|---|
| `ios/.gitignore` | Reglas de exclusión de Git específicas del subproyecto Xcode/iOS. | Al añadir archivos temporales de Xcode que no deban subirse al repositorio. |
| `ios/debug.xcconfig` | Archivo de configuración Xcode que define `CAPACITOR_DEBUG = true`. | Al ajustar flags de compilación para builds de depuración en Xcode. |
| `ios/App/App/AppDelegate.swift` | Delegado principal de la aplicación iOS que gestiona el ciclo de vida y conecta `SceneDelegate`. | Al añadir inicialización nativa en iOS (p. ej. plugins o deep links a nivel de app). |
| `ios/App/App/SceneDelegate.swift` | Delegado de escena iOS que crea la ventana principal con `CAPBridgeViewController` de Capacitor. | Al modificar la gestión de ventanas o URLs en escenas de iOS/iPadOS. |
| `ios/App/App/Info.plist` | Manifiesto de la app iOS (nombre visible "Journal de Horas", orientaciones soportadas en iPhone/iPad y storyboards). | Al cambiar permisos de iOS, orientaciones permitidas o metadatos del bundle. |
| `ios/App/App/config.xml` | Configuración base de Cordova/Capacitor para el contenedor web iOS (`<access origin="*" />`). | Solo si se requieren ajustes de compatibilidad Cordova dentro de Capacitor. |
| `ios/App/App/capacitor.config.json` | Copia JSON generada por `cap sync ios` a partir de `capacitor.config.ts` (ignorada en Git). | Regenerado automáticamente con `npm run cap:sync`; no editar a mano. |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | Storyboard nativo de pantalla de carga inicial en iOS. | Al personalizar la pantalla de arranque nativa en Xcode. |
| `ios/App/App/Base.lproj/Main.storyboard` | Storyboard principal del contenedor de la aplicación iOS. | Al modificar la estructura de vistas nativas iniciales en Xcode. |
| `ios/App/App/Assets.xcassets/Contents.json` | Metadatos raíz del catálogo de recursos gráficos de Xcode. | Gestionado por Xcode al organizar assets. |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` | Definición del conjunto de iconos de la app iOS. | Al reemplazar o añadir tamaños de icono en Xcode. |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | Imagen del icono de la app (1024×1024, símbolo azul diagonal sobre cuadrícula) usada por iOS. | Al sustituir el icono de la app (p. ej. mediante `@capacitor/assets`). |
| `ios/App/App/Assets.xcassets/Splash.imageset/Contents.json` | Definición del conjunto de imágenes de splash screen en iOS. | Al actualizar los recursos de pantalla de bienvenida. |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` | Imagen de splash screen (2732×2732, fondo blanco con logo azul centrado) escala 1x. | Al regenerar las pantallas de carga para iPad/iPhone. |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png` | Variante de splash screen escala 2x en `Splash.imageset`. | Al regenerar las pantallas de carga para iPad/iPhone. |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png` | Variante de splash screen escala 3x en `Splash.imageset`. | Al regenerar las pantallas de carga para iPad/iPhone. |
| `ios/App/App/public/index.html` | Copia del `index.html` compilado sincronizada en el proyecto iOS por Capacitor. | Regenerado por `npm run cap:sync`; no editar directamente. |
| `ios/App/App/public/cordova.js` | Script puente de Cordova generado por Capacitor dentro de `public/`. | Regenerado automáticamente por Capacitor; no editar. |
| `ios/App/App/public/cordova_plugins.js` | Registro de plugins Cordova generado por Capacitor dentro de `public/`. | Regenerado automáticamente por Capacitor; no editar. |
| `ios/App/App.xcodeproj/project.pbxproj` | Archivo de proyecto de Xcode con targets, configuraciones de compilación y referencias de archivos. | Al abrir o modificar el proyecto en Xcode (`npm run cap:open`). |
| `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` | Metadatos de estado de Xcode para evitar comprobaciones repetidas del workspace. | Archivo interno gestionado por Xcode. |
| `ios/App/CapApp-SPM/.gitignore` | Exclusiones Git para el paquete Swift Package Manager generado por Capacitor. | Solo si cambian artefactos generados de SPM. |
| `ios/App/CapApp-SPM/Package.swift` | Manifiesto Swift Package Manager que enlaza Capacitor 8.5.1 y los plugins `@capacitor/app`, `keyboard` y `status-bar`. | Gestionado automáticamente por `cap sync ios` al instalar o quitar plugins nativos. |
| `ios/App/CapApp-SPM/README.md` | Notas por defecto del paquete Swift `CapApp-SPM`. | Referencia informativa del paquete generado por Capacitor. |
| `ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift` | Archivo fuente Swift marcador del paquete `CapApp-SPM`. | Gestionado por Capacitor SPM; no requiere edición manual. |
| `ios/capacitor-cordova-ios-plugins/CordovaPluginsResources.podspec` | Especificación CocoaPods vacía para recursos de plugins Cordova en Capacitor. | Gestionado por Capacitor; ignorado en Git. |
| `ios/capacitor-cordova-ios-plugins/resources/.gitkeep` | Archivo marcador para mantener la carpeta de recursos de plugins Cordova. | Marcador de carpeta; no editar. |
| `ios/capacitor-cordova-ios-plugins/sources/.gitkeep` | Archivo marcador para mantener la carpeta de fuentes de plugins Cordova. | Marcador de carpeta; no editar. |
