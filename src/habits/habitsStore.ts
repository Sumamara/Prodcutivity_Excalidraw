import { useSyncExternalStore } from "react";

import {
  deleteHabitAndLogs,
  deleteHabitLog,
  getAllHabitLogs,
  getAllHabits,
  getHabitLog,
  getLegacyHabitNames,
  putHabit,
  putHabitLog,
} from "../canvas/db";
import { todayISO } from "../dates";
import { markError, markPending, markSaved } from "../saveStatus";
import {
  MAX_ACTIVE,
  activeHabits,
  createHabit,
  isScheduledOn,
  isValidTime,
  nextLog,
  sanitizeName,
  withDays,
  withPaused,
  withResumed,
  type Habit,
  type ISODate,
  type LogMap,
  type LogState,
} from "./habitCore";

/**
 * Tienda de los hábitos (fuera de React).
 *
 * - Todo el historial vive en MEMORIA (12 hábitos × años = pocas miles de filas):
 *   estado, rachas y porcentajes salen sin consultar la base.
 * - Las acciones son OPTIMISTAS: cambian la memoria y repintan al instante; la
 *   escritura a IndexedDB va después (una fila `put`/`delete`).
 * - Varias pestañas: cada cambio se avisa por BroadcastChannel y las demás
 *   releen solo lo afectado.
 * - La ✗ de un día pasado sin marca no se guarda: se deriva (ver `habitCore.resolveState`).
 */

export interface HabitsSnapshot {
  /** Versión: sube en cada cambio (clave de memoización para los selectores). */
  v: number;
  loaded: boolean;
  habits: readonly Habit[];
  /** habitId → (fecha → marca). Los mapas interiores se mutan in situ; usa `v`. */
  logs: ReadonlyMap<string, Map<ISODate, LogState>>;
}

let state: HabitsSnapshot = { v: 0, loaded: false, habits: [], logs: new Map() };
const listeners = new Set<() => void>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("journal-habits")
    : null;

