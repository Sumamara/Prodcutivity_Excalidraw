import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { todayISO } from "../dates";
import {
  ALL_DAYS,
  DESC_MAX,
  MAX_ACTIVE,
  NAME_MAX,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  isPausedOn,
  isValidTime,
  sanitizeName,
  scheduleFor,
} from "./habitCore";
import { useHabitSettings } from "./habitSettings";
import { requestNotificationPermission } from "./reminders";
import {
  addHabit,
  getHabit,
  removeHabit,
  setHabitPaused,
  updateHabit,
} from "./habitsStore";
import "../canvas/MoodMeter.css"; // reutiliza el modal (.mm-backdrop/.mm-panel/…)
import "./Habits.css";

/** Guía en gris del campo: qué escribir. */
const DESC_PLACEHOLDER =
  "Propósito: por qué lo hago\nVersión mínima: lo mínimo en un mal día\nVersión completa: cómo se ve hecho del todo";

type Target = { mode: "create" } | { mode: "edit"; id: string };

/**
 * Diálogo del engrane: crear o editar un hábito (nombre, hora recomendada, días
 * de la semana, recordatorio), pausar/reanudar y eliminar. Se carga bajo demanda.
 */
export default function HabitDialog({
  target,
  onClose,
}: {
  target: Target;
  onClose: () => void;
}) {
  const editing = target.mode === "edit" ? getHabit(target.id) : undefined;
  const today = todayISO();
  const settings = useHabitSettings();

  const [name, setName] = useState(editing?.name ?? "");
  const [time, setTime] = useState(editing?.time ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [days, setDays] = useState<number[]>(() =>
    editing ? [...(scheduleFor(editing, today) ?? ALL_DAYS)] : [...ALL_DAYS],
  );
  const [remind, setRemind] = useState(editing?.remind ?? false);
  // Si el hábito aún no tenía hora, al ponérsela se activa el recordatorio (lo
  // esperable al fijar una hora); el usuario puede desmarcarlo.
  const remindTouched = useRef(false);
  const hadTime = !!editing?.time;
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const paused = editing ? isPausedOn(editing, today) : false;
  const hasTime = isValidTime(time);

  useEffect(() => {
    // El hábito desapareció (p. ej. se eliminó en otra pestaña): cerrar.
    if (target.mode === "edit" && !editing) onClose();
  }, [target, editing, onClose]);

  useEffect(() => {
    if (target.mode === "create") nameRef.current?.focus();
  }, [target.mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleDay = (d: number) => {
    setDays((cur) => {
      const has = cur.includes(d);
      if (has && cur.length === 1) return cur; // al menos un día
      return has ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    });
  };

  const save = () => {
    const n = sanitizeName(name);
    if (!n) {
      setError("Escribe un nombre para el hábito.");
      nameRef.current?.focus();
      return;
    }
    const t = isValidTime(time) ? time : null;
    const wantRemind = remind && !!t;
    // Este envío es un gesto del usuario: momento válido para pedir el permiso
    // de notificaciones del navegador (si se deniega, quedan los popups de la app).
    if (wantRemind) requestNotificationPermission();
    if (editing) {
      if (!updateHabit(editing.id, { name: n, time: t, description, days, remind: wantRemind })) {
        setError("No se pudo guardar.");
        return;
      }
    } else if (!addHabit({ name: n, time: t, description, days, remind: wantRemind })) {
      setError(`Ya hay ${MAX_ACTIVE} hábitos activos. Pausa o elimina uno.`);
      return;
    }
    onClose();
  };

  const togglePause = () => {
    if (!editing) return;
    if (!setHabitPaused(editing.id, !paused)) {
      setError(`Ya hay ${MAX_ACTIVE} hábitos activos. Pausa o elimina uno.`);
      return;
    }
    onClose();
  };

  const del = () => {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeHabit(editing.id);
    onClose();
  };

  return createPortal(
    <div className="mm-backdrop" onPointerDown={onClose}>
      <form
        className="mm-panel hb-dlg"
        role="dialog"
        aria-label={editing ? `Ajustes de ${editing.name}` : "Nuevo hábito"}
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="mm-head hb-dlg-head">
          <strong>{editing ? "Ajustes del hábito" : "Nuevo hábito"}</strong>
          <button type="button" className="mm-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="hb-dlg-body">
          <label className="hb-field">
            <span>Nombre</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              maxLength={NAME_MAX}
              placeholder="Ej. Meditar 10 min"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </label>

          <label className="hb-field">
            <span>Descripción (opcional)</span>
            <textarea
              className="hb-desc-input"
              rows={5}
              value={description}
              maxLength={DESC_MAX}
              placeholder={DESC_PLACEHOLDER}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small className="hb-hint hb-count">
              {description.length}/{DESC_MAX}
            </small>
          </label>

          <div className="hb-field">
            <span>Hora recomendada</span>
            <div className="hb-time-row">
              <input
                type="time"
                value={time}
                aria-label="Hora recomendada"
                onChange={(e) => {
                  const v = e.target.value;
                  setTime(v);
                  if (!v) setRemind(false);
                  else if (!hadTime && !remindTouched.current) setRemind(true);
                }}
              />
              {time && (
                <button
                  type="button"
                  className="hb-link"
                  onClick={() => {
                    setTime("");
                    setRemind(false);
                  }}
                >
                  Quitar hora
                </button>
              )}
            </div>
          </div>

          <div className="hb-field">
            <span>Días</span>
            <div className="hb-days" role="group" aria-label="Días de la semana">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="hb-chip"
                  aria-pressed={days.includes(d)}
                  title={WEEKDAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                >
                  {WEEKDAY_LETTERS[d]}
                </button>
              ))}
              <button
                type="button"
                className="hb-link"
                onClick={() => setDays([...ALL_DAYS])}
                disabled={days.length === 7}
              >
                Todos
              </button>
            </div>
            {editing && (
              <small className="hb-hint">
                Los cambios de días aplican desde hoy; el pasado no se modifica.
              </small>
            )}
          </div>

          <label className={`hb-check${hasTime ? "" : " hb-disabled"}`}>
            <input
              type="checkbox"
              checked={remind && hasTime}
              disabled={!hasTime}
              onChange={(e) => {
                remindTouched.current = true;
                setRemind(e.target.checked);
              }}
            />
            <span>
              Recordarme a esa hora
              {!hasTime && <small className="hb-hint"> · pon una hora primero</small>}
            </span>
          </label>
          {remind && hasTime && !settings.remindersEnabled && (
            <small className="hb-hint hb-warn">
              Los recordatorios están desactivados: enciende la campana 🔔 de la hoja para
              que avisen.
            </small>
          )}

          {error && (
            <div className="hb-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="hb-dlg-foot">
          {editing && (
            <div className="hb-dlg-side">
              <button type="button" className="hb-btn" onClick={togglePause}>
                {paused ? "Reanudar" : "Pausar"}
              </button>
              <button
                type="button"
                className={`hb-btn hb-btn-danger${confirmDelete ? " hb-armed" : ""}`}
                onClick={del}
              >
                {confirmDelete ? "¿Seguro? Eliminar" : "Eliminar"}
              </button>
            </div>
          )}
          <div className="hb-dlg-main">
            <button type="button" className="hb-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="hb-btn hb-btn-primary">
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
