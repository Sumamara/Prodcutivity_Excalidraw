# Implementación: Hábitos por día (hoja vertical)

Rediseño de la pestaña **Hábitos**: de la cuadrícula manual de 31 columnas a una **hoja vertical por día** (como Time blocking), con racha, récord, hora recomendada, recordatorios y una vista de mes ("Extender").

> **Estado: IMPLEMENTADO (fases F0–F5).** Comprobado con `npm test` (72 pruebas, 39 de la lógica de hábitos) y con pruebas de humo en Chrome real: hoja del día (30 comprobaciones), recordatorios (17), más las del temporizador y el cronómetro (sin regresiones).
>
> **Desviaciones respecto al plan:**
> - Los `pausados` salen de la lista principal a una franja "En pausa" (como se acordó) y se reanudan desde ahí o desde el engrane. **Eliminar** borra el hábito y sus marcas (con confirmación en dos pasos); no hay "archivar" aparte.
> - Insignia de la pestaña: cuenta los hábitos con la hora ya pasada y sin marcar hoy.
> - Al pulsar la campana se pide el permiso de notificaciones (si el navegador lo permite); si se deniega, quedan los popups dentro de la app.
> - La campana general está **activada por defecto**; al poner una hora a un hábito (sin hora previa) se marca solo "Recordarme a esa hora" y al guardar se pide el permiso de notificaciones. Si se cambia la hora de un hábito que ya avisó hoy, el aviso se rearma (`effectiveFired`, registro `times` en el `fired` de `localStorage`).
> - La lógica de recordatorios usa un registro `fired` en `localStorage` **más** Web Locks (cuando existen) para no duplicar avisos entre pestañas.
> - Se retiró el código de checks/toque con Mover de la hoja manual anterior (ya sin uso). Los datos antiguos de esa hoja (`global::habitos`) **no se borran**: solo se importan los nombres una vez.
> - Sin probar: notificaciones reales del navegador (requieren permiso), Safari y Firefox.

Prioridades de diseño: **velocidad** (tocar = respuesta instantánea) y **funcionamiento correcto** (rachas, ✗ al cierre del día y recordatorios sin sorpresas), con lógica pura probada.

---

## 1. Requisitos (lo que pediste)

| # | Requisito |
|---|---|
| R1 | Vista **por día**: por hábito → nombre, casilla de **días seguidos**, casilla de **día máximo** (récord) y **engrane** para configurar. |
| R2 | Hoja **más vertical**, como Time blocking. |
| R3 | Una columna de **hoy / del día**, la **más fácil de rellenar** (un toque). |
| R4 | Cada hábito tiene **hora recomendada**; si ya pasó y no se hizo, dice **"Pendiente"**. |
| R5 | **Popup a una hora específica**: "Recuerda tu hábito" + nombre. Se puede **activar y desactivar**. |
| R6 | Estados por toque: ✓ cumplido, **~ a medias** (amarillo), ✗ no cumplido. |
| R7 | **~ cuenta 0,25** en porcentajes y **no rompe la racha**. |
| R8 | Al **final del día**, lo no evaluado pasa a **✗** (la misma ✗ que la marcada; se deriva, no se guarda). |
| R9 | **Pausar** un hábito. |
| R10 | **Fechas automáticas** (nada de escribir el número del día). |
| R11 | **Modo Hoy**: lo más sencillo de rellenar. |
| R12 | Botón **Extender** para ver el **mes**, y **flechas** para pasar de día. |
| R13 | Cada hábito tiene **frecuencia**. |

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Frecuencia | **Días de la semana** (L M X J V S D) por hábito. Los días que no tocan no cuentan ni generan ✗. |
| Recordatorio | **App abierta + notificación del navegador** (pide permiso). No funciona con el navegador cerrado; ver §9. |
| Hoja actual | **Se reemplaza.** Se importan una sola vez los nombres de hábito; los checks antiguos no se migran (no tienen fecha real). |
| Máximo | **12 hábitos** activos en la hoja diaria (filas amplias). |

