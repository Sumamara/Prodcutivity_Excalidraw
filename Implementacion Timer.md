# Implementación: Temporizador de tareas (hoja Concentración)

Hoja de ruta para añadir un temporizador que nace del tiempo estimado (**Esp**) de cada fila y rellena solo **Ti / Tf / Real**.

> **Estado: implementado (fases 0–4).** Comprobado con `npm test` (28 pruebas del núcleo) y con pruebas de humo en Chrome real (arranque, pausa, tiempo extra, recarga, terminar, arranque accidental, otro día, normalización de Esp al escribir, ▶ oculto hasta tocar Esp y aviso de fin de tiempo).
>
> **Desviaciones respecto al plan original:**
> - **Pruebas con `node:test`** (incluido en Node) en vez de Vitest: sin dependencias nuevas. Están en `tests/` y se ejecutan con `npm test`.
> - Tabla `timers` con clave `"key"` (fila única `"active"`) porque `ActiveTimer.id` es un uuid; `ActiveTimer` incluye además `cols` (las columnas de la hoja) para poder terminar desde cualquier pestaña.
> - `cellsStore` también avisa por `BroadcastChannel("journal-cells")` para que varias pestañas vean los cambios de celdas.
> - Multi-pestaña del temporizador ya incluido (`BroadcastChannel("journal-timer")` + `owner`): la última pestaña que carga adopta el tono.
> - `persistence.ts` ya no tiene `loadCells/saveCells`; todo pasa por `cellsStore`.
>
> **Ajustes posteriores (v2), ya aplicados y vigentes sobre el texto de abajo:**
> 1. El **▶ está oculto en todas las filas** y solo sale en la fila cuya celda **Esp se acaba de tocar** (modo celdas) y solo si su Esp es válido. Tocar otra celda, salir del modo celdas o cambiar de hoja lo oculta. Con un timer activo no se selecciona ninguna fila.
> 2. **Sin −5/+5** y **sin nombre del objetivo en el contador**: solo `Fila N · mm:ss · ⏸ · ■`.
> 3. **Sin barra de progreso**: la fila activa queda resaltada en **gris fijo**.
> 4. Con el timer activo, el **⏸/▶ de la fila** (a la izquierda de Esp) se ve siempre.
> 5. Al llegar a 0 sale el aviso **"Tiempo finalizado"** (§3.7).
> 7. **Aviso también al pulsar ■ (v4)** en un timer de fila, con una pequeña motivación (§3.7).
> 6. **Cronómetro libre (v3)**: sin timer activo, el contador de la cabecera **sigue visible en `00:00` con ▶** (§3.8).

---

## 1. Objetivo y alcance

- Pulsas ▶ en una fila con **Esp** válido → arranca una cuenta atrás con esa duración.
- Al terminar (■) se rellenan **Tf** y **Real**; **Ti** se rellena al arrancar.
- Al pasar el tiempo estimado **no se detiene**: cuenta en negativo con un color suave (amarillo apagado), nada alarmante.
- Un solo temporizador a la vez. Funciona en cualquier fecha. Pensado para **navegador / web app**.
- **Sin mensajes ni diálogos** en ningún paso (solo sonido suave y estados visuales).

Fuera de alcance de esta entrega: notificaciones del sistema, Wake Lock, estadísticas en pantalla, integración con Time Blocking, app iPad (Capacitor). Ver §10.

---

## 2. Decisiones cerradas

| # | Decisión |
|---|---|
| 1 | **Esp y Real en minutos.** Si escribes horas, se convierten a minutos. |
| 2 | ▶ **inicia directo**, sin confirmación ni mensajes. |
| 3 | El contador va **a la izquierda de la fecha** (primer elemento de `.app-tabs-right`, antes de la P y de la fecha). |
| 4 | Tiempo extra: **cuenta en negativo**, color amarillo/gris apagado. |
| 5 | Se rellenan **Ti, Tf y Real**. Ti/Tf en **24 h `HH:MM`**; Real en minutos. |
| 6 | **Un solo temporizador** activo. Mientras exista uno (corriendo, en pausa o en tiempo extra) **se ocultan los ▶ de las demás filas**. |
| 7 | Funciona en **cualquier fecha**. Queda atado a la hoja donde se inició (fecha + sección + fila), no al día actual. |
| 8 | Uso principal en **navegador / web app**. |
| 9 | El ▶ va en el **margen izquierdo de la hoja** (x 0–30, hoy libre). |
| 10 | Al terminar **no se marca ✓** automáticamente en la casilla. |
| 11 | Reejecutar una fila **sobrescribe** Ti, Tf y Real (gana la última ejecución). |

