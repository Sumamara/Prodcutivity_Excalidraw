import { useSyncExternalStore } from "react";

import { SNOOZE_DEFAULT, normalizeSnooze } from "./habitCore";

/**
 * Ajustes globales de los hábitos (en `localStorage`, como las herramientas).
 * Por ahora: el interruptor general de recordatorios (la campana), ACTIVADO por
 * defecto: cada hábito decide si avisa (casilla del engrane) y los popups dentro
 * de la app no necesitan permisos.
 */

const KEY = "journal-horas:habits:settings:v1";

export interface HabitSettings {
  /** Interruptor general de los recordatorios (por defecto activado). */
  remindersEnabled: boolean;
  /** Últimos minutos elegidos en "Luego" (se resalta la próxima vez). */
  snoozeMinutes: number;
}

function load(): HabitSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<HabitSettings>;
      return {
        remindersEnabled: p.remindersEnabled !== false,
        snoozeMinutes: normalizeSnooze(p.snoozeMinutes),
      };
    }
  } catch {
    /* noop */
  }
  return { remindersEnabled: true, snoozeMinutes: SNOOZE_DEFAULT };
}

let state: HabitSettings = load();
const listeners = new Set<() => void>();

function commit(next: HabitSettings): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  for (const l of listeners) l();
}

export function getHabitSettings(): HabitSettings {
  return state;
}

export function setRemindersEnabled(on: boolean): void {
  if (state.remindersEnabled !== on) commit({ ...state, remindersEnabled: on });
}

export function setSnoozeMinutes(n: number): void {
  const v = normalizeSnooze(n);
  if (state.snoozeMinutes !== v) commit({ ...state, snoozeMinutes: v });
}

export function subscribeHabitSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useHabitSettings(): HabitSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state,
  );
}

// Otra pestaña cambió el ajuste: sincronizar.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = load();
      for (const l of listeners) l();
    }
  });
}