## 3. Supuestos que asumo (corrígeme lo que no)

1. **Sigue la fecha global** de la barra: sus flechas ◀ ▶, el selector y "Hoy" cambian el día de esta hoja igual que en las demás pestañas. La hoja pasa a ser `dateScoped`. **Días futuros: solo lectura** (no se marcan por adelantado). **Días pasados: editables** (para corregir una ✗).
2. **Cierre del día = medianoche local.** Un día pasado sin marca se muestra como **✗**, idéntica a la que marcas tú (no hay una ✗ "automática" distinta). En un día pasado el ciclo al tocar es **✓ → ~ → ✗ → ✓** (vacío ya se ve como ✗, así que no hay un paso que parezca no hacer nada); hoy sigue siendo vacío → ✓ → ~ → ✗ → vacío.
3. **Racha** = días **consecutivos que tocaban** con ✓ o ~. ✗ (marcada o de un día pasado sin marca) la rompe. Los días que no tocan y los de pausa **no la rompen ni suman**. Hoy pendiente **no la rompe** (aún hay tiempo).
4. **Récord ("máx")** = la racha más larga de todo el historial del hábito.
5. **Porcentaje** = (✓ + 0,25 × ~) / días evaluados que tocaban. Hoy pendiente no cuenta como evaluado.
6. **Recordatorio a la hora recomendada** (una sola hora por hábito). Interruptor **general** (campana) y **por hábito**. Botones del popup: **Hecho ✓**, **Luego** (elige los minutos), **×**.
7. **Cambios de días de la semana o de hora** aplican **desde hoy hacia adelante**; nunca reescriben el pasado (el calendario de cada hábito se guarda por versiones con fecha).
8. **Pausar** saca el hábito de la lista principal a una franja **"En pausa"**, desde donde se reanuda. Los pausados no ocupan fila (no cuentan para los 12). **Eliminar** borra el hábito y sus registros (con confirmación).
9. **Orden**: por hora recomendada (los sin hora al final), luego por creación. Sin reordenar a mano en esta versión.
10. **Sigue existiendo tinta**: una escena de Excalidraw por día, con una franja "Notas" abajo para escribir a mano.
11. **Modo Hoy = la hoja del día abierta en hoy** (es la vista por defecto al entrar). No hay un modo aparte.
12. **Insignia en la pestaña**: `Hábitos · N` con los pendientes de hoy cuya hora ya pasó.

## 4. Experiencia (qué se ve)

### 4.1 Hoja del día (vertical, 800 × 1035)

```
HÁBITOS                                            ⛰
Hoy · 5 de 8 · 63 %                   🔔   [Extender]
┌──────────────────┬──────┬────────┬───────┬─────┬────┐
│ Hábito           │ Hora │  Hoy   │ Racha │ Máx │ ⚙  │
├──────────────────┼──────┼────────┼───────┼─────┼────┤
│ Meditar          │07:00 │  [ ✓ ] │  12   │ 30  │ ⚙  │
│ Leer             │21:00 │ Pendien│   4   │  9  │ ⚙  │
│ + Añadir hábito                                      │
└──────────────────┴──────┴────────┴───────┴─────┴────┘
En pausa (2) ▾
Notas del día  (escribe a mano)
```

- **Columna "Hoy"**: botón grande (≈ 100 × 62 unidades) que **cicla** vacío → ✓ → ~ → ✗ → vacío con un toque. Un solo lugar, siempre el mismo gesto.
- Hábito con hora ya pasada y sin marcar: etiqueta **"Pendiente"** (tono cálido, no alarmante). Antes de la hora: solo se muestra la hora.
- Hábito que **no toca** ese día: fila atenuada, sin botón.
- Hábito **en pausa**: fuera de la lista, en la franja "En pausa".
- Cabecera: **"Hoy · 5 de 8 · 63 %"** (marcados / que tocaban, y porcentaje con ~ = 0,25). En otros días muestra la fecha (`lunes 20 sep`).
- Botón **campana**: activa/desactiva **todos** los recordatorios (y pide permiso de notificaciones la primera vez).
- Botón **Extender**: abre la vista del mes (§4.3).