Decisiones por defecto que asumo (se pueden cambiar):
- Al **arrancar**, además de escribir Ti se **vacían Tf y Real** de esa fila (la fila queda "en curso"). Si paras en los primeros 10 s (arranque accidental), se **restauran** los valores anteriores.

---

## 3. Comportamiento (especificación funcional)

### 3.1 Esp: entrada y conversión

Se normaliza **solo al salir de la celda** (blur / Enter), nunca mientras escribes.

| Escribes | Se guarda (minutos) |
|---|---|
| `45`, `90` (entero suelto) | 45, 90 |
| `1.5`, `1,5` (decimal suelto) | 90 |
| `0.5` | 30 |
| `2h`, `1.5h` | 120, 90 |
| `1h30`, `1h 30m`, `1h30m` | 90 |
| `1:30`, `0:45` | 90, 45 |
| `90m`, `90 min` | 90 |
| vacío, texto, `0`, negativos, `1:75`, más de 1440 | **inválido** (se deja lo escrito y no aparece ▶) |

Reglas: entero suelto = minutos; decimal suelto = horas (un minuto fraccionario no tiene sentido como duración de tarea); mínimo 1 min, máximo 1440 (24 h); se redondea al minuto.

La celda se reescribe con el valor normalizado (`1h30` → `90`) para que veas la conversión.

### 3.2 Estados del temporizador

```
             ▶                 ⏸               ▶ (reanudar)
 (sin timer) ───► running ───────────► paused ───────────► running
                    │  ▲                                     │
                    │
                    │
                    │ elapsed > planned  → "tiempo extra" (estado derivado, sigue running/paused)
                    ▼
                   ■ Terminar  → escribe Tf/Real, guarda sesión, borra el timer activo
```

- **Tiempo extra no es un estado guardado**: se deriva (`elapsed > planned`).
- **Arranque accidental**: ■ con `elapsed < 10 s` → descarta la sesión y restaura los valores previos de Ti/Tf/Real. Sin mensajes.
- Reloj de pared: si dejas el timer corriendo con la pestaña cerrada, el tiempo sigue contando. Si Real sale exagerado, se corrige a mano (es una celda).

### 3.3 Qué escribe en la hoja

| Momento | Ti | Tf | Real |
|---|---|---|---|
| ▶ (arranque) | hora actual `HH:MM` | se vacía | se vacía |
| ■ (terminar, ≥ 10 s) | (se mantiene) | hora actual `HH:MM` | `max(1, round(activo/60000))` minutos |
| ■ (descartar, < 10 s) | valor previo | valor previo | valor previo |

`activo` = tiempo efectivo sin pausas.

### 3.4 Contador en la cabecera (chip)

- **Siempre visible.** Sin timer activo muestra `Cronómetro 00:00 ▶` (§3.8); con timer de fila, el contador descrito abajo.
- Contenido: `Fila N · mm:ss · ⏸ · ■`. En pantallas estrechas (< ~900 px) se oculta la etiqueta (`Fila N`).
- **No** muestra el nombre del objetivo (solo el número de fila); el nombre aparece en el aviso de fin de tiempo.
- Si la hoja visible **no** es la del timer, el chip muestra la fecha (`↩ 12 sep`). Clic en etiqueta/tiempo → cambia a esa fecha y sección.
- Formato: `mm:ss` (< 1 h) o `h:mm:ss`. Cuenta atrás con `ceil` de segundos; en tiempo extra se antepone `−` (U+2212) y se usa `floor`.
- Colores (todos suaves):

| Estado | Fondo | Texto |
|---|---|---|
| Corriendo | `#1e2a3a` | `#ffffff` |
| Pausado | `#8b93a1` | `#ffffff` |
| Tiempo extra | `#f3e6b3` (borde `#e0cf8f`) | `#5b4b12` |

- Sin parpadeo ni animaciones agresivas; transición de color de ~0.4 s.
- Accesibilidad: `role="timer"` con `aria-live="off"`; una región `aria-live="polite"` oculta anuncia solo una vez "tiempo cumplido, en tiempo extra". Botones con `aria-label`.

### 3.5 ▶ en el margen izquierdo

