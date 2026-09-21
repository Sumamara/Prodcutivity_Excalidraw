import { useSyncExternalStore } from "react";

import { todayISO } from "../dates";
import type { HHMM, ISODate } from "./habitCore";

/**
 * Reloj de 1 MINUTO para los hábitos ("Pendiente" depende de la hora, no del
 * segundero). Es distinto del reloj de 250 ms del temporizador: los ticks solo
 * re-renderizan a quien lo usa y nunca pasan por el estado de `App`.
 */

export interface MinuteNow {
  today: ISODate;
  hhmm: HHMM;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha y hora locales de este instante. */
export function readMinuteNow(): MinuteNow {
  const d = new Date();
  return { today: todayISO(), hhmm: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

let snapshot: MinuteNow = readMinuteNow();
const listeners = new Set<() => void>();
let timeout: ReturnType<typeof setTimeout> | null = null;

function refresh(): void {
  const next = readMinuteNow();
  if (next.today === snapshot.today && next.hhmm === snapshot.hhmm) return;
  snapshot = next; // objeto nuevo solo si cambió el minuto
  for (const l of listeners) l();
}

function schedule(): void {
  if (timeout !== null || listeners.size === 0) return;
  // Justo después del cambio de minuto (+300 ms).
  const delay = 60_000 - (Date.now() % 60_000) + 300;
  timeout = setTimeout(() => {
    timeout = null;
    refresh();
    schedule();
  }, delay);
}

function onVisibility(): void {
  if (!document.hidden) refresh();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) {
    refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    schedule();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    }
  };
}

/** Hoy y la hora (HH:MM) actuales; cambia una vez por minuto. */
export function useMinute(): MinuteNow {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
