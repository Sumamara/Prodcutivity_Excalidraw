import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useTimeUp } from "../timer/timerStore";
import { SNOOZE_MAX, SNOOZE_PRESETS, parseSnoozeMinutes } from "./habitCore";
import { useHabitSettings } from "./habitSettings";
import { useHabitsSnapshot } from "./habitsStore";
import {
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
            <ReminderItem key={h.id} habit={h} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Una fila del aviso. "Luego" no pospone de golpe: despliega los minutos (fichas
 * rápidas + "Otro" con un campo numérico). La última elección queda resaltada.
 */
function ReminderItem({ habit }: { habit: { id: string; name: string; time?: string } }) {
  const { snoozeMinutes: last } = useHabitSettings();
  const [mode, setMode] = useState<"idle" | "pick" | "custom">("idle");
  const [text, setText] = useState("");
  const custom = parseSnoozeMinutes(text);
  const lastIsCustom = !SNOOZE_PRESETS.includes(last);

  const snooze = (m: number) => snoozeFromReminder(habit.id, m);

  return (
    <div className="rm-item">
      <div className="rm-item-txt">
        <span className="rm-name" title={habit.name}>
          {habit.name}
        </span>
        {habit.time && <span className="rm-time">{habit.time}</span>}
      </div>
      <div className="rm-actions">
        <button
          type="button"
          className="rm-btn"
          aria-expanded={mode !== "idle"}
          title="Elegir en cuántos minutos recordar"
          onClick={() => setMode((m) => (m === "idle" ? "pick" : "idle"))}
        >
          Luego
        </button>
        <button
          type="button"
          className="rm-btn rm-btn-done"
          onClick={() => completeFromReminder(habit.id)}
        >
          Hecho ✓
        </button>
      </div>

      {mode === "pick" && (
        <div className="rm-pick" role="group" aria-label="Recordar en cuántos minutos">
          <span className="rm-pick-lead">Recordar en (min)</span>
          <div className="rm-chips">
            {SNOOZE_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className="rm-chip"
                aria-pressed={m === last}
                onClick={() => snooze(m)}
              >
                {m}
              </button>
            ))}
            {lastIsCustom && (
              <button
                type="button"
                className="rm-chip"
                aria-pressed="true"
                onClick={() => snooze(last)}
              >
                {last}
              </button>
            )}
            <button
              type="button"
              className="rm-chip rm-chip-other"
              onClick={() => {
                setText(lastIsCustom ? String(last) : "");
                setMode("custom");
              }}
            >
              Otro…
            </button>
          </div>
        </div>
      )}

      {mode === "custom" && (
        <form
          className="rm-pick rm-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom !== null) snooze(custom);
          }}
        >
          <span className="rm-pick-lead">Recordar en</span>
          <input
            className="rm-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            autoFocus
            value={text}
            placeholder="min"
            aria-label={`Minutos (1 a ${SNOOZE_MAX})`}
            onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // Solo cierra el campo, no todo el aviso.
                e.nativeEvent.stopPropagation();
                setMode("pick");
              }
            }}
          />
          <span className="rm-unit">min</span>
          <button type="submit" className="rm-btn rm-btn-done" disabled={custom === null}>
            OK
          </button>
          <button type="button" className="rm-btn" onClick={() => setMode("pick")}>
            Atrás
          </button>
          <span className={`rm-range${text && custom === null ? " rm-bad" : ""}`}>
            1 a {SNOOZE_MAX}
          </span>
        </form>
      )}
    </div>
  );
}
