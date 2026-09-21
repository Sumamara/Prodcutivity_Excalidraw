import { useSyncExternalStore } from "react";

import {
  addSession,
  clearActiveTimer,
  getActiveTimer,
  putActiveTimer,
} from "../canvas/db";
import {
  ensureCellsLoaded,
  patchCells,
  peekCells,
} from "../canvas/cellsStore";
import { markError } from "../saveStatus";
import { cancelChime, scheduleChime, unlockAudio } from "./timerAudio";
import {
  cellId,
  createStopwatch,
  createTimer,
  finishTimer as finishCore,
  isFreeTimer,
  newId,
  parseEsp,
  pauseTimer as pauseCore,
  remainingMs,
  resumeTimer as resumeCore,
  startPatch,
  type ActiveTimer,
  type TimerColumns,
} from "./timerCore";
import { todayISO } from "../dates";

/**
 * Tienda del temporizador activo (fuera de React). Solo hay UNO a la vez.
 *
 * - Las transiciones cambian la memoria de forma SINCRÓNICA y persisten después
 *   (así dos clics seguidos no arrancan dos temporizadores).
 * - El tiempo se calcula siempre desde timestamps (`Date.now()`), nunca sumando
 *   ticks: sobrevive a pestañas ocultas, recargas y cierres del navegador.
 * - Ti/Tf/Real se escriben en las celdas de la hoja de origen por parches
 *   (`patchCells`), aunque esa hoja no esté visible.
 */

const TAB_ID = newId();

let active: ActiveTimer | null = null;
let busy = false;
const listeners = new Set<() => void>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("journal-timer")
    : null;

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Timer activo (o null). El objeto es inmutable: cambia solo en transiciones. */
export function useActiveTimer(): ActiveTimer | null {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => active,
  );
}

export function getTimerSnapshot(): ActiveTimer | null {
  return active;
}

/* ------------------------- Aviso "Tiempo finalizado" ----------------------- */

/**
 * Datos del aviso. Vive en el almacén (no depende del timer) para que el aviso
 * del cronómetro pueda salir DESPUÉS de detenerlo.
 */
export type TimeUpInfo =
  | {
      kind: "task";
      timerId: string;
      workedMs: number;
      date: string;
      sectionId: string;
      row: number;
      cols: TimerColumns;
      label: string;
    }
  | { kind: "free"; workedMs: number };

let timeUp: TimeUpInfo | null = null;
const timeUpListeners = new Set<() => void>();

function setTimeUp(next: TimeUpInfo | null): void {
  timeUp = next;
  for (const l of timeUpListeners) l();
}

export function openTimeUp(info: TimeUpInfo): void {
  setTimeUp(info);
}

export function closeTimeUp(): void {
  if (timeUp) setTimeUp(null);
}

export function useTimeUp(): TimeUpInfo | null {
  return useSyncExternalStore(
    (cb) => {
      timeUpListeners.add(cb);
      return () => {
        timeUpListeners.delete(cb);
      };
    },
    () => timeUp,
    () => timeUp,
  );
}

/* ------------------------------- Persistencia ----------------------------- */

function persist(t: ActiveTimer): void {
  void putActiveTimer(t).then((ok) => {
    if (!ok) markError();
  });
  channel?.postMessage("changed");
}

function commit(t: ActiveTimer): void {
  active = t;
  emit();
  persist(t);
}

/* --------------------------------- Tono ----------------------------------- */

/** (Re)programa el tono de fin: solo si corre, aún no llegó a 0 y somos el dueño. */
function armChime(): void {
  cancelChime();
  const t = active;
  if (!t || isFreeTimer(t) || t.status !== "running" || t.owner !== TAB_ID) return;
  const now = Date.now();
  const rem = remainingMs(t, now);
  if (rem > 0) scheduleChime(now + rem);
}

/* --------------------------------- Acciones -------------------------------- */