### 4.2 Engrane ⚙ (crear/editar)

Diálogo pequeño: **Nombre** · **Hora recomendada** (opcional) · **Días** (7 fichas, todos por defecto) · **Recordatorio** (interruptor; requiere hora) · **Pausar / Reanudar** · **Eliminar** (con confirmación). "+ Añadir hábito" abre el mismo diálogo en modo crear. Al pasar de 12 activos, el botón se desactiva con el motivo.

### 4.3 Vista del mes ("Extender")

Panel sobre la hoja: **◀ septiembre 2026 ▶**, "Hoy", cerrar. Cuadrícula **hábitos × días** con fechas y letra del día **automáticas**, color por estado (✓ verde, ~ amarillo, ✗ rojo, gris = no toca/pausa/anterior a la creación); los hábitos **en pausa hoy van al final** de la lista, **columna de hoy resaltada**, totales por día abajo y por hábito a la derecha (racha, máx, %). **Tocar una celda ≤ hoy cicla su estado** (para corregir días pasados). Tocar la cabecera de un día **salta a ese día**. Con desplazamiento horizontal en pantallas estrechas y primera columna fija.

### 4.3b Descripción del hábito

- Campo **opcional** "Descripción" en el engrane (texto de varias líneas, máx. **400** caracteres, contador). El texto gris guía es: *Propósito: por qué lo hago / Versión mínima: lo mínimo en un mal día / Versión completa: cómo se ve hecho del todo*. Vaciar el campo la elimina. Sin migración (campo opcional).
- **Hoja:** el nombre es un botón; al tocarlo sale un **popover** con la descripción (o "Sin descripción todavía" + "Añadir descripción", que abre el engrane). Los hábitos con descripción muestran una **ⓘ** junto al nombre. Tocar de nuevo, tocar fuera, Escape, zoom o girar lo cierra.
- **Extender:** los hábitos con descripción tienen el nombre tocable (ⓘ) y muestran el mismo popover (sin botón de editar). Escape cierra solo el popover.
- **Recordatorio:** los hábitos con descripción llevan una **ⓘ**; al tocarla se despliega la descripción dentro de la fila (otro toque la oculta).
- Las líneas que empiezan por "Propósito:", "Versión mínima:" o "Versión completa:" se muestran con la etiqueta en negrita (`parseDescription`); el resto, como texto normal.

### 4.4 Recordatorio (popup)

- A la hora del hábito, si sigue **sin marcar** ese día, el hábito **toca hoy** y **no está en pausa**: popup **"Recuerda tu hábito · {nombre}"** (si coinciden varios, una lista).
- Botones: **Hecho ✓**, **Luego**, **×** (descarta ese aviso del día).
- **Luego** no pospone de golpe: despliega en la misma fila las fichas **5 · 10 · 15 · 30 · 60** y **Otro…** (campo numérico, 1–240 min). La última elección queda resaltada (y, si era libre, aparece como ficha extra); se guarda en los ajustes (`snoozeMinutes`). Tocar **Luego** otra vez pliega las fichas sin posponer; Escape en el campo vuelve a las fichas sin cerrar el aviso.
- Si la pestaña está oculta y hay permiso: además, **notificación del navegador**.
- Al abrir la app o volver a la pestaña: si hay recordatorios vencidos sin mostrar, salen **una sola vez** ("te perdiste estos recordatorios").
- Cada aviso se muestra **como máximo una vez por hábito y día** (aunque haya varias pestañas o recargues).

## 5. Modelo de datos (Dexie v5)