- **Oculto por defecto en todas las filas.** Sale solo en la fila cuya celda **Esp** se tocó (modo celdas) y solo si su Esp es válido (se evalúa en vivo, también mientras escribes).
- Tocar otra celda (o un punto sin celda), salir del modo celdas, cambiar de hoja/fecha o pulsar ▶ lo oculta.
- Si el timer activo es de **esta hoja y esta fila**: el botón pasa a ser ⏸/▶ (mismo efecto que el chip) y se ve **siempre**; la fila queda resaltada con un **gris fijo** (sin barra que avance, `mix-blend-mode: multiply` para no tapar la tinta).
- Si el timer activo es de **otra fila u otra hoja/fecha**: no se pinta ningún ▶ en esta hoja y tocar Esp no selecciona nada.
- Zona táctil = todo el margen (30 × alto de fila, en unidades de hoja). Icono ▶ ~14 unidades, centrado en x = 15.

### 3.6 Sonido y título

- Al cruzar 0: **un solo tono suave** (dos notas sinusoidales, ~523 Hz → 659 Hz, ~0,25 s cada una, volumen bajo). Sin repetición.
- El AudioContext se desbloquea **en el propio clic de ▶** (es el gesto que exige el navegador).
- El tono se **programa con la agenda de Web Audio** (`start(when)`) al iniciar/reanudar/ajustar, y se cancela al pausar/terminar. Así no depende de los timers de JavaScript, que el navegador limita en pestañas ocultas.
- Título de la pestaña: `−05:12 · Fila 3` mientras hay timer; se restaura a `Journal de Horas` al terminar.

### 3.8 Cronómetro libre (v3)

- Sin timer activo, el contador de la cabecera queda en **`00:00`** con un ▶ discreto (gris, como los botones de fecha). Pulsarlo inicia un **cronómetro** que **cuenta hacia arriba** (`mm:ss` / `h:mm:ss`), sin fila, sin Esp y sin escribir nada en las celdas.
- Comparte el "**un solo timer activo**": mientras corre, no hay ▶ de fila. Tiene pausa/reanudar y detener; sobrevive a recargas y cambios de pestaña/fecha (el contador es global). El contador no navega a ninguna hoja.
- **Al detenerlo sale el mismo aviso "Tiempo finalizado"** con `del cronómetro · trabajaste N min` y las dos opciones (Replantear / Descansar 15–20 % del tiempo trabajado). No hay descarte por arranque accidental: siempre sale el aviso (menos de 1 min → `menos de 1 min` y descanso `1 minuto`).
- Cada cronómetro detenido se guarda en `sessions` con `kind: "free"`, `row: -1`, `sectionId: ""` (sin tocar las sesiones de fila).
- Implementación: `ActiveTimer.kind = "free"` (los datos antiguos sin `kind` cuentan como fila); el aviso vive ahora en el almacén (`openTimeUp/closeTimeUp/useTimeUp`) para poder salir DESPUÉS de detener el cronómetro. El reloj compartido avanza cada 250 ms (antes 1 s) para que el segundero no vaya casi 1 s por detrás.

### 3.7 Aviso "Tiempo finalizado"

- Sale en tres casos: (a) el timer de fila, **corriendo**, llega a 0 (una sola vez, y solo si se vio la cuenta atrás en esta sesión; si recargas ya en tiempo extra, no vuelve a salir); (b) al pulsar **■ en un timer de fila** (con ≥ 10 s de tiempo activo); (c) al detener el cronómetro libre. Un ■ en los primeros 10 s (arranque accidental) **no** abre el aviso.
- Si el aviso del cruce por 0 sigue abierto al pulsar ■, se sustituye por el nuevo (con el tiempo trabajado real): nunca hay dos avisos.
- Ventana centrada (mismo estilo que la matriz de emociones), cabecera amarillo apagado, con **×** (también Esc o clic fuera). **Cerrarlo NO detiene el timer**: sigue contando en tiempo extra.
- Contenido:
  - `Tiempo finalizado` (cabecera verde con check).
  - Motivación: **¡Muy bien!** + *Un bloque de enfoque más a tu favor.*
  - `de la tarea <nombre del objetivo> · trabajaste <N min>` (si el nombre está vacío: `Fila N`).
  - **1 · Replantear** — *¿Cómo se ve más fácil?*
  - **2 · Descansar** — *Puedes descansar de X a Y minutos*, con X = 15 % e Y = 20 % del tiempo transcurrido (redondeado, mínimo 1; si X = Y: `N minuto(s)`). Se calcula al llegar a 0 y queda fijo mientras está abierto.

