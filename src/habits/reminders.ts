import { useSyncExternalStore } from "react";

import {
  SNOOZE_DEFAULT,
  dueReminders,
  effectiveFired,
  minutesBetween,
  type ISODate,
} from "./habitCore";
import {
  getHabitSettings,
  setRemindersEnabled,
  setSnoozeMinutes,
  subscribeHabitSettings,
} from "./habitSettings";
import {
  getHabitsSnapshot,
  logsOf,
  setLog,
  subscribeHabits,
} from "./habitsStore";
import { readMinuteNow } from "./minute";

/**
 * Recordatorios de hábitos (dentro de la app + notificación del navegador).
 *
 * Límites reales: sin servidor no se puede avisar con el navegador o la pestaña
 * cerrados. Con la pestaña ABIERTA (aunque esté en segundo plano y con permiso)
 * sale el popup y/o la notificación. Los navegadores limitan los temporizadores
 * de pestañas ocultas (hasta ~1 vez por minuto), por eso se recalcula también al
 * volver a la pestaña.
 *
 * Reglas:
 *  - Un aviso por hábito y día como máximo (registro `fired` en localStorage, que
 *    comparten todas las pestañas) + un candado (Web Locks) para no duplicar.
 *  - "Luego" deja elegir cuántos minutos (5/10/15/30/60 o cualquiera de 1 a 240);
 *    "×" lo descarta por hoy.
 *  - Al abrir la app o volver a la pestaña, los vencidos sin mostrar salen UNA vez
 *    ("Se te pasó la hora").
 */

/** Un aviso con más de estos minutos de retraso se considera "se te pasó". */
const ON_TIME_MINUTES = 2;

const FIRED_KEY = "journal-horas:habits:fired:v1";

interface FiredState {
  date: ISODate;
  ids: string[];
  /** habitId → hora (HH:MM) a la que se avisó: si cambia la hora, vuelve a avisar. */
  times: Record<string, string>;
  /** habitId → epoch ms hasta el que está pospuesto. */
  snooze: Record<string, number>;
}

function loadFired(today: ISODate): FiredState {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<FiredState>;
      if (p.date === today) {
        return { date: today, ids: p.ids ?? [], times: p.times ?? {}, snooze: p.snooze ?? {} };
      }
    }
  } catch {
    /* noop */
  }
  return { date: today, ids: [], times: {}, snooze: {} };
}

function saveFired(state: FiredState): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

/* --------------------------- Aviso abierto (estado) ------------------------- */

export type ReminderKind = "due" | "missed";

export interface ReminderInfo {
  kind: ReminderKind;
  habitIds: string[];
}

let info: ReminderInfo | null = null;
const listeners = new Set<() => void>();

function setInfo(next: ReminderInfo | null): void {
  info = next;
  for (const l of listeners) l();
}

export function useReminder(): ReminderInfo | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => info,
    () => info,
  );
}

/** Quita un hábito de la lista abierta; si no queda ninguno, cierra el aviso. */
function removeFromInfo(id: string): void {
  if (!info) return;
  const rest = info.habitIds.filter((h) => h !== id);
  setInfo(rest.length ? { ...info, habitIds: rest } : null);
}

/** "×": cierra el aviso (los hábitos ya quedaron como avisados hoy). */
export function dismissReminder(): void {
  setInfo(null);
}

/** "Hecho ✓": marca el hábito de hoy como cumplido. */
export function completeFromReminder(habitId: string): void {
  setLog(habitId, readMinuteNow().today, "done");
  removeFromInfo(habitId);
}

/**
 * "Luego": vuelve a avisar dentro de `minutes` (si sigue sin marcar). Recuerda la
 * elección para resaltarla la próxima vez.
 */
export function snoozeFromReminder(
  habitId: string,
  minutes: number = SNOOZE_DEFAULT,
): void {
  const mins = Math.max(1, Math.round(minutes));
  setSnoozeMinutes(mins);
  const { today } = readMinuteNow();
  const st = loadFired(today);
  st.ids = st.ids.filter((id) => id !== habitId);
  delete st.times[habitId];
  st.snooze[habitId] = Date.now() + mins * 60_000;
  saveFired(st);
  removeFromInfo(habitId);
}

/* ------------------------------ Interruptor general ------------------------- */

/**
 * Activa o desactiva TODOS los recordatorios. Al activar por primera vez pide el
 * permiso de notificaciones del navegador (este clic es el gesto que lo permite);
 * si se deniega, siguen funcionando los popups dentro de la app.
 */
export async function toggleReminders(on: boolean): Promise<void> {
  setRemindersEnabled(on);
  if (!on) return;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* noop */
  }
}

/**
 * Pide el permiso de notificaciones si aún no se decidió. Llamar dentro de un
 * gesto del usuario (p. ej. al guardar un hábito con recordatorio).
 */
export function requestNotificationPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* noop */
  }
}

/** ¿El navegador bloqueó las notificaciones? (para explicarlo en el tooltip) */
export function notificationsBlocked(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "denied";
}

/* ---------------------------------- Motor ---------------------------------- */

function notify(names: string[]): void {
  try {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      document.visibilityState !== "hidden"
    ) {
      return;
    }
    const n = new Notification("Recuerda tu hábito", {
      body: names.join(" · "),
      tag: "habit-reminder",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* noop */
  }
}

/** Calcula y dispara los recordatorios vencidos (a lo sumo un aviso a la vez). */
function evaluate(): void {
  if (!getHabitSettings().remindersEnabled) return;
  const snap = getHabitsSnapshot();
  if (!snap.loaded || info) return;

  const run = () => {
    // Se relee dentro del candado: otra pestaña pudo avisar mientras esperábamos.
    const { today, hhmm } = readMinuteNow();
    const st = loadFired(today);
    const nowMs = Date.now();
    const due = dueReminders({
      habits: getHabitsSnapshot().habits,
      logsOf,
      today,
      nowHHMM: hhmm,
      fired: effectiveFired(getHabitsSnapshot().habits, st.ids, st.times),
    }).filter((h) => (st.snooze[h.id] ?? 0) <= nowMs);
    if (!due.length) return;

    for (const h of due) {
      if (!st.ids.includes(h.id)) st.ids.push(h.id);
      if (h.time) st.times[h.id] = h.time;
      delete st.snooze[h.id];
    }
    saveFired(st);

    const onTime = due.every(
      (h) => !h.time || minutesBetween(h.time, hhmm) <= ON_TIME_MINUTES,
    );
    setInfo({ kind: onTime ? "due" : "missed", habitIds: due.map((h) => h.id) });
    notify(due.map((h) => h.name));
  };

  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks) {
    void locks.request("journal-habit-fire", { ifAvailable: true }, (lock) => {
      if (lock) run();
    });
  } else {
    run();
  }
}

/** Arranca el planificador. Devuelve la función que lo detiene. */
export function startReminderEngine(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    evaluate();
    // Justo después del cambio de minuto (+1 s).
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 1000);
  };
  const onWake = () => {
    if (document.visibilityState === "visible") evaluate();
  };

  const offHabits = subscribeHabits(evaluate);
  const offSettings = subscribeHabitSettings(evaluate);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  tick();

  return () => {
    if (timer !== null) clearTimeout(timer);
    offHabits();
    offSettings();
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  };
}
