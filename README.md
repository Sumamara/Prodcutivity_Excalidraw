# Journal de Horas

App de objetivos medidos en horas construida sobre el motor de Excalidraw.
Tinta en tablet, teclado en web, iconos fijos con instrucciones.

Plan de arquitectura completo: <https://claude.ai/code/artifact/55098a79-0f9e-4d45-be46-f914c22ae6ae>

## Estado: Fase 1 (en curso) — secciones con plantilla + tinta

- [x] Vite + React + TypeScript
- [x] Excalidraw a pantalla completa (`@excalidraw/excalidraw`, versión fijada `0.18.1`)
- [x] Plantilla "CONCENTRACIÓN" en SVG ([SheetTemplate.tsx](src/canvas/SheetTemplate.tsx)), 20 filas, columnas Esp/Real/Ti/Tf/⚡/Ag/Ac/Ev
- [x] Excalidraw transparente encima (`viewBackgroundColor: "transparent"`) para lápiz + texto
- [x] Hoja anclada al viewport: zoom y desplazamiento mueven hoja y tinta juntas (transform imperativo, sin re-render)
- [x] Hoja centrada al arrancar
- [x] Autoguardado en `localStorage` con debounce de 800 ms (`serializeAsJSON`)
- [x] Restauración de la escena al recargar
- [x] Significado de columnas documentado en `COLUMN_MEANINGS`. **Esp y Real van en minutos**; Ti/Tf en `HH:MM` (24 h)
- [x] Explicaciones **en la propia hoja**: tocar una cabecera/etiqueta abre un popover con su definición. Zonas transparentes ancladas al mismo transform que la hoja; popover por portal a `<body>`; cierra con Esc, click fuera o al mover/zoomear
- [x] **Pestañas de sección** (Concentración · Time blocking · Menú del día): Excalidraw vive dentro de un marco (`.page-frame`), cada sección tiene su plantilla, sus hotspots y su **escena propia** en `localStorage`; la hoja se encaja y centra en el marco al entrar; la pestaña activa se recuerda

- [x] **Temporizador por fila** (Concentración): en modo celdas, al tocar la celda **Esp** de una fila (con valor válido) aparece ▶ a su izquierda (si no la tocas, está oculto). Al pulsarlo arranca una cuenta atrás con esos minutos, rellena Ti, y al terminar (■) rellena Tf y Real. Al llegar a 0, o al pulsar ■, sale un aviso verde "Tiempo finalizado · ¡Muy bien!" (Replantear / Descansar 15–20 % del tiempo trabajado); al llegar a 0 el timer sigue en negativo (amarillo apagado). Un solo timer activo, funciona en cualquier fecha. Sin timer, el contador de la cabecera queda en `00:00` con ▶: inicia un **cronómetro libre** (cuenta hacia arriba) y al detenerlo sale el mismo aviso con el tiempo de descanso sugerido. Esp acepta `90`, `1.5` (horas), `2h`, `1h30`, `1:30`, `90m` y lo convierte a minutos al salir de la celda. Diseño completo en [Implementacion Timer.md](Implementacion%20Timer.md)

- [x] **Pestaña Hábitos (por día, vertical)**: una hoja por día que sigue la fecha global. Cada hábito tiene nombre, hora recomendada ("Pendiente" si ya pasó), días de la semana, botón del día (un toque cicla ✓ → ~ → ✗ → vacío; en días pasados ✓ → ~ → ✗ → ✓), **racha**, **récord** y engrane ⚙ (editar, pausar, eliminar). Lo no marcado al terminar el día queda como **✗** (igual que la marcada, editable). ~ vale 0,25 en el porcentaje y no rompe la racha. **Extender** abre la vista del mes (fechas automáticas, editable; los hábitos en pausa al final). **Recordatorios**: popup a la hora del hábito (con la app abierta) + notificación del navegador si la pestaña está en segundo plano; interruptor general (campana) y por hábito. Hasta 12 hábitos activos. Franja de notas a mano. Diseño en [Implementacion Habitos.md](Implementacion%20Habitos.md)

