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
- [x] Significado de columnas documentado en `COLUMN_MEANINGS` (Ti/Tf/Ag/Ac/Ev confirmados; Esp/Real por confirmar)
- [x] Explicaciones **en la propia hoja**: tocar una cabecera/etiqueta abre un popover con su definición. Zonas transparentes ancladas al mismo transform que la hoja; popover por portal a `<body>`; cierra con Esc, click fuera o al mover/zoomear
- [x] **Pestañas de sección** (Concentración · Time blocking · Menú del día): Excalidraw vive dentro de un marco (`.page-frame`), cada sección tiene su plantilla, sus hotspots y su **escena propia** en `localStorage`; la hoja se encaja y centra en el marco al entrar; la pestaña activa se recuerda

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
    hotspot.ts         # tipo Hotspot
    persistence.ts     # saveScene/loadScene por sección + sección activa (localStorage)
    types.ts           # tipos derivados de las props del componente
  sections/
    registry.ts             # SECTIONS: id, label, Template, hotspots
    TimeBlockingTemplate.tsx # rejilla horaria 06:00–22:00 (30 min)
    MenuDiaTemplate.tsx      # "carta" del día: Entrada / Principal / Guarnición / Postre
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
- Encaje de la hoja: constantes en [src/canvas/fitConfig.ts](src/canvas/fitConfig.ts);
  ese módulo fuerza recarga de página al editarlo (`import.meta.hot`).
