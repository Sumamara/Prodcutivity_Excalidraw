/**
 * Núcleo PURO de los hábitos: tipos, calendario, estado de un hábito en un día,
 * rachas, porcentajes y recordatorios. Sin React, DOM ni base de datos, y sin
 * leer el reloj (`hoy` y `ahora` se inyectan): es determinista y se prueba con
 * `npm test`.
 *
 * Solo sintaxis "borrable" (sin enums ni parameter properties) para que Node lo
 * ejecute directamente.
 *
 * Convenciones:
 *  - Fechas como texto ISO local `YYYY-MM-DD` (igual que el resto de la app).
 *  - Días de la semana: 0 = lunes … 6 = domingo.
 *  - Horas como `HH:MM` (24 h); se comparan como texto.
 */

/* --------------------------------- Tipos ---------------------------------- */

export type ISODate = string;
export type HHMM = string;

/** Días en los que toca el hábito, vigente desde `from` (incluida). */
export interface Schedule {
  from: ISODate;
  days: number[];
}

/** Pausa: `from` incluida; `to` = primer día ya activo de nuevo (excluida). */
export interface Pause {
  from: ISODate;
  to?: ISODate;
}

export interface Habit {
  id: string;
  name: string;
  /** Hora recomendada (y del recordatorio). */
  time?: HHMM;
  /** Descripción libre (p. ej. Propósito / Versión mínima / Versión completa). */
  description?: string;
  remind: boolean;
  /** Versiones del calendario; aplica la de mayor `from <= día`. */
  schedules: Schedule[];
  pauses: Pause[];
  /** Antes de esta fecha el hábito "no existe" (no genera ✗ en el pasado). */
  createdOn: ISODate;
  /** Desempate al ordenar. */
  order: number;
  updated: number;
}

/**
 * Marca EXPLÍCITA. Un día pasado sin marca se ve y cuenta como ✗ (`missed`), pero
 * esa ✗ se deriva y no se guarda.
 */
export type LogState = "done" | "partial" | "missed";

/**
 * Estado resuelto de un hábito en un día:
 *  - `done` / `partial` / `missed`: marcados por el usuario; `missed` también es
 *    lo que se ve en un día pasado sin marca (pasada la medianoche).
 *  - `late`: hoy, sin marca y la hora recomendada ya pasó ("Pendiente").
 *  - `pending`: hoy, sin marca y aún no es la hora (o no tiene hora).
 *  - `future`: día futuro (solo lectura).
 *  - `off`: no cuenta ese día (no toca, pausa o anterior a la creación).
 */
export type DayState =
  | LogState
  | "late"
  | "pending"
  | "future"
  | "off";

/** Marcas de UN hábito: fecha → estado. */
export type LogMap = ReadonlyMap<ISODate, LogState>;

/* ------------------------------- Constantes ------------------------------- */

/** Máximo de hábitos ACTIVOS (no pausados) en la hoja diaria. */
export const MAX_ACTIVE = 12;
/** Peso de "a medias" en los porcentajes. */
export const PARTIAL_WEIGHT = 0.25;
export const NAME_MAX = 40;
export const DESC_MAX = 400;
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LETTERS: readonly string[] = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_NAMES: readonly string[] = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];
export const MONTH_NAMES: readonly string[] = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/* -------------------------------- Calendario ------------------------------ */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseISO(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Suma `n` días (negativo = resta). Usa mediodía local para no tropezar con el cambio de hora. */
export function addDays(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m - 1, d + n, 12);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** Día de la semana: 0 = lunes … 6 = domingo. */
export function weekdayOf(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  const js = new Date(y, m - 1, d, 12).getDay(); // 0 = domingo
  return (js + 6) % 7;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** Primer día del mes de `iso`. */
export function monthStart(iso: ISODate): ISODate {
  const { y, m } = parseISO(iso);
  return toISO(y, m, 1);
}

/** Suma `n` meses y devuelve el primer día de ese mes. */
export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m } = parseISO(iso);
  const dt = new Date(y, m - 1 + n, 1, 12);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, 1);
}

/** Todos los días (ISO) del mes de `iso`. */
export function monthDays(iso: ISODate): ISODate[] {
  const { y, m } = parseISO(iso);
  const n = daysInMonth(y, m);
  const out: ISODate[] = [];
  for (let d = 1; d <= n; d++) out.push(toISO(y, m, d));
  return out;
}