```ts
interface Schedule { from: ISODate; days: number[] }   // 0 = lunes … 6 = domingo
interface Pause    { from: ISODate; to?: ISODate }      // `to` vacío = sigue en pausa

interface Habit {
  id: string;             // uuid
  name: string;           // ≤ 40 caracteres
  time?: "HH:MM";         // hora recomendada (también la del recordatorio)
  description?: string;   // opcional, hasta 400 caracteres (Propósito / Versión mínima / Versión completa)
  remind: boolean;        // recordatorio de este hábito
  schedules: Schedule[];  // versiones con fecha; aplica la de mayor `from` <= día
  pauses: Pause[];
  createdOn: ISODate;     // antes de esta fecha el hábito "no existe" (no genera ✗)
  order: number;          // desempate al ordenar
  updated: number;
}

type LogState = "done" | "partial" | "missed";
interface HabitLog {      // SOLO marcas explícitas; la ✗ de un día pasado se DERIVA
  key: string;            // "<habitId>::<fecha>"
  habitId: string;
  date: ISODate;
  state: LogState;
  at: number;             // epoch ms
}
```

Tablas: `habits: "id, order"` y `habitLogs: "key, habitId, date"`. Ajustes globales (campana, permiso) en `localStorage` (`journal-horas:habits:settings:v1`). Registro de avisos ya mostrados en `localStorage` (`fired:<fecha>:<habitId>`).

**Por qué la ✗ de un día pasado se deriva y no se guarda:** en una web no hay tarea a medianoche. Calcularlo al leer es exacto, retroactivo y sin trabajos en segundo plano; al marcar explícitamente ese día, la marca real lo sustituye.

Estado de un hábito en un día `d` (`hoy` = fecha local, `ahora` = HH:MM):

```
marca explícita        → done | partial | missed          (explicit = true)
d < createdOn / pausa  → "off"                            (gris, no cuenta)
no toca ese día        → "off"
d > hoy                → "future"                         (solo lectura)
d < hoy                → "missed"                         (✗, igual que la marcada)
d = hoy, hora <= ahora → "late"      (Pendiente)
d = hoy, si no         → "pending"
```

## 6. Arquitectura

### 6.1 Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/habits/habitCore.ts` | **Puro** (sin React/DOM/DB): tipos, calendario (`isScheduled`, `isActive`), `resolveState`, `nextState`, `streaks` (actual y récord), `completion`, `pendingCount`, `dueReminders`. Probado con `npm test`. |
| `src/habits/habitsStore.ts` | Tienda externa: índices en memoria (`Map<habitId, Map<fecha, LogState>>`), acciones optimistas (`setState`, `cycle`, CRUD, pausar), persistencia en Dexie, `BroadcastChannel`, integración con el indicador de guardado. Hooks `useHabits`, `useDay(date)`, `useStats(habitId)`. |
| `src/habits/HabitsLayer.tsx` | Capa sobre la hoja (mismo `transform` que las demás): filas, botón "Hoy", racha, récord, engrane, "Pendiente". |
| `src/habits/HabitDialog.tsx` | Diálogo del engrane (crear / editar / pausar / eliminar). |
| `src/habits/MonthView.tsx` | Vista "Extender" (carga diferida). |
| `src/habits/reminders.ts` | Planificador: calcula el siguiente aviso, dispara, deduplica, "luego", recuperación al volver. |
| `src/habits/ReminderDialog.tsx` | Popup de recordatorio + `Notification`. |
| `src/habits/TabBadge.tsx` | Insignia `· N` de la pestaña (componente aislado). |
| `src/habits/minute.ts` | Reloj de **1 minuto** para "Pendiente" (distinto del reloj de 250 ms del temporizador). |
| `tests/habitCore.test.ts` | Pruebas unitarias. |

### 6.2 Archivos que se modifican