function commit(patch: Partial<Omit<HabitsSnapshot, "v">>): void {
  state = { ...state, ...patch, v: state.v + 1 };
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Suscripción fuera de React (para el planificador de recordatorios). */
export function subscribeHabits(cb: () => void): () => void {
  return subscribe(cb);
}

export function useHabitsSnapshot(): HabitsSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function getHabitsSnapshot(): HabitsSnapshot {
  return state;
}

/** Marcas de un hábito (o `undefined` si aún no tiene ninguna). */
export function logsOf(habitId: string): LogMap | undefined {
  return state.logs.get(habitId);
}

export function getHabit(id: string): Habit | undefined {
  return state.habits.find((h) => h.id === id);
}

/* ------------------------------- Persistencia ----------------------------- */

function persist(work: () => Promise<boolean>, notice: string): void {
  markPending();
  void work().then((ok) => (ok ? markSaved() : markError()));
  channel?.postMessage(notice);
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/* --------------------------------- Hábitos -------------------------------- */

export interface HabitInput {
  name: string;
  time?: string | null;
  days?: readonly number[];
  remind?: boolean;
}

/** ¿Se puede añadir (o reanudar) otro hábito activo? */
export function canAddActive(): boolean {
  return activeHabits(state.habits, todayISO()).length < MAX_ACTIVE;
}

/** Crea un hábito. Devuelve `null` si el nombre está vacío o ya hay 12 activos. */
export function addHabit(input: HabitInput): Habit | null {
  const name = sanitizeName(input.name);
  if (!name || !canAddActive()) return null;
  const order = state.habits.reduce((m, h) => Math.max(m, h.order), -1) + 1;
  const habit = createHabit({
    id: newId(),
    name,
    time: input.time && isValidTime(input.time) ? input.time : undefined,
    days: input.days,
    remind: input.remind,
    today: todayISO(),
    order,
    now: Date.now(),
  });
  commit({ habits: [...state.habits, habit] });
  persist(() => putHabit(habit), "habits");
  return habit;
}

/**
 * Edita un hábito. Los días de la semana aplican DESDE HOY (el pasado no cambia).
 * `time: null` quita la hora (y con ella el recordatorio).
 */
export function updateHabit(id: string, patch: HabitInput): Habit | null {
  const cur = getHabit(id);
  if (!cur) return null;
  const now = Date.now();
  let next: Habit = { ...cur, updated: now };

  if (patch.name !== undefined) {
    const name = sanitizeName(patch.name);
    if (!name) return null;
    next.name = name;
  }
  if (patch.time !== undefined) {
    next.time = patch.time && isValidTime(patch.time) ? patch.time : undefined;
  }
  if (patch.remind !== undefined) next.remind = patch.remind;
  if (!next.time) next.remind = false; // sin hora no hay recordatorio
  if (patch.days !== undefined) next = withDays(next, patch.days, todayISO(), now);

  commit({ habits: state.habits.map((h) => (h.id === id ? next : h)) });
  persist(() => putHabit(next), "habits");
  return next;
}

/** Pausa o reanuda. Reanudar falla si ya hay 12 activos. */
export function setHabitPaused(id: string, paused: boolean): boolean {
  const cur = getHabit(id);
  if (!cur) return false;
  const today = todayISO();
  if (!paused && !canAddActive()) return false;
  const next = paused ? withPaused(cur, today, Date.now()) : withResumed(cur, today, Date.now());
  if (next === cur) return true;
  commit({ habits: state.habits.map((h) => (h.id === id ? next : h)) });
  persist(() => putHabit(next), "habits");
  return true;
}

/** Elimina el hábito y todas sus marcas. */
export function removeHabit(id: string): void {
  if (!getHabit(id)) return;
  const logs = new Map(state.logs);
  logs.delete(id);
  commit({ habits: state.habits.filter((h) => h.id !== id), logs });
  persist(() => deleteHabitAndLogs(id), "habits");
}

/* ---------------------------------- Marcas -------------------------------- */

function logKey(habitId: string, date: ISODate): string {
  return `${habitId}::${date}`;
}

/**
 * Fija (o borra, con `undefined`) la marca de un día. Solo días hasta hoy y solo
 * si el hábito tocaba ese día; si no, no hace nada.
 */
export function setLog(habitId: string, date: ISODate, value: LogState | undefined): boolean {
  const habit = getHabit(habitId);
  if (!habit || date > todayISO() || !isScheduledOn(habit, date)) return false;
  applyLog(habitId, date, value);
  const key = logKey(habitId, date);
  if (value) {
    persist(() => putHabitLog({ key, habitId, date, state: value, at: Date.now() }), `log:${key}`);
  } else {
    persist(() => deleteHabitLog(key), `log:${key}`);
  }
  return true;
}

/** Toque: vacío → ✓ → ~ → ✗ → vacío. */
export function cycleLog(habitId: string, date: ISODate): boolean {
  const past = date < todayISO();
  return setLog(habitId, date, nextLog(state.logs.get(habitId)?.get(date), past));
}

/** Aplica una marca en memoria (sin persistir). */
function applyLog(habitId: string, date: ISODate, value: LogState | undefined): void {
  let map = state.logs.get(habitId);
  if (!map) {
    map = new Map();
    (state.logs as Map<string, Map<ISODate, LogState>>).set(habitId, map);
  }
  if (value) map.set(date, value);
  else map.delete(date);
  commit({}); // solo sube `v`
}

/* --------------------------------- Arranque -------------------------------- */

const IMPORTED_KEY = "journal-horas:habits:imported:v1";

/**
 * Importa UNA vez los nombres de la antigua hoja manual (si no hay hábitos aún).
 * Los checks antiguos no se migran (no tenían fecha real).
 */
async function importLegacyNames(existing: readonly Habit[]): Promise<Habit[]> {
  let done = false;
  try {
    done = !!localStorage.getItem(IMPORTED_KEY);
  } catch {
    /* noop */
  }
  if (done || existing.length) return [];
  const names = await getLegacyHabitNames();
  try {
    localStorage.setItem(IMPORTED_KEY, "1");
  } catch {
    /* noop */
  }
  const today = todayISO();
  const now = Date.now();
  const out: Habit[] = [];
  for (const raw of names.slice(0, MAX_ACTIVE)) {
    const name = sanitizeName(raw);
    if (!name) continue;
    out.push(createHabit({ id: newId(), name, today, order: out.length, now }));
  }
  for (const h of out) await putHabit(h);
  return out;
}

let hydrating: Promise<void> | null = null;

/** Carga hábitos y marcas (una sola vez). */
export function hydrateHabits(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (!hydrating) {
    hydrating = (async () => {
      const [habits, rows] = await Promise.all([getAllHabits(), getAllHabitLogs()]);
      const imported = await importLegacyNames(habits);
      const logs = new Map<string, Map<ISODate, LogState>>();
      for (const r of rows) {
        let m = logs.get(r.habitId);
        if (!m) {
          m = new Map();
          logs.set(r.habitId, m);
        }
        m.set(r.date, r.state);
      }
      commit({ habits: [...habits, ...imported], logs, loaded: true });
    })();
  }
  return hydrating;
}

/* ------------------------------- Varias pestañas --------------------------- */

channel?.addEventListener("message", (ev: MessageEvent<unknown>) => {
  if (!state.loaded || typeof ev.data !== "string") return;
  const msg = ev.data;
  if (msg === "habits") {
    void getAllHabits().then((habits) => {
      const ids = new Set(habits.map((h) => h.id));
      const logs = new Map(state.logs);
      for (const id of logs.keys()) if (!ids.has(id)) logs.delete(id);
      commit({ habits, logs });
    });
  } else if (msg.startsWith("log:")) {
    const key = msg.slice(4);
    void getHabitLog(key).then((row) => {
      const [habitId, date] = key.split("::");
      applyLog(habitId, date, row?.state);
    });
  }
});