---

## 4. Arquitectura

### 4.1 Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/timer/timerCore.ts` | **Puro, sin React ni DB.** Tipos, `parseEsp`, `formatRemaining`, `clockHHMM`, `restRangeMinutes`, transiciones (`start/pause/resume/finish`), selectores (`elapsedMs`, `remainingMs`, `isOvertime`). |
| `src/timer/timerStore.ts` | Tienda externa (`subscribe/getSnapshot`) con el timer activo. Hidrata desde Dexie, persiste cada transición, escribe en celdas, agenda el tono, emite por `BroadcastChannel`. |
| `src/timer/clock.ts` | Reloj único compartido, alineado al borde del segundo, activo solo si hay suscriptores. Hook `useNow()`. |
| `src/timer/timerAudio.ts` | `unlockAudio()`, `scheduleChime(atEpochMs)`, `cancelChime()`. |
| `src/timer/TimerChip.tsx` + `Timer.css` | Contador de la cabecera. |
| `src/timer/RowPlayLayer.tsx` | Capa de ▶ del margen (solo en la fila Esp tocada) + resaltado gris de la fila activa. |
| `src/timer/TimeUpDialog.tsx` | Aviso "Tiempo finalizado" (§3.7). |
| `src/canvas/cellsStore.ts` | **Único punto de escritura de celdas** por parches (§6.2). |
| `tests/timerCore.test.ts` | Pruebas unitarias (§8), con `node:test`. |

### 4.2 Archivos que se modifican

| Archivo | Cambio |
|---|---|
| `src/canvas/db.ts` | Versión 4 de Dexie: tablas `timers` y `sessions`. Función `patchCellsRow` (transacción). |
| `src/canvas/persistence.ts` | `saveCells` deja de usarse (o pasa a delegar en `cellsStore`); `loadCells` se mantiene para la carga inicial. |
| `src/canvas/CellFields.tsx` | Deja de guardar el mapa completo; usa `cellsStore` (leer + parchear). Normaliza Esp al confirmar. |
| `src/canvas/SheetTemplate.tsx` | Textos de Esp/Real/Ti/Tf en minutos (`COLUMN_MEANINGS`, `NARROW_COLS`, comentario de cabecera). |
| `src/sections/registry.ts` | Nuevo campo opcional `timer?: TimerColumns` en `Section`; se activa en `concentracion`. |
| `src/App.tsx` | Hidratar el timer al arrancar; montar `<TimerChip>` (primer hijo de `.app-tabs-right`) y la capa `RowPlayLayer` (nuevo ancla con el mismo `transform`); función `goToTimerSheet`. |
| `src/index.css` | Estilos de la capa `.play-layer` / `.play-anchor`. |
| `README.md` | Documentar temporizador y minutos. |
| `package.json` | Script `test` (`node --test`). |

`TimerColumns` (declarativo, igual que `supportsTemplate`):

```ts
interface TimerColumns { esp: string; ti: string; tf: string; real: string; label: string }
// concentracion: { esp: "esp", ti: "ti", tf: "tf", real: "real", label: "obj" }
```

Los ids de celda ya siguen el patrón `${columna}-${fila}` (p. ej. `esp-3`), así que fila = índice numérico del id. Las geometrías de fila salen de `CELLS` (celdas `esp-*`: `y` y `h`); **no hace falta exportar constantes nuevas** de `SheetTemplate`.

---

## 5. Modelo de datos

```ts
interface ActiveTimer {
  id: string;              // uuid
  date: string;            // fecha ISO de la hoja donde se inició
  sectionId: string;       // "concentracion"
  row: number;             // 0..19
  plannedMs: number;       // duración (sale de Esp al arrancar)
  status: "running" | "paused";
  startedAt: number;       // epoch ms del tramo en marcha actual (válido si running)
  accumulatedMs: number;   // tiempo activo de tramos anteriores
  firstStartedAt: number;  // epoch ms del primer arranque (para Ti e historial)
  prev: { ti?: string; tf?: string; real?: string }; // valores previos, para restaurar si se descarta
  cols: TimerColumns;      // columnas de la hoja (para terminar desde cualquier pestaña)
  label: string;           // Objetivo al iniciar (respaldo del chip)
  owner: string;           // id de la pestaña que programó el tono
  updatedAt: number;
}

interface SessionRow {     // solo se añaden filas, nunca se editan
  id: string; date: string; sectionId: string; row: number; label: string;
  plannedMs: number; activeMs: number; overtimeMs: number;
  startedAt: number; endedAt: number;
}
```