/** `septiembre 2026`. */
export function monthLabel(iso: ISODate): string {
  const { y, m } = parseISO(iso);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** `HH:MM` válido (00:00–23:59). */
export function isValidTime(s: string | undefined | null): s is HHMM {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Minutos rápidos del "Luego" del recordatorio. */
export const SNOOZE_PRESETS: readonly number[] = [5, 10, 15, 30, 60];
export const SNOOZE_DEFAULT = 15;
export const SNOOZE_MAX = 240;

/** Entero 1–`SNOOZE_MAX` escrito por el usuario ("45", " 7 "); `null` si no vale. */
export function parseSnoozeMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= SNOOZE_MAX ? n : null;
}

/** Valor guardado → minutos válidos (si no lo es, el predeterminado). */
export function normalizeSnooze(n: unknown): number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= SNOOZE_MAX
    ? n
    : SNOOZE_DEFAULT;
}

/** Minutos de `a` a `b` (`b - a`); ambos `HH:MM` del mismo día. */
export function minutesBetween(a: HHMM, b: HHMM): number {
  const [ha, ma] = a.split(":").map(Number);
  const [hb, mb] = b.split(":").map(Number);
  return hb * 60 + mb - (ha * 60 + ma);
}

/** Suma minutos a un `HH:MM` (sin pasar de las 23:59 del mismo día). */
export function addMinutesHHMM(t: HHMM, minutes: number): HHMM {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/* --------------------------- Calendario de un hábito ---------------------- */

/** Días de la semana vigentes en `d` (o `null` si aún no había calendario). */
export function scheduleFor(h: Habit, d: ISODate): readonly number[] | null {
  let best: Schedule | null = null;
  for (const s of h.schedules) {
    if (s.from <= d && (!best || s.from > best.from)) best = s;
  }
  return best ? best.days : null;
}

export function isPausedOn(h: Habit, d: ISODate): boolean {
  for (const p of h.pauses) {
    if (p.from <= d && (p.to === undefined || d < p.to)) return true;
  }
  return false;
}

/** ¿Existe y no está en pausa ese día? */
export function isActiveOn(h: Habit, d: ISODate): boolean {
  return d >= h.createdOn && !isPausedOn(h, d);
}

/** ¿Toca ese día? (activo y el día de la semana está en el calendario vigente). */
export function isScheduledOn(h: Habit, d: ISODate): boolean {
  if (!isActiveOn(h, d)) return false;
  const days = scheduleFor(h, d);
  return !!days && days.includes(weekdayOf(d));
}

/* ------------------------------ Estado de un día -------------------------- */

/**
 * Estado de un hábito en el día `d`.
 * Orden de resolución: no cuenta → marca explícita → futuro → pasado sin marca
 * (✗) → hoy (pendiente / tarde).
 */
export function resolveState(
  h: Habit,
  d: ISODate,
  log: LogState | undefined,
  today: ISODate,
  nowHHMM: HHMM,
): DayState {
  if (!isScheduledOn(h, d)) return "off";
  if (log) return log;
  if (d > today) return "future";
  if (d < today) return "missed";
  return h.time && h.time <= nowHHMM ? "late" : "pending";
}

/**
 * Siguiente marca al tocar. Hoy y días futuros: vacío → ✓ → ~ → ✗ → vacío. En un
 * día PASADO "vacío" ya se ve como ✗, así que el ciclo es ✓ → ~ → ✗ → ✓ (sin un
 * paso que parezca no hacer nada): la ✗ se deja sin marca guardada.
 */
export function nextLog(
  current: LogState | undefined,
  past = false,
): LogState | undefined {
  if (current === undefined) return "done";
  if (current === "done") return "partial";
  if (current === "partial") return past ? undefined : "missed";
  return past ? "done" : undefined;
}

/** ¿Cuenta como día "cumplido" para la racha? (✓ y ~). */
function keepsStreak(s: DayState): boolean {
  return s === "done" || s === "partial";
}

/* ---------------------------------- Rachas -------------------------------- */

export interface Streaks {
  /** Días seguidos hasta hoy. */
  current: number;
  /** Récord de todo el historial. */
  best: number;
}

/**
 * Racha actual y récord (una sola pasada ascendente desde `createdOn`).
 *  - Solo cuentan los días que tocaban; los que no tocan y las pausas se saltan.
 *  - ✓ y ~ suman; ✗ (marcado o de un día pasado sin marca) corta.
 *  - Hoy sin marcar (pendiente/tarde) no corta ni suma.
 */
export function streaks(h: Habit, logs: LogMap, today: ISODate): Streaks {
  let run = 0;
  let best = 0;
  if (h.createdOn > today) return { current: 0, best: 0 };
  for (let d = h.createdOn; d <= today; d = addDays(d, 1)) {
    if (!isScheduledOn(h, d)) continue;
    const log = logs.get(d);
    if (log) {
      if (keepsStreak(log)) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
      continue;
    }
    if (d < today) run = 0; // día pasado sin marca = ✗
    // hoy sin marca: ni suma ni corta
  }
  return { current: run, best };
}

/* ------------------------------- Porcentajes ------------------------------ */

export interface Completion {
  done: number;
  partial: number;
  /** ✗: marcadas y días pasados sin marca. */
  missed: number;
  /** Días evaluados que tocaban (excluye hoy pendiente/tarde y el futuro). */
  evaluated: number;
  /** (✓ + 0,25 × ~) / evaluados, o `null` si no hay días evaluados. */
  pct: number | null;
}

/** Cumplimiento de un hábito entre `from` y `to` (ambos incluidos). */
export function completion(
  h: Habit,
  logs: LogMap,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): Completion {
  let done = 0;
  let partial = 0;
  let missed = 0;
  const end = to < today ? to : today;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (!isScheduledOn(h, d)) continue;
    const log = logs.get(d);
    if (log === "done") done++;
    else if (log === "partial") partial++;
    else if (log === "missed" || d < today) missed++;
    // hoy sin marca: aún no se evalúa
  }
  const evaluated = done + partial + missed;
  const pct = evaluated ? (done + PARTIAL_WEIGHT * partial) / evaluated : null;
  return { done, partial, missed, evaluated, pct };
}