export async function startTimer(args: {
  date: string;
  sectionId: string;
  row: number;
  cols: TimerColumns;
}): Promise<void> {
  // El clic de ▶ es el gesto que desbloquea el audio: hay que llamarlo antes de
  // cualquier `await`.
  unlockAudio();
  if (active || busy) return;
  busy = true;
  try {
    await ensureCellsLoaded(args.date, args.sectionId);
    if (active) return;
    const { cols, row } = args;
    const values = peekCells(args.date, args.sectionId) ?? {};
    const plannedMin = parseEsp(values[cellId(cols.esp, row)]);
    if (plannedMin === null) return;

    const now = Date.now();
    const t = createTimer({
      id: newId(),
      date: args.date,
      sectionId: args.sectionId,
      cols,
      row,
      plannedMs: plannedMin * 60_000,
      label: (values[cellId(cols.label, row)] ?? "").trim(),
      prev: {
        ti: values[cellId(cols.ti, row)],
        tf: values[cellId(cols.tf, row)],
        real: values[cellId(cols.real, row)],
      },
      owner: TAB_ID,
      now,
    });
    commit(t);
    armChime();
    void patchCells(t.date, t.sectionId, startPatch(t), { immediate: true });
  } finally {
    busy = false;
  }
}

/**
 * Cronómetro libre: cuenta hacia arriba, sin fila ni celdas. Al detenerlo sale el
 * aviso con el tiempo de descanso sugerido. Comparte el "único timer activo".
 */
export function startStopwatch(): void {
  if (active || busy) return;
  const now = Date.now();
  commit(createStopwatch({ id: newId(), date: todayISO(), owner: TAB_ID, now }));
}

export function pauseTimer(): void {
  if (!active) return;
  commit(pauseCore(active, Date.now()));
  armChime();
}

export function resumeTimer(): void {
  if (!active) return;
  unlockAudio();
  commit(resumeCore(active, Date.now(), TAB_ID));
  armChime();
}

export function toggleTimer(): void {
  if (!active) return;
  if (active.status === "running") pauseTimer();
  else resumeTimer();
}

/**
 * Termina el temporizador. Con menos de 10 s de tiempo activo se descarta
 * (arranque accidental): se restauran los valores previos, no se guarda sesión y
 * no sale aviso. En cualquier otro caso (y siempre con el cronómetro libre) se
 * guarda la sesión y sale el aviso "Tiempo finalizado" con el descanso sugerido.
 */
export function finishTimer(): void {
  const t = active;
  if (!t) return;
  const now = Date.now();
  const res = finishCore(t, now);
  active = null;
  cancelChime();
  emit();
  void clearActiveTimer();
  channel?.postMessage("changed");

  if (res.kind === "free") {
    void addSession(res.session).then((ok) => {
      if (!ok) markError();
    });
    openTimeUp({ kind: "free", workedMs: res.session.activeMs });
    return;
  }

  void patchCells(t.date, t.sectionId, res.patch, { immediate: true });

  if (res.kind === "finish") {
    void addSession(res.session).then((ok) => {
      if (!ok) markError();
    });
    // Al terminar (■) sale el mismo aviso que al llegar a 0, con el tiempo
    // realmente trabajado (sustituye al del cruce por 0 si seguía abierto).
    openTimeUp({
      kind: "task",
      timerId: t.id,
      workedMs: res.session.activeMs,
      date: t.date,
      sectionId: t.sectionId,
      row: t.row,
      cols: t.cols,
      label: t.label,
    });
  } else if (timeUp?.kind === "task" && timeUp.timerId === t.id) {
    // Arranque accidental descartado: no hubo sesión, así que no hay aviso.
    closeTimeUp();
  }
}

/* -------------------------------- Arranque -------------------------------- */

/**
 * Recupera el temporizador guardado (recarga / navegador cerrado). Si estaba
 * corriendo sigue por reloj de pared. Tras recargar el audio está bloqueado
 * hasta el primer gesto del usuario, así que el tono se reprograma entonces.
 */
export async function hydrateTimer(): Promise<void> {
  const saved = await getActiveTimer();
  active = saved;
  if (saved && saved.status === "running" && saved.owner !== TAB_ID) {
    // Esta pestaña adopta el tono (la última en cargar gana).
    active = { ...saved, owner: TAB_ID, updatedAt: Date.now() };
    persist(active);
  }
  emit();
  if (active) {
    armChime();
    document.addEventListener(
      "pointerdown",
      () => {
        unlockAudio();
        armChime();
      },
      { once: true, capture: true },
    );
  }
}

// Otra pestaña cambió el temporizador: releer la fila guardada.
channel?.addEventListener("message", () => {
  void getActiveTimer().then((saved) => {
    active = saved;
    emit();
    armChime(); // cancela si ya no somos el dueño o terminó
  });
});
