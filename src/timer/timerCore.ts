/**
 * Núcleo PURO del temporizador: tipos, conversión de Esp a minutos, formato de
 * tiempo y transiciones de estado. No usa React, DOM ni base de datos, y nunca
 * lee el reloj por su cuenta (`now` se inyecta), así que es fácil de probar.
 *
 * Solo sintaxis "borrable" (sin enums ni parameter properties): las pruebas lo
 * ejecutan directamente con Node (`npm test`).
 */

/* --------------------------------- Tipos ---------------------------------- */

/** Nombres de las columnas de la tabla que usa el temporizador. */
export interface TimerColumns {
  esp: string;
  ti: string;
  tf: string;
  real: string;
  /** Columna con el nombre de la tarea (se muestra en el aviso de fin de tiempo). */
  label: string;
}

/** Valores de celda de la fila antes de arrancar (para restaurar si se descarta). */
export interface CellSnapshot {
  ti?: string;
  tf?: string;
  real?: string;
}

/** Parche de celdas: `null` = vaciar la celda. */
export type CellPatch = Record<string, string | null>;

export interface ActiveTimer {
  id: string;
  /**
   * `"row"` (por defecto, también para datos antiguos sin este campo): cuenta
   * atrás de una fila. `"free"`: cronómetro libre, cuenta hacia arriba, sin fila
   * ni escritura en celdas.
   */
  kind?: "row" | "free";
  /** Fecha ISO de la hoja donde se inició. */
  date: string;
  sectionId: string;
  cols: TimerColumns;
  /** Fila 0..N-1 de la tabla. */
  row: number;
  /** Duración del temporizador en ms (sale de Esp al arrancar). */
  plannedMs: number;
  status: "running" | "paused";
  /** Epoch ms del tramo en marcha actual (válido si `running`). */
  startedAt: number;
  /** Tiempo activo acumulado de tramos anteriores. */
  accumulatedMs: number;
  /** Epoch ms del primer arranque. */
  firstStartedAt: number;
  prev: CellSnapshot;
  /** Nombre de la tarea al iniciar (respaldo del aviso y de la sesión). */
  label: string;
  /** Pestaña que programó el tono de fin. */
  owner: string;
  updatedAt: number;
}

/** Sesión terminada; el almacén es de solo-añadir. */
export interface SessionRow {
  id: string;
  /** `"free"` = cronómetro libre (sin fila ni hoja: `row` = -1, `sectionId` = ""). */
  kind?: "row" | "free";
  date: string;
  sectionId: string;
  row: number;
  label: string;
  plannedMs: number;
  activeMs: number;
  overtimeMs: number;
  startedAt: number;
  endedAt: number;
}

/* ------------------------------- Constantes ------------------------------- */

/** Si paras antes de este tiempo activo, se considera un arranque accidental. */
export const ACCIDENTAL_MS = 10_000;

const MAX_MINUTES = 24 * 60;

/* ---------------------------- Esp → minutos ------------------------------- */

const HOURS = "(?:h|hr|hrs|hora|horas)";
const MINS = "(?:m|min|mins|minuto|minutos)";

function inRange(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null;
  const m = Math.round(minutes);
  return m >= 1 && m <= MAX_MINUTES ? m : null;
}

/**
 * Convierte lo escrito en Esp a minutos enteros, o `null` si no es válido.
 *
 *   `45`            → 45   (entero suelto = minutos)
 *   `1.5` / `1,5`   → 90   (decimal suelto = horas)
 *   `2h` / `1.5h`   → 120 / 90
 *   `1h30`, `1h 30m`→ 90
 *   `1:30`          → 90
 *   `90m` / `90min` → 90
 */