| Archivo | Cambio |
|---|---|
| `src/sections/HabitosTemplate.tsx` | **Se reescribe**: hoja vertical 800 × 1035 (mismo estilo que Time blocking); exporta las constantes de geometría que usa la capa. Se retira la cuadrícula de 31 columnas. |
| `src/sections/registry.ts` | `habitos` pasa a `dateScoped: true`, 800 × 1035, **sin `cells`**, y con un nuevo campo `overlay` (componente de capa por sección). |
| `src/canvas/db.ts` | Versión 5: tablas `habits` y `habitLogs`. |
| `src/App.tsx` | Monta la capa `overlay` de la sección activa (nueva ancla con el mismo `transform`), `TabBadge` en la pestaña, `ReminderHost` global; `hydrateHabits()` al arrancar. |
| `src/index.css` | Estilos de la capa y de la insignia. |
| `src/dates.ts` | Utilidades: día de la semana, días del mes, sumar meses, comparar `HH:MM`. |
| `src/canvas/CellFields.tsx`, `src/canvas/Canvas.tsx`, `src/canvas/SheetTemplate.tsx` | **Limpieza** (Fase 5): al desaparecer la hoja manual se retiran el tipo de celda `check`, el toque con la herramienta Mover y su protección multitáctil (solo servían a los checks). |
| `README.md` | Documentar la nueva pestaña. |

### 6.3 Principios de rendimiento

- **Optimista**: tocar cambia la memoria y repinta al instante; Dexie escribe después (una fila `put`).
- **Todo el historial en memoria** (12 hábitos × años = pocos miles de filas): estado, rachas y porcentajes salen en O(1)–O(días) sin consultar la base.
- **Selectores memoizados** por versión de la tienda; una marca solo recalcula las rachas de **ese** hábito.
- **Aislamiento de renders**: la capa y la insignia se suscriben a la tienda de hábitos; el tick por minuto no pasa por `App` (igual que el temporizador con Excalidraw).
- **Carga diferida** de `MonthView` y `HabitDialog` (no pesan en el arranque).
- Botones con `pointer-events` propios y `stopPropagation` para no dibujar sobre la hoja.

## 7. Reglas de negocio (detalle)

- **Calendario del hábito en un día**: activo si `d >= createdOn` y no está dentro de una pausa; toca si además el día de la semana está en la `Schedule` vigente (la de mayor `from <= d`).
- **Racha actual**: se recorre hacia atrás desde hoy. Hoy: `done/partial` → suma; `pending/late` → se ignora; `missed` explícito → racha 0. Días anteriores: solo cuentan los que tocaban; `done/partial` suman, `missed` (marcada o derivada) corta; `off` se salta. Se detiene en `createdOn`.
- **Récord**: recorrido ascendente del historial con las mismas reglas; se recalcula solo para el hábito modificado.
- **Pausa**: se abre un `Pause{from: hoy}`; reanudar cierra con `to`. Los días de pausa son `off`.
- **Eliminar**: borra el hábito y sus `habitLogs`.
- **Cambio de días**: se añade una `Schedule{from: hoy, days}`; el pasado se evalúa con la versión anterior.
- **Límite de 12**: cuenta hábitos **activos** (no pausados).
- **Zona horaria / DST**: fechas como `YYYY-MM-DD` locales (como el resto de la app); el día de la semana se obtiene con mediodía local para evitar saltos de horario.

## 8. Fases de implementación

Un commit por fase (cuando lo pidas).

**F0 — Núcleo puro y pruebas** *(pequeña, sin UI)*
`habitCore.ts` + utilidades de fecha + `tests/habitCore.test.ts`.
*Hecho cuando:* pruebas en verde para calendario, ✗ derivada, hoy pendiente/tarde, rachas (~, ✗, no toca, pausa, `createdOn`), récord, porcentaje con 0,25, cambios de calendario y `dueReminders`.

**F1 — Datos y tienda** *(media)*
Dexie v5, `habitsStore` (CRUD, marcas, pausa), optimista, `BroadcastChannel`, importación única de nombres desde la hoja antigua.
*Hecho cuando:* desde la consola se crean hábitos, se marcan días y sobreviven a recargar; importar nombres funciona una sola vez.

**F2 — Hoja del día** *(grande)*
Plantilla vertical, `overlay` en el registro, `HabitsLayer`, botón "Hoy", racha/récord, "Pendiente", cabecera de progreso, `HabitDialog`, "En pausa", navegación por la fecha global.
*Hecho cuando:* se puede crear un hábito, marcarlo con un toque, ver racha y récord, cambiar de día con las flechas de la barra y pausar/reanudar.

