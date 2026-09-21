import { useSyncExternalStore } from "react";

/**
 * Reloj único compartido. Un solo `setTimeout` alineado a pasos de 250 ms
 * para toda la app, activo únicamente mientras haya suscriptores (contador y
 * vigilante del aviso de fin de tiempo). Al volver a una pestaña oculta se recalcula al instante.
 *
 * IMPORTANTE: los ticks NUNCA deben pasar por el estado de `App` (re-renderizaría
 * toda la interfaz varias veces por segundo); solo los componentes del temporizador lo usan.
 */

let now = Date.now();
const listeners = new Set<() => void>();
let timeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Paso del reloj. Se avanza cada 250 ms (alineado) en vez de cada segundo: el
 * segundero de cada temporizador tiene su propia fase, y con un tick por segundo
 * el número mostrado podía ir hasta ~1 s por detrás. Solo se re-renderizan el
 * contador y el vigilante del aviso (no la hoja ni `App`).
 */
const STEP_MS = 250;

function schedule(): void {
  if (timeout !== null || listeners.size === 0) return;
  // Pequeño margen (+5 ms) para caer justo después del borde del paso.
  const delay = STEP_MS - (Date.now() % STEP_MS) + 5;
  timeout = setTimeout(() => {
    timeout = null;
    tick();
  }, delay);
}

function tick(): void {
  now = Date.now();
  for (const l of listeners) l();
  schedule();
}

function onVisibility(): void {
  if (document.hidden || listeners.size === 0) return;
  if (timeout !== null) {
    clearTimeout(timeout);
    timeout = null;
  }
  tick();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) {
    now = Date.now();
    document.addEventListener("visibilitychange", onVisibility);
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
    }
  };
}

/** Epoch ms del último tick (cambia cada 250 ms). */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