export interface DayProgress {
  /** Hábitos que tocaban ese día. */
  total: number;
  done: number;
  partial: number;
  /** (✓ + 0,25 × ~) / total (los pendientes cuentan en el total), o `null` sin hábitos. */
  pct: number | null;
}

/** Resumen de un día para la cabecera ("5 de 8 · 63 %"). */
export function dayProgress(
  habits: readonly Habit[],
  logsOf: (habitId: string) => LogMap | undefined,
  d: ISODate,
): DayProgress {
  let total = 0;
  let done = 0;
  let partial = 0;
  for (const h of habits) {
    if (!isScheduledOn(h, d)) continue;
    total++;
    const log = logsOf(h.id)?.get(d);
    if (log === "done") done++;
    else if (log === "partial") partial++;
  }
  const pct = total ? (done + PARTIAL_WEIGHT * partial) / total : null;
  return { total, done, partial, pct };
}

/* --------------------------------- Hábitos -------------------------------- */

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/**
 * Descripción: conserva los saltos de línea (una parte por línea), limpia los
 * espacios, deja como mucho una línea en blanco seguida y recorta a `DESC_MAX`.
 * Vacío = sin descripción.
 */
export function sanitizeDescription(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DESC_MAX)
    .trim();
}

export interface DescPart {
  /** Etiqueta reconocida al inicio de la línea (Propósito, Versión mínima/completa). */
  label?: string;
  text: string;
}

const DESC_LABELS: readonly [RegExp, string][] = [
  [/^prop[oó]sito$/i, "Propósito"],
  [/^versi[oó]n m[ií]nima$/i, "Versión mínima"],
  [/^versi[oó]n completa$/i, "Versión completa"],
];

/**
 * Parte la descripción en líneas para mostrarla; las que empiezan por
 * "Propósito:", "Versión mínima:" o "Versión completa:" llevan su etiqueta aparte.
 * Las líneas vacías se omiten.
 */
export function parseDescription(text: string): DescPart[] {
  const out: DescPart[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = /^([^:：\-–—]{1,20}?)\s*[:：\-–—]\s*(.*)$/.exec(t);
    const hit = m ? DESC_LABELS.find(([re]) => re.test(m[1].trim())) : undefined;
    if (m && hit) out.push({ label: hit[1], text: m[2].trim() });
    else out.push({ text: t });
  }
  return out;
}

/** Orden en pantalla: por hora (los sin hora al final), luego `order`, luego creación. */
export function sortHabits(habits: readonly Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    const ta = a.time ?? "99:99";
    const tb = b.time ?? "99:99";
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.createdOn < b.createdOn ? -1 : a.createdOn > b.createdOn ? 1 : 0;
  });
}

/** Como `habits` pero con los pausados hoy al final (orden estable). */
export function pausedLast(habits: readonly Habit[], today: ISODate): Habit[] {
  return [
    ...habits.filter((h) => !isPausedOn(h, today)),
    ...habits.filter((h) => isPausedOn(h, today)),
  ];
}

/** ¿Está en pausa AHORA (hoy)? */
export function isPausedNow(h: Habit, today: ISODate): boolean {
  return isPausedOn(h, today);
}

/** Hábitos activos (no pausados) hoy: los que ocupan fila. */
export function activeHabits(habits: readonly Habit[], today: ISODate): Habit[] {
  return habits.filter((h) => !isPausedOn(h, today));
}

export function pausedHabits(habits: readonly Habit[], today: ISODate): Habit[] {
  return habits.filter((h) => isPausedOn(h, today));
}

