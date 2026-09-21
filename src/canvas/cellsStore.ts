import { useEffect, useSyncExternalStore } from "react";

import { markError, markPending, markSaved } from "../saveStatus";
import type { CellPatch } from "../timer/timerCore";
import { getCells, patchCellsRow } from "./db";

/**
 * Almacén de los campos de celda: ÚNICO punto de lectura y escritura.
 *
 * - Caché en memoria por (fecha, sección) con suscriptores (`useCellValues`).
 * - Las escrituras a IndexedDB van por PARCHES en una transacción (ver
 *   `patchCellsRow`), serializadas por hoja: el teclado (CellFields) y el
 *   temporizador pueden escribir a la vez, incluso en una hoja que no está
 *   montada, sin pisarse.
 * - Varias pestañas: tras cada escritura se avisa por BroadcastChannel y las
 *   demás pestañas releen esa hoja (si no tienen cambios pendientes).
 */

export type CellValues = Readonly<Record<string, string>>;

const WRITE_DEBOUNCE_MS = 500;

interface Entry {
  key: string;
  date: string;
  section: string;
  /** `null` = aún no cargado. Objeto inmutable: se reemplaza en cada cambio. */
  values: CellValues | null;
  loading: Promise<void> | null;
  listeners: Set<() => void>;
  subscribe: (cb: () => void) => () => void;
  /** Parche acumulado que aún no se ha escrito. */
  pending: CellPatch;
  timer: ReturnType<typeof setTimeout> | null;
  /** Cola serializada de escrituras de esta hoja. */
  chain: Promise<void>;
}

const entries = new Map<string, Entry>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("journal-cells")
    : null;

function getEntry(date: string, section: string): Entry {
  const key = `${date}::${section}`;
  let e = entries.get(key);
  if (!e) {
    const listeners = new Set<() => void>();
    e = {
      key,
      date,
      section,
      values: null,
      loading: null,
      listeners,
      subscribe: (cb) => {
        listeners.add(cb);
        return () => {
          listeners.delete(cb);
        };
      },
      pending: {},
      timer: null,
      chain: Promise.resolve(),
    };
    entries.set(key, e);
  }
  return e;
}

function emit(e: Entry): void {
  for (const l of e.listeners) l();
}

function hasPending(e: Entry): boolean {
  return e.timer !== null || Object.keys(e.pending).length > 0;
}

/** Carga la hoja en la caché (una sola vez). */
export function ensureCellsLoaded(date: string, section: string): Promise<void> {
  const e = getEntry(date, section);
  if (e.values !== null) return Promise.resolve();
  if (!e.loading) {
    e.loading = getCells(date, section).then((v) => {
      // Un parche llegado durante la carga espera a `ensureCellsLoaded`, así que
      // aquí la caché aún no tiene cambios locales que proteger.
      e.values = v;
      e.loading = null;
      emit(e);
    });
  }
  return e.loading;
}

/** Valores ya cargados (sincrónico) o `null` si la hoja aún no se ha leído. */
export function peekCells(date: string, section: string): CellValues | null {
  return getEntry(date, section).values;
}

/**
 * Lee los valores (cargando si hace falta). Devuelve `null` hasta que están
 * disponibles.
 */
export function useCellValues(date: string, section: string): CellValues | null {
  const e = getEntry(date, section);
  useEffect(() => {
    void ensureCellsLoaded(date, section);
  }, [date, section]);
  return useSyncExternalStore(
    e.subscribe,
    () => e.values,
    () => e.values,
  );
}

function flushEntry(e: Entry): void {
  if (e.timer !== null) {
    clearTimeout(e.timer);
    e.timer = null;
  }
  const patch = e.pending;
  if (Object.keys(patch).length === 0) return;
  e.pending = {};
  e.chain = e.chain
    .then(() => patchCellsRow(e.date, e.section, patch))
    .then((ok) => {
      if (!ok) {
        markError();
        return;
      }
      if (!hasPending(e)) markSaved();
      channel?.postMessage(e.key);
    });
}

/** Escribe ya lo pendiente de una hoja (p. ej. al salir de una celda). */
export function flushCells(date: string, section: string): void {
  flushEntry(getEntry(date, section));
}

/** Escribe ya todo lo pendiente (al cerrar/ocultar la pestaña). */
export function flushAllCells(): void {
  for (const e of entries.values()) flushEntry(e);
}

/**
 * Aplica un parche de celdas (`null` o "" vacía la celda). La caché se actualiza
 * al instante (si la hoja ya estaba cargada) y la escritura a IndexedDB se
 * agrupa con un debounce, salvo `immediate` (temporizador, salir de una celda).
 */
export async function patchCells(
  date: string,
  section: string,
  patch: CellPatch,
  opts: { immediate?: boolean } = {},
): Promise<void> {
  const e = getEntry(date, section);
  if (e.values === null) await ensureCellsLoaded(date, section);

  const next: Record<string, string> = { ...(e.values ?? {}) };
  for (const [id, v] of Object.entries(patch)) {
    if (v === null || v === "") delete next[id];
    else next[id] = v;
  }
  e.values = next;
  emit(e);

  Object.assign(e.pending, patch);
  markPending();
  if (opts.immediate) {
    flushEntry(e);
  } else {
    if (e.timer !== null) clearTimeout(e.timer);
    e.timer = setTimeout(() => flushEntry(e), WRITE_DEBOUNCE_MS);
  }
}

/* --------------------------- Coherencia entre pestañas -------------------- */

channel?.addEventListener("message", (ev: MessageEvent<unknown>) => {
  const e = typeof ev.data === "string" ? entries.get(ev.data) : undefined;
  // Solo relee hojas ya cargadas y sin cambios locales pendientes.
  if (!e || e.values === null || hasPending(e)) return;
  void getCells(e.date, e.section).then((v) => {
    if (hasPending(e)) return;
    e.values = v;
    emit(e);
  });
});

/* -------------------------------- Ciclo de vida --------------------------- */

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAllCells);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAllCells();
  });
}