Fórmulas (todas con `now` inyectado, sin leer el reloj dentro):

```
elapsed   = accumulatedMs + (status === "running" ? now - startedAt : 0)
remaining = plannedMs - elapsed
overtime  = remaining < 0
```

**Dexie v4** (se conservan las tablas existentes; se añaden estas):

```
timers:   "key"                // una sola fila con key "active" → { key, timer: ActiveTimer }
sessions: "id, date, endedAt"
```

---

## 6. Diseño por módulo

### 6.1 `timerCore.ts`

- `parseEsp(input: string): number | null` → minutos enteros o `null` (tabla de §3.1).
- `normalizeEsp(input): string | null` → `String(parseEsp(input))` o `null`.
- `formatDuration(ms, {overtime})`, `clockHHMM(epochMs)` (calculado a mano con `getHours/getMinutes`; **no** `toLocaleTimeString`, que varía entre 12 h y 24 h).
- Transiciones puras que reciben y devuelven `ActiveTimer`; `finish` devuelve `{ session, cellsPatch }` o `{ discard: true, cellsPatch }` (umbral `ACCIDENTAL_MS = 10_000`).
- `restRangeMinutes(workedMs)`: `lo = max(1, round(15 %))`, `hi = max(lo, round(20 %))` (minutos).

### 6.2 `cellsStore.ts` (la parte con más refactor)

**Problema actual:** `CellFields` solo existe montado para la hoja visible y guarda el **mapa completo** (`saveCells(date, section, valuesRef.current)`). Si el timer escribiera directo en la base, el siguiente guardado de `CellFields` lo pisaría; y si la hoja no está montada, no hay a quién escribir.

**Solución:** un almacén fuera de React con un único escritor.

- Clave `${fecha}::${sección}`; caché en memoria + suscriptores.
- `peekCells(date, section)` (sincrónico, si ya está cargado), `loadCellsInto(date, section)` (asíncrono), hook `useCellValues(date, section)` (`useSyncExternalStore`; devuelve `null` hasta cargar).
- `patchCells(date, section, patch, { immediate })`: aplica el parche a la caché, notifica y encola la escritura. `null` en un valor = borrar la celda.
- Escritura a Dexie **por parche, en transacción** (leer fila → fusionar → `put`), en una cola serializada por clave. Los parches del temporizador van con `immediate: true`; los de teclado, con el mismo debounce de 500 ms de hoy (y `flush` al salir de la celda).
- Mantiene `markPending / markSaved / markError` del indicador de guardado.

**Cambios en `CellFields`:**
- Sustituir `values` + `valuesRef` + `flush` por `useCellValues`.
- `syncEditor` (Scribble/teclado del iPad, sondeo a 600 ms) se conserva, pero llama a `patchCells` con el valor **crudo**.
- Al confirmar (blur / Enter): aplicar normalizador por columna (`{ esp: normalizeEsp }`) y parchear con el valor normalizado.
- Se eliminan `loadedRef` y el guardado del mapa entero al desmontar (ya no hacen falta).
- Si el timer parchea la celda que estás editando, gana lo que escribes al confirmar (caso raro, aceptable).

### 6.3 `timerStore.ts` y `clock.ts`

- El estado vive **fuera de React**; las acciones cambian la memoria de forma **síncrona** y persisten después (así dos clics rápidos no arrancan dos timers).
- `hydrate()` al arrancar `App`: lee `timers.get("active")`; si estaba corriendo, sigue por reloj de pared. Si el AudioContext está bloqueado, el tono se reprograma en el primer gesto del usuario.
- `clock.ts`: `setTimeout` alineado a `1000 - (Date.now() % 1000)`; solo activo con suscriptores; recalcula al instante en `visibilitychange`. El snapshot de `useNow()` es el segundo entero, de modo que cada suscriptor se re-renderiza **una vez por segundo**.
- **Regla crítica:** el tick nunca pasa por el estado de `App` (hoy se evita renderizar por fotograma para no molestar a Excalidraw). Solo `TimerChip` y `TimeUpDialog` usan `useNow()`.
- Multi-pestaña (fase 4): `BroadcastChannel("journal-timer")`; al recibir un mensaje, la pestaña relee Dexie. Solo la pestaña `owner` programa el tono.