export function createHabit(args: {
  id: string;
  name: string;
  time?: HHMM;
  description?: string;
  days?: readonly number[];
  remind?: boolean;
  today: ISODate;
  order: number;
  now: number;
}): Habit {
  const time = isValidTime(args.time) ? args.time : undefined;
  const description = sanitizeDescription(args.description ?? "");
  return {
    id: args.id,
    name: sanitizeName(args.name),
    time,
    ...(description ? { description } : {}),
    remind: !!args.remind && !!time,
    schedules: [{ from: args.today, days: normalizeDays(args.days) }],
    pauses: [],
    createdOn: args.today,
    order: args.order,
    updated: args.now,
  };
}

/** Días únicos, ordenados y válidos; sin ninguno = todos los días. */
export function normalizeDays(days: readonly number[] | undefined): number[] {
  const set = new Set<number>();
  for (const d of days ?? ALL_DAYS) if (Number.isInteger(d) && d >= 0 && d <= 6) set.add(d);
  return set.size ? [...set].sort((a, b) => a - b) : [...ALL_DAYS];
}

/**
 * Cambia los días de la semana DESDE HOY (el pasado conserva su calendario).
 * Si ya hay una versión que empieza hoy, se reemplaza; si no cambia nada, no hace nada.
 */
export function withDays(h: Habit, days: readonly number[], today: ISODate, now: number): Habit {
  const next = normalizeDays(days);
  const cur = scheduleFor(h, today);
  if (cur && sameDays(cur, next)) return h;
  const schedules = h.schedules.filter((s) => s.from !== today);
  schedules.push({ from: today, days: next });
  return { ...h, schedules, updated: now };
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Pausa el hábito desde hoy (si ya está en pausa, no hace nada). */
export function withPaused(h: Habit, today: ISODate, now: number): Habit {
  if (isPausedOn(h, today)) return h;
  return { ...h, pauses: [...h.pauses, { from: today }], updated: now };
}

/**
 * Reanuda el hábito hoy: cierra la pausa abierta con `to = hoy`. Si esa pausa
 * empezó hoy no llegó a ocultar ningún día, así que se elimina.
 */
export function withResumed(h: Habit, today: ISODate, now: number): Habit {
  if (!isPausedOn(h, today)) return h;
  const pauses: Pause[] = [];
  for (const p of h.pauses) {
    const open = p.from <= today && (p.to === undefined || today < p.to);
    if (!open) {
      pauses.push(p);
    } else if (p.from < today) {
      pauses.push({ from: p.from, to: today });
    }
    // p.from === today → se descarta
  }
  return { ...h, pauses, updated: now };
}

/* ------------------------------- Recordatorios ---------------------------- */

/**
 * Hábitos cuyo recordatorio está vencido ahora: activan recordatorio, tienen
 * hora ya pasada, tocan hoy, no tienen marca hoy y no se avisaron ya.
 */
export function dueReminders(args: {
  habits: readonly Habit[];
  logsOf: (habitId: string) => LogMap | undefined;
  today: ISODate;
  nowHHMM: HHMM;
  /** Ids ya avisados (o descartados) hoy. */
  fired: ReadonlySet<string>;
}): Habit[] {
  const out: Habit[] = [];
  for (const h of args.habits) {
    if (!h.remind || !h.time || h.time > args.nowHHMM) continue;
    if (args.fired.has(h.id)) continue;
    if (!isScheduledOn(h, args.today)) continue;
    if (args.logsOf(h.id)?.get(args.today)) continue;
    out.push(h);
  }
  return sortHabits(out);
}

/**
 * Ids ya avisados hoy A LA HORA VIGENTE. Si el usuario cambió la hora del hábito
 * después de que avisara, ese aviso ya no cuenta y puede volver a saltar. Sin
 * registro de hora (datos antiguos) se respeta el aviso.
 */
export function effectiveFired(
  habits: readonly Habit[],
  ids: readonly string[],
  times: Readonly<Record<string, string | undefined>>,
): Set<string> {
  const firedIds = new Set(ids);
  const out = new Set<string>();
  for (const h of habits) {
    if (!firedIds.has(h.id)) continue;
    const t = times[h.id];
    if (t === undefined || t === h.time) out.add(h.id);
  }
  return out;
}

/** Cuenta los hábitos "Pendiente" (hora pasada y sin marcar) hoy: la insignia de la pestaña. */
export function lateCount(
  habits: readonly Habit[],
  logsOf: (habitId: string) => LogMap | undefined,
  today: ISODate,
  nowHHMM: HHMM,
): number {
  let n = 0;
  for (const h of habits) {
    if (resolveState(h, today, logsOf(h.id)?.get(today), today, nowHHMM) === "late") n++;
  }
  return n;
}