### Siguiente

- Panel de objetivos + registro de horas (`time_entries`), enlazado a las filas Esp/Real
- Nitidez del SVG a zoom alto: escalar vía `width/height` del SVG en vez de `scale()` CSS
- Afinar las plantillas de Time blocking y Menú del día con feedback de uso real
- (Aplazado) Supabase: auth, `pages` por sección con `scene_json` + `updated_at`, Storage de imágenes

## Estructura

```
src/
  canvas/
    Canvas.tsx         # <Excalidraw> transparente por sección, ancla + encaja la hoja
    SheetTemplate.tsx  # plantilla "CONCENTRACIÓN" + COLUMN_MEANINGS + HOTSPOTS
    SheetHotspots.tsx  # zonas transparentes sobre la hoja + popover (recibe hotspots por prop)
    CellFields.tsx     # un <input> por celda de la tabla; interactivo salvo con lápiz/borrador activo
    hotspot.ts         # tipo Hotspot
    db.ts              # IndexedDB (Dexie): filas por "<fecha>::<sección>"
    persistence.ts     # saveScene/loadScene + loadCells/saveCells (async, por fecha+sección)
  canvas/cellsStore.ts # ÚNICO escritor de celdas (por parches, transaccional, multi-pestaña)
  canvas/sceneClipboard.ts # portapapeles propio de la tinta (botones Copiar/Pegar de la barra; sobrevive al cambio de día)
  timer/
    timerCore.ts       # puro: parseEsp, formato, máquina de estados (probado con `npm test`)
    timerStore.ts      # timer activo (fuera de React), persistencia y escritura de Ti/Tf/Real
    clock.ts           # reloj único de 1 s compartido (useNow)
    timerAudio.ts      # tono suave de fin con Web Audio (agenda, no depende de setTimeout)
    TimerChip.tsx      # contador de la cabecera (a la izquierda de la fecha)
    RowPlayLayer.tsx   # ▶ del margen (solo fila Esp tocada) + resaltado gris de la fila activa
    TimeUpDialog.tsx   # aviso "Tiempo finalizado" al llegar a 0
  habits/
    habitCore.ts       # PURO: calendario, estado del día, ✗ de días pasados, rachas, %, recordatorios (`npm test`)
    habitsStore.ts     # hábitos + marcas en memoria, optimista, Dexie, multi-pestaña
    HabitsLayer.tsx    # filas sobre la hoja (botón del día, racha, récord, engrane, "Pendiente")
    HabitDialog.tsx    # engrane: crear/editar/pausar/eliminar (carga diferida)
    MonthView.tsx      # "Extender": vista del mes editable (carga diferida)
    reminders.ts       # planificador de recordatorios (popup + Notification, sin duplicados)
    ReminderHost.tsx   # popup "Recuerda tu hábito"
    TabBadge.tsx       # insignia de pendientes en la pestaña
    minute.ts          # reloj de 1 minuto
  dates.ts             # todayISO / shiftISO / formatHuman (ISO local YYYY-MM-DD)
  DateBar.tsx          # selector de fecha global en la barra de pestañas
    types.ts           # tipos derivados de las props del componente
  sections/
    registry.ts             # SECTIONS: id, label, Template, hotspots
    TimeBlockingTemplate.tsx # rejilla horaria 06:00–22:00 (30 min)
    MenuDiaTemplate.tsx      # "carta" del día: Entrada / Principal / Guarnición / Postre
    HabitosTemplate.tsx      # hoja vertical de hábitos del día (rejilla + geometría `HB`)
  App.tsx              # pestañas + .page-frame (sheet-layer + Canvas + hotspot-layer)
  main.tsx
```

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173 (o 5174)
npm run build      # typecheck + build de producción
npm run preview    # sirve el build
npm run typecheck
npm test           # pruebas del núcleo del temporizador (node:test, sin dependencias)
```

## Deploy web (GitHub Pages)

`.github/workflows/pages.yml` compila y publica en cada push a `main`.

**Activarlo una vez:** GitHub → repo → *Settings* → *Pages* → *Build and
deployment* → *Source* = **GitHub Actions**.

- El workflow pasa `BASE_PATH=/<repo>/` al build (Vite `base`), así los assets
  resuelven bajo el subpath de Pages.
- URL final: `https://<usuario>.github.io/<repo>/`.
- La pestaña *Actions* → *Deploy web (GitHub Pages)* muestra el estado y el link.
- Local sigue en `/` (sin `BASE_PATH`); `npm run preview` para probar el build.