### 6.4 `timerAudio.ts`

`unlockAudio()` (síncrona, dentro del clic) crea/reanuda el `AudioContext`. `scheduleChime(at)` calcula el retardo y agenda osciladores con envolvente suave; guarda los nodos para `cancelChime()`. Si el contexto no está en `running`, no hace nada (el estado visual de tiempo extra ya avisa).

### 6.5 `TimerChip`

Suscrito a `timerStore` (transiciones) y a `useNow()` (tick). Recibe por props `viewedDate`, `viewedSectionId` y `onGoTo`. Actualiza `document.title` en un efecto. Ancho mínimo fijo y `font-variant-numeric: tabular-nums` para que los dígitos no bailen.

### 6.6 `RowPlayLayer`

- Capa `.play-layer` (z-index 3, `pointer-events: none`) con un ancla `.play-anchor` del tamaño de la hoja y **el mismo `transform` que las otras capas** (se añade `playAnchorRef` a `handleViewport` en `App.tsx`).
- Los botones tienen `pointer-events: auto` y `onPointerDown={e => e.stopPropagation()}`, como los hotspots.
- Lee Esp con `useCellValues` para saber qué filas muestran ▶.
- `RowHighlight` es un `div` estático (no usa el reloj), así que los botones no se re-renderizan cada segundo.
- Recibe `selectedRow` (lo fija `App` desde `CellFields.onSelect` al tocar una celda Esp) y `onStarted` (deselecciona al pulsar ▶).
- Solo se monta si `active.timer` y `active.cells`.

### 6.7 `App.tsx`, registro y textos

- `useEffect(() => { void hydrateTimer(); }, [])`.
- `goToTimerSheet(t)`: `setDate(t.date)` + `switchSection(t.sectionId)`. Al cambiar de sección se sale del modo plantilla (ya ocurre).
- Textos de `SheetTemplate.tsx`:
  - `COLUMN_MEANINGS`: `Esp: "Minutos esperados"`, `Real: "Minutos reales"`.
  - Esp: *"Minutos que calculas que te llevará el objetivo, antes de empezar. Acepta 90, 1.5 (horas), 1h30 o 1:30 y lo convierte a minutos. Toca la celda Esp de una fila con un valor válido para que aparezca ▶ a su izquierda."*
  - Real: *"Minutos que te llevó de verdad (lo rellena el temporizador; puedes corregirlo). Compáralo con Esp para calibrar tus estimaciones."*
  - Ti/Tf: *"…(HH:MM; lo rellena el temporizador)."*

---

## 7. Fases de implementación

Un commit por fase.

**Fase 0 — Minutos y normalización (sin temporizador)** ✅
- `parseEsp`/`normalizeEsp` + pruebas.
- Normalizar al confirmar en `CellFields`.
- Textos en minutos (`SheetTemplate.tsx`, README).
- *Hecho cuando:* escribir `1h30` deja `90`; `1,5` deja `90`; un valor inválido se queda tal cual.

**Fase 1 — `cellsStore` (refactor sin cambio visible)** ✅
- Crear el almacén y migrar `CellFields` a parches.
- *Hecho cuando:* escribir, salir de la celda, recargar y cambiar de fecha/pestaña conserva todo igual que antes; Scribble/teclado siguen guardando; no se pierde nada al cerrar la pestaña justo tras escribir.

**Fase 2 — Núcleo, tienda y datos** ✅
- `timerCore`, `timerStore`, Dexie v4, `hydrate`.
- *Hecho cuando:* pruebas unitarias en verde y, desde la consola, iniciar/pausar/terminar rellena Ti/Tf/Real y sobrevive a una recarga.

**Fase 3 — Interfaz** ✅
- `TimerChip`, `RowPlayLayer`, resaltado de fila, `TimeUpDialog`, sonido, título.
- *Hecho cuando:* se cumplen todos los puntos de §8.2.

**Fase 4 — Pulido** ✅ (multi-pestaña, README; **pendiente probar en Safari/Firefox**)
- Multi-pestaña (`BroadcastChannel` + `owner`), pruebas en Chrome/Safari/Firefox, ajuste de zonas táctiles, README.

---

## 8. Pruebas

### 8.1 Unitarias (`node:test`, solo `timerCore`)