**F3 — Vista del mes** *(media)*
`MonthView` con navegación de mes, estados, totales, edición de días pasados y salto a un día.
*Hecho cuando:* el mes coincide con la hoja del día para cualquier fecha.

**F4 — Recordatorios** *(media)*
Campana (activar/desactivar), planificador, popup, `Notification`, recuperación al volver, deduplicación entre pestañas, insignia de la pestaña.
*Hecho cuando:* a la hora indicada sale el popup una sola vez; desactivarlo lo detiene; con la pestaña oculta y permiso, sale la notificación.

**F5 — Pulido y limpieza** *(pequeña)*
Accesibilidad (etiquetas por celda), rendimiento, retirada del código de checks que ya no se usa, README y este documento.

## 9. Recordatorios: límites reales (para no llevarse sorpresas)

- **Con el navegador o la pestaña cerrados no se puede avisar**: una web sin servidor no despierta sola. La notificación del navegador funciona con la pestaña **abierta pero en segundo plano**.
- Los navegadores **limitan los temporizadores de pestañas ocultas** (hasta ~1 vez por minuto): el aviso puede retrasarse hasta un minuto. Se compensa recalculando al volver a la pestaña y con un latido de seguridad.
- Si niegas el permiso de notificaciones, siguen funcionando los popups dentro de la app.
- En **Safari de iPhone/iPad** las notificaciones web exigen tener la app instalada en la pantalla de inicio; en el resto, popup dentro de la app.
- Avisos **push reales** (app cerrada) quedan para una fase futura con servidor (Supabase) + PWA.

## 10. Pruebas

**Unitarias (`node:test`, sin dependencias)** — `habitCore`: todas las reglas de §7 y casos límite (cambio de mes/año, año bisiesto, hábito creado hoy, pausa que cruza días, calendario por versiones, hoy justo en la hora, `~` que continúa la racha, récord tras editar un día pasado).

**Humo en Chrome real (mismo arnés que el temporizador)** — crear hábito con hora y días; tocar Hoy y ver racha/récord; día anterior con ✗ y corrección a ✓; día futuro solo lectura; pausar/reanudar; límite de 12; Extender (tocar celda, saltar a un día); recordatorio (hábito con hora ya pasada → popup al cargar, una sola vez; "Luego"; campana apagada → nada); dos pestañas sin avisos duplicados; sin errores de consola.

**Manual**: rendimiento con 12 hábitos y ≥ 2 años de historial (tocar sin retraso), zonas táctiles en iPad, permiso de notificaciones denegado.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambiar los días de un hábito reescribe el pasado | Calendario **versionado** con fecha; solo aplica hacia adelante. |
| La ✗ de días pasados genera falsos fallos (hábito creado ayer, pausas) | `createdOn`, pausas y calendario del día lo excluyen; se corrige con un toque. |
| Recordatorios duplicados (varias pestañas / recarga) | Registro `fired` en `localStorage` + candado de Web Locks cuando existe. |
| Recordatorio en mal momento (hablando en otro popup) | Se encola si hay otro aviso abierto (p. ej. el de "Tiempo finalizado") y sale al cerrarlo. |
| Overlay desalineado con la hoja | Constantes de geometría **compartidas** entre plantilla y capa; mismo `transform` de anclaje que las otras capas. |
| Pérdida de datos (IndexedDB local) | Fuera de alcance aquí; recomendado como fase posterior (exportar/respaldar y almacenamiento persistente). |
| Regresiones al retirar el código de checks | Limpieza al final (F5), con las pruebas de humo del temporizador y de celdas como red. |

## 12. Fuera de alcance (ideas para después)

Notificaciones push reales · sincronización entre dispositivos · reordenar arrastrando · color/emoji por hábito · frecuencia "N veces por semana" · hora de cierre configurable · revisión semanal · hábito con temporizador · nota por celda · celebración de rachas · exportar/respaldo · modo oscuro.
