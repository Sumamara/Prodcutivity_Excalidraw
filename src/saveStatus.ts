import { useSyncExternalStore } from "react";

export type SaveStatus = "saved" | "pending" | "error";

interface State {
  status: SaveStatus;
  /** Marca de tiempo del último guardado correcto (ms), o null. */
  at: number | null;
}

let state: State = { status: "saved", at: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Hay cambios sin guardar (o reintentando tras un error). */
export function markPending(): void {
  if (state.status !== "pending") {
    state = { ...state, status: "pending" };
    emit();
  }
}

export function markSaved(): void {
  state = { status: "saved", at: Date.now() };
  emit();
}

export function markError(): void {
  if (state.status !== "error") {
    state = { ...state, status: "error" };
    emit();
  }
}

export function useSaveStatus(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