- `parseEsp`: toda la tabla de §3.1 más límites (`0`, `1440`, `1441`, `1:59`, `1:60`).
- `elapsed/remaining` con pausas intermedias y `now` inyectado.
- `formatDuration`: `00:00`, `00:01`, `59:59`, `1:00:00`, negativo (`−00:01`), transición a 0.
- `finish`: `< 10 s` descarta y restaura; `≥ 10 s` calcula Real con mínimo 1.
- `restRangeMinutes`: 15–20 %, mínimo 1 y `hi >= lo`.

### 8.2 Manual

1. Sin tocar nada no hay ▶. En modo celdas, tocar Esp con `90` → ▶ solo en esa fila; Esp vacío o `abc` → sin ▶; tocar otra celda lo oculta.
2. ▶ → arranca sin mensajes; Ti = hora actual; Tf y Real vacíos; los demás ▶ desaparecen.
3. Pausar y reanudar; el tiempo no avanza en pausa.
4. El contador muestra `Fila N` (sin nombre) y no tiene −5/+5; la fila activa queda en gris fijo y su ⏸ siempre visible.
5. Cambiar de día y de pestaña con el timer activo: el chip sigue, muestra la fecha de origen y el clic vuelve a esa hoja.
6. Llegar a 0: un tono suave; el chip pasa a amarillo apagado y cuenta `−mm:ss`.
7. ■ en tiempo extra: Tf/Real correctos (Real > Esp).
8. ■ a los 5 s: se restauran los valores previos.
9. Recargar con el timer corriendo: se recupera y sigue contando.
10. Reejecutar una fila ya completada: sobrescribe Ti, Tf y Real.
11. Escribir en celdas mientras corre el timer: ninguna escritura se pierde.
12. Con el título de la pestaña visible en otra pestaña, se actualiza `−mm:ss · Fila N`.
13. Ancho de ventana 1024 y 768: la cabecera no desborda.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El refactor de `CellFields` rompe la entrada con Scribble o el guardado | Fase 1 aislada y verificada antes de añadir el timer; se conserva el sondeo de `syncEditor`. |
| Un `2` suelto se lee como 2 minutos aunque quisieras 2 horas | Escribe `2h`, o `120`. El contador muestra `02:00` desde el primer segundo, así que se nota; se puede terminar (≤ 10 s no guarda nada). |
| Esp antiguos (en horas) se malinterpretan | Solo afecta si pulsas ▶ en filas antiguas; se puede corregir Esp a mano. |
| Pestaña oculta larga: el navegador limita timers y el tono podría retrasarse | El tono va en la agenda de Web Audio; el número siempre es correcto al volver (se calcula con timestamps). Verificar en cada navegador. |
| Tras recargar, el navegador bloquea el audio hasta el primer gesto | Se reprograma el tono en la primera interacción; el estado visual de tiempo extra sigue avisando. |
| Zona táctil pequeña (fila ≈ 25 unidades × zoom) | Aceptable en navegador con ratón; si se usa táctil, escalar el botón para garantizar ≥ 28 px. |
| Dos pestañas abiertas: doble tono o estados distintos | `BroadcastChannel` + `owner` (fase 4). |
| Timer olvidado corriendo → Real enorme | Reloj de pared (predecible); Real es una celda editable. |
| Cabecera desborda en pantallas estrechas | Versión compacta del chip; verificar en 768 px. |
| Sin infraestructura de pruebas hoy | `node:test` (sin dependencias); solo se prueba lógica pura (sin DOM ni DB). |
| El ▶ (margen izquierdo) puede quedar 5–6 px bajo la barra de herramientas en pantallas estrechas (p. ej. iPad vertical) | Sigue siendo pulsable; si molesta, subir `FIT_PAD_LEFT` en `fitConfig.ts` a ~66. |

---

## 10. Fuera de alcance / ideas futuras

- Estadísticas "estimé X, tardé Y" a partir de `sessions` (los datos ya se guardan desde la fase 2).
- Notificaciones del sistema (opt-in) y Wake Lock opcional.
- Instalable como PWA (manifest + service worker) y `navigator.storage.persist()` para proteger IndexedDB.
- Flujo de descanso al terminar (enlace a *Descansos activos*, ya accesible desde el popover de energía).
- Integración con Time Blocking (resaltar el bloque en curso).
- Botón ▶ con escala compensada al zoom para uso táctil.
- Sincronización entre dispositivos (Fase 2 del README, Supabase): `sessions` ya es de solo-añadir, apta para sincronizar sin conflictos.