export function parseEsp(input: string | null | undefined): number | null {
  const s = (input ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
  if (!s) return null;

  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d+)$/))) return inRange(Number(m[1]));

  if ((m = s.match(/^(\d*\.\d+)$/))) return inRange(parseFloat(m[1]) * 60);

  if ((m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)${HOURS}$`)))) {
    return inRange(parseFloat(m[1]) * 60);
  }

  if ((m = s.match(new RegExp(`^(\\d+)${HOURS}(\\d{1,2})(?:${MINS})?$`)))) {
    const mins = Number(m[2]);
    return mins < 60 ? inRange(Number(m[1]) * 60 + mins) : null;
  }

  if ((m = s.match(/^(\d+):(\d{1,2})$/))) {
    const mins = Number(m[2]);
    return mins < 60 ? inRange(Number(m[1]) * 60 + mins) : null;
  }

  if ((m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)${MINS}$`)))) {
    return inRange(parseFloat(m[1]));
  }

  return null;
}

/** Texto normalizado (minutos) para guardar en la celda, o `null` si no es válido. */
export function normalizeEsp(input: string | null | undefined): string | null {
  const n = parseEsp(input);
  return n === null ? null : String(n);
}

/* --------------------------------- Formato -------------------------------- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Tiempo restante a mostrar. Cuenta atrás con `ceil` (00:01 hasta llegar a 0);
 * en tiempo extra antepone "−" (U+2212) y usa `floor`.
 */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs > 0) return fmtSeconds(Math.ceil(remainingMs / 1000));
  const over = Math.floor(-remainingMs / 1000);
  return over === 0 ? fmtSeconds(0) : `−${fmtSeconds(over)}`;
}

/** Tiempo transcurrido del cronómetro: `mm:ss` (< 1 h) o `h:mm:ss`. */
export function formatElapsed(ms: number): string {
  return fmtSeconds(Math.max(0, ms) / 1000);
}

/** Tiempo trabajado en lenguaje natural: `menos de 1 min`, `25 min`, `1 h 05 min`. */
export function formatWorked(ms: number): string {
  const totalMin = Math.round(Math.max(0, ms) / 60_000);
  if (totalMin === 0) return "menos de 1 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${totalMin} min`;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)} min`;
}