## App para iPad (Capacitor) — EN PAUSA

El proyecto `ios/` ya está generado (Capacitor 8, Swift Package Manager, sin
CocoaPods). Se versiona entero; solo `ios/App/build`, `Pods` y `public` se
ignoran. El workflow `ios.yml` quedó en **solo manual** (no corre en push).

### Ruta elegida: build en la nube + sideload (sin Mac, solo tu iPad)

1. **Sube el repo a GitHub** (`git init` ya hecho; falta commit + remoto + push).
2. **GitHub → Actions → "iOS IPA (sin firmar)" → Run workflow.**
   Compila en un runner macOS y sube `App-unsigned-ipa` como artefacto
   (`.github/workflows/ios.yml`).
3. Descarga el `.ipa` (en el PC o directo en el iPad).
4. **Instálalo en el iPad desde Windows** con **SideStore** (recomendado) o
   **AltStore** — firman con tu Apple ID gratis al instalar.
   Límites de la cuenta gratis: la app **caduca a los 7 días** (SideStore la
   refresca por Wi-Fi), máx. 3 apps sideloadeadas. No usamos push ni
   entitlements especiales, así que no molesta.

### Con un Mac (alternativa)

```bash
npm run cap:sync   # build + copia el web a ios/
npm run cap:open    # abre el proyecto en Xcode
```

Xcode → target **App** → *Signing & Capabilities* → tu *Team* → elegir iPad → Run.

### Recarga en vivo en el iPad (mismo Wi-Fi, sin rebuild)

1. `npm run dev -- --host` y anota la IP LAN.
2. En `capacitor.config.ts` descomenta `server: { url: "http://TU_IP:5174", cleartext: true }`.
3. Re-instala la app. Cada guardado se ve en el iPad. Comenta `server` antes de
   una build para distribuir.

### Pendiente para iPad

- Iconos y *splash* (`@capacitor/assets` desde un PNG 1024×1024).
- Auto-hospedar la fuente Jost (hoy Google Fonts; offline usa la del sistema).
- Probar en hardware: latencia del Pencil, rechazo de palma, teclado en pantalla.

## Notas de arquitectura

- **Versión de Excalidraw fijada sin `^`.** Su `appState` tiene campos sin
  documentar; un upgrade accidental puede romper escenas guardadas.
- Los tipos se derivan de `ComponentProps<typeof Excalidraw>` en vez de
  importarse de subrutas internas, que cambian entre versiones.
- Barra de herramientas propia ([src/tools/](src/tools/)); la de Excalidraw se
  oculta por CSS. La API se expone vía `onApiReady`.
- **Copiar / Pegar en la barra** (pensado para el iPad, donde el menú de mantener pulsado
  de Excalidraw reemplaza la selección por un solo trazo): *Copiar* guarda la selección
  fuera del lienzo (memoria + `localStorage`); *Pegar* la inserta en el día actual en las
  **mismas coordenadas** (o desplazada 24 px si ya hay una copia idéntica), con ids nuevos
  y como un solo paso de Deshacer. Lógica pura en `sceneClipboard.ts`.
- Encaje de la hoja: constantes en [src/canvas/fitConfig.ts](src/canvas/fitConfig.ts);
  ese módulo fuerza recarga de página al editarlo (`import.meta.hot`).
