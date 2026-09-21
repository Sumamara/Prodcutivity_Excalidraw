import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useTimeUp } from "../timer/timerStore";
import { useHabitsSnapshot } from "./habitsStore";
import {
  SNOOZE_MINUTES,
  completeFromReminder,
  dismissReminder,
  snoozeFromReminder,
  startReminderEngine,
  useReminder,
} from "./reminders";
import "../canvas/MoodMeter.css"; // reutiliza el modal (.mm-backdrop/.mm-panel/…)
import "./Habits.css";

/**
 * Anfitrión global de los recordatorios: arranca el planificador y pinta el popup
 * "Recuerda tu hábito". Si hay abierto el aviso "Tiempo finalizado" del temporizador,
 * espera a que se cierre para no apilar ventanas.
 */
export function ReminderHost() {
  useEffect(() => startReminderEngine(), []);

  const info = useReminder();
  const timeUp = useTimeUp();
  const snap = useHabitsSnapshot();
  if (!info || timeUp) return null;

  const habits = info.habitIds
    .map((id) => snap.habits.find((h) => h.id === id))
    .filter((h): h is NonNullable<typeof h> => !!h);
  if (!habits.length) return null;

  return createPortal(
    <ReminderDialog kind={info.kind} habits={habits} />,
    document.body,
  );
}

function ReminderDialog({
  kind,
  habits,
}: {
  kind: "due" | "missed";
  habits: { id: string; name: string; time?: string }[];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissReminder();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mm-backdrop" onPointerDown={dismissReminder}>
      <div
        className="mm-panel rm-dlg"
        role="alertdialog"
        aria-label="Recuerda tu hábito"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head rm-head">
          <span className="rm-bell" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 20.5a2 2 0 0 0 4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <strong>Recuerda tu hábito</strong>
          <button
            type="button"
            className="mm-x"
            onClick={dismissReminder}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="rm-body">
          {kind === "missed" && (
            <p className="rm-sub">Se te pasó la hora de:</p>
          )}
          {habits.map((h) => (
            <div className="rm-item" key={h.id}>
              <div className="rm-item-txt">
                <span className="rm-name" title={h.name}>
                  {h.name}
                </span>
                {h.time && <span className="rm-time">{h.time}</span>}
              </div>
              <div className="rm-actions">
                <button
                  type="button"
                  className="rm-btn"
                  title={`Recordar en ${SNOOZE_MINUTES} minutos`}
                  onClick={() => snoozeFromReminder(h.id)}
                >
                  Luego
                </button>
                <button
                  type="button"
                  className="rm-btn rm-btn-done"
                  onClick={() => completeFromReminder(h.id)}
                >
                  Hecho ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