/** Hora local `HH:MM` (24 h) calculada a mano: `toLocaleTimeString` varía por región. */
export function clockHHMM(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------ Celdas / filas ---------------------------- */

export function cellId(column: string, row: number): string {
  return `${column}-${row}`;
}

/** Columna de un id de celda (`esp-3` → `esp`). */
export function columnOfCellId(id: string): string {
  const i = id.lastIndexOf("-");
  return i < 0 ? id : id.slice(0, i);
}

/** Fila de un id de celda (`esp-3` → 3), o `null` si no tiene el formato. */
export function rowOfCellId(id: string): number | null {
  const i = id.lastIndexOf("-");
  if (i < 0) return null;
  const n = Number(id.slice(i + 1));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Id nuevo (UUID si el entorno lo ofrece). */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/* ------------------------------ Transiciones ------------------------------ */

export function createTimer(args: {
  id: string;
  date: string;
  sectionId: string;
  cols: TimerColumns;
  row: number;
  plannedMs: number;
  label: string;
  prev: CellSnapshot;
  owner: string;
  now: number;
}): ActiveTimer {
  return {
    id: args.id,
    date: args.date,
    sectionId: args.sectionId,
    cols: args.cols,
    row: args.row,
    plannedMs: args.plannedMs,
    status: "running",
    startedAt: args.now,
    accumulatedMs: 0,
    firstStartedAt: args.now,
    prev: args.prev,
    label: args.label,
    owner: args.owner,
    updatedAt: args.now,
  };
}

/** Cronómetro libre (sin fila): cuenta hacia arriba y no escribe en celdas. */
export function createStopwatch(args: {
  id: string;
  date: string;
  owner: string;
  now: number;
}): ActiveTimer {
  return {
    id: args.id,
    kind: "free",
    date: args.date,
    sectionId: "",
    cols: { esp: "", ti: "", tf: "", real: "", label: "" },
    row: -1,
    plannedMs: 0,
    status: "running",
    startedAt: args.now,
    accumulatedMs: 0,
    firstStartedAt: args.now,
    prev: {},
    label: "Cronómetro",
    owner: args.owner,
    updatedAt: args.now,
  };
}

export function isFreeTimer(t: ActiveTimer): boolean {
  return t.kind === "free";
}

/** Tiempo activo (sin pausas) hasta `now`. */
export function elapsedMs(t: ActiveTimer, now: number): number {
  const running = t.status === "running" ? Math.max(0, now - t.startedAt) : 0;
  return t.accumulatedMs + running;
}

export function remainingMs(t: ActiveTimer, now: number): number {
  return t.plannedMs - elapsedMs(t, now);
}

/** Tiempo extra: se llegó (o se pasó) del tiempo estimado. */
export function isOvertime(t: ActiveTimer, now: number): boolean {
  return remainingMs(t, now) <= 0;
}

export function pauseTimer(t: ActiveTimer, now: number): ActiveTimer {
  if (t.status !== "running") return t;
  return { ...t, status: "paused", accumulatedMs: elapsedMs(t, now), updatedAt: now };
}

export function resumeTimer(t: ActiveTimer, now: number, owner: string): ActiveTimer {
  if (t.status !== "paused") return t;
  return { ...t, status: "running", startedAt: now, owner, updatedAt: now };
}

/** Parche de celdas al ARRANCAR: pone Ti y deja Tf/Real vacíos (fila "en curso"). */
export function startPatch(t: ActiveTimer): CellPatch {
  return {
    [cellId(t.cols.ti, t.row)]: clockHHMM(t.firstStartedAt),
    [cellId(t.cols.tf, t.row)]: null,
    [cellId(t.cols.real, t.row)]: null,
  };
}

export type FinishResult =
  | { kind: "discard"; patch: CellPatch }
  | { kind: "finish"; patch: CellPatch; session: SessionRow }
  /** Cronómetro libre: solo sesión (no hay celdas que rellenar ni que restaurar). */
  | { kind: "free"; session: SessionRow };

/**
 * Termina el temporizador. Con menos de `ACCIDENTAL_MS` de tiempo activo se
 * descarta (arranque accidental) y se restauran los valores previos; si no, se
 * rellenan Tf y Real (minutos, mínimo 1) y se devuelve la sesión a guardar.
 */
export function finishTimer(t: ActiveTimer, now: number): FinishResult {
  const active = elapsedMs(t, now);

  if (isFreeTimer(t)) {
    return {
      kind: "free",
      session: {
        id: t.id,
        kind: "free",
        date: t.date,
        sectionId: "",
        row: -1,
        label: t.label,
        plannedMs: 0,
        activeMs: active,
        overtimeMs: 0,
        startedAt: t.firstStartedAt,
        endedAt: now,
      },
    };
  }

  const ti = cellId(t.cols.ti, t.row);
  const tf = cellId(t.cols.tf, t.row);
  const real = cellId(t.cols.real, t.row);

  if (active < ACCIDENTAL_MS) {
    return {
      kind: "discard",
      patch: {
        [ti]: t.prev.ti ?? null,
        [tf]: t.prev.tf ?? null,
        [real]: t.prev.real ?? null,
      },
    };
  }

  return {
    kind: "finish",
    patch: {
      [tf]: clockHHMM(now),
      [real]: String(Math.max(1, Math.round(active / 60_000))),
    },
    session: {
      id: t.id,
      date: t.date,
      sectionId: t.sectionId,
      row: t.row,
      label: t.label,
      plannedMs: t.plannedMs,
      activeMs: active,
      overtimeMs: Math.max(0, active - t.plannedMs),
      startedAt: t.firstStartedAt,
      endedAt: now,
    },
  };
}

/* -------------------------------- Descanso -------------------------------- */

/** Fracciones del tiempo trabajado que se sugieren como descanso (15–20 %). */
export const REST_MIN_RATIO = 0.15;
export const REST_MAX_RATIO = 0.2;

/**
 * Rango de descanso sugerido (minutos enteros, mínimo 1) a partir del tiempo
 * trabajado: entre el 15 % y el 20 %.
 */
export function restRangeMinutes(workedMs: number): { lo: number; hi: number } {
  const worked = Math.max(0, workedMs) / 60_000;
  const lo = Math.max(1, Math.round(worked * REST_MIN_RATIO));
  const hi = Math.max(lo, Math.round(worked * REST_MAX_RATIO));
  return { lo, hi };
}
