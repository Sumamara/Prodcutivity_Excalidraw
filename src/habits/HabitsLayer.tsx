import { lazy, Suspense, useMemo, useState } from "react";

import { HB } from "../sections/HabitosTemplate";
import {
  MAX_ACTIVE,
  MONTH_NAMES,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  dayProgress,
  isActiveOn,
  parseISO,
  pausedHabits,
  resolveState,
  scheduleFor,
  sortHabits,
  streaks,
  weekdayOf,
  type DayState,
  type Habit,
  type ISODate,
  type LogMap,
  type Streaks,
} from "./habitCore";
import { HabitInfoPopover, InfoIcon } from "./HabitInfo";
import { useHabitSettings } from "./habitSettings";
import {
  cycleLog,
  logsOf,
  setHabitPaused,
  useHabitsSnapshot,
} from "./habitsStore";
import { useMinute } from "./minute";
import { notificationsBlocked, toggleReminders } from "./reminders";
import "./Habits.css";

const HabitDialog = lazy(() => import("./HabitDialog"));
const MonthViewLazy = lazy(() => import("./MonthView"));

const EMPTY_LOGS: LogMap = new Map();

interface Props {
  /** Día que se está viendo (ISO). */
  date: ISODate;
  onDateChange: (date: ISODate) => void;
}

type DialogTarget = { mode: "create" } | { mode: "edit"; id: string };

const STATE_LABEL: Record<DayState, string> = {
  done: "cumplido",
  partial: "a medias",
  missed: "no cumplido",
  late: "pendiente",
  pending: "sin marcar",
  future: "día futuro",
  off: "no toca",
};

/** `domingo 20 sep` (con `Hoy · ` delante si es hoy). */
function dateLine(date: ISODate, today: ISODate): string {
  const { d, m } = parseISO(date);
  const base = `${WEEKDAY_NAMES[weekdayOf(date)]} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
  return date === today ? `Hoy · ${base}` : base;
}

/** Texto de los días (`Diario`, `L X V`). */
function daysText(days: readonly number[] | null): string {
  if (!days || days.length === 7) return "Diario";
  return days.map((d) => WEEKDAY_LETTERS[d]).join(" ");
}

/**
 * Capa de la hoja de hábitos del día. Va anclada al viewport con el mismo
 * `transform` que la hoja y usa la geometría `HB` de la plantilla, así que las
 * filas siempre coinciden con la rejilla dibujada debajo.
 *
 * Rendimiento: el toque es OPTIMISTA (la tienda cambia la memoria y repinta al
 * instante); las rachas se calculan del historial en memoria y solo cuando cambia
 * la versión de la tienda, el día o el minuto.
 */
export function HabitsLayer({ date, onDateChange }: Props) {
  const snap = useHabitsSnapshot();
  const { today, hhmm } = useMinute();
  const settings = useHabitSettings();
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [info, setInfo] = useState<{ id: string; rect: DOMRect } | null>(null);
  const infoHabit = info ? snap.habits.find((h) => h.id === info.id) : undefined;

  const locked = date > today;

  // Hábitos que se ven ese día (existen y no están en pausa) ordenados por hora.
  const rows = useMemo(
    () => sortHabits(snap.habits.filter((h) => isActiveOn(h, date))).slice(0, HB.MAX_ROWS),
    [snap.v, date],
  );
  const paused = useMemo(
    () => pausedHabits(snap.habits, today),
    [snap.v, today],
  );
  const activeToday = useMemo(
    () => snap.habits.filter((h) => !paused.includes(h)).length,
    [snap.habits, paused],
  );

  const streakOf = useMemo(() => {
    const m = new Map<string, Streaks>();
    for (const h of rows) m.set(h.id, streaks(h, logsOf(h.id) ?? EMPTY_LOGS, today));
    return m;
  }, [rows, snap.v, today]);

  const progress = useMemo(
    () => dayProgress(rows, (id) => logsOf(id), date),
    [rows, snap.v, date],
  );

  if (!snap.loaded) return null;

  const canAdd = activeToday < MAX_ACTIVE;
  const pct = progress.pct === null ? null : Math.round(progress.pct * 100);
  const nameR = HB.cols.name[1];
  const rowStyle = (i: number) => ({
    left: HB.L,
    top: HB.ROW_T + i * HB.ROW_H,
    width: HB.R - HB.L,
    height: HB.ROW_H,
  });
  const colW = (c: keyof typeof HB.cols) => HB.cols[c][1] - HB.cols[c][0];
  const gridCols = (
    ["name", "time", "day", "streak", "best", "gear"] as const
  )
    .map((c) => `${colW(c)}px`)
    .join(" ");

  return (
    <div className="hb-layer">
      {/* ---- resumen del día + acciones ---- */}
      <div className="hb-summary" style={{ left: HB.L, top: 64, width: 500 }}>
        <div className="hb-date">{dateLine(date, today)}</div>
        <div className="hb-prog">
          {locked ? (
            <span className="hb-muted">Día futuro · solo lectura</span>
          ) : progress.total === 0 ? (
            <span className="hb-muted">Sin hábitos para este día</span>
          ) : (
            <>
              <b>{progress.done}</b> de {progress.total}
              {pct !== null && <> · {pct} %</>}
              <span className="hb-bar" aria-hidden="true">
                <span className="hb-bar-fill" style={{ width: `${pct ?? 0}%` }} />
              </span>
            </>
          )}
        </div>
      </div>

      <div className="hb-actions" style={{ right: 800 - HB.R, top: 64 }}>
        <button
          type="button"
          className="hb-icon-btn"
          data-on={settings.remindersEnabled || undefined}
          aria-pressed={settings.remindersEnabled}
          aria-label={
            settings.remindersEnabled
              ? "Desactivar recordatorios"
              : "Activar recordatorios"
          }
          title={
            settings.remindersEnabled
              ? notificationsBlocked()
                ? "Recordatorios activados (solo dentro de la app: el navegador bloqueó las notificaciones)"
                : "Recordatorios activados (tocar para desactivar)"
              : "Recordatorios desactivados (tocar para activar)"
          }
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void toggleReminders(!settings.remindersEnabled)}
        >
          <BellIcon off={!settings.remindersEnabled} />
        </button>
        <button
          type="button"
          className="hb-pill-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMonthOpen(true)}
        >
          Extender
        </button>
      </div>

      {/* ---- filas ---- */}
      {rows.map((h, i) => (
        <HabitRow
          key={h.id}
          habit={h}
          date={date}
          today={today}
          hhmm={hhmm}
          locked={locked}
          streak={streakOf.get(h.id)}
          style={rowStyle(i)}
          gridCols={gridCols}
          onEdit={() => setDialog({ mode: "edit", id: h.id })}
          onInfo={(rect) =>
            setInfo((cur) => (cur?.id === h.id ? null : { id: h.id, rect }))
          }
        />
      ))}

      {rows.length < HB.MAX_ROWS && canAdd && (
        <button
          type="button"
          className="hb-add"
          style={{
            left: HB.L + 10,
            top: HB.ROW_T + rows.length * HB.ROW_H + 10,
            width: nameR - HB.L - 20,
            height: HB.ROW_H - 20,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setDialog({ mode: "create" })}
        >
          + Añadir hábito
        </button>
      )}
      {rows.length === 0 && (
        <div
          className="hb-empty"
          style={{ left: HB.L, top: HB.ROW_T + HB.ROW_H + 8, width: HB.R - HB.L }}
        >
          Aún no hay hábitos. Crea el primero con «+ Añadir hábito».
        </div>
      )}

      {/* ---- en pausa ---- */}
      {paused.length > 0 && (
        <div className="hb-pause" style={{ left: HB.L, top: HB.PAUSE_T, height: HB.PAUSE_H }}>
          <button
            type="button"
            className="hb-pause-btn"
            aria-expanded={pauseOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPauseOpen((o) => !o)}
          >
            En pausa ({paused.length}) {pauseOpen ? "▴" : "▾"}
          </button>
          {pauseOpen && (
            <div className="hb-pause-list">
              {paused.map((h) => (
                <div className="hb-pause-item" key={h.id}>
                  <span className="hb-pause-name">{h.name}</span>
                  <button
                    type="button"
                    className="hb-mini-btn"
                    disabled={!canAdd}
                    title={canAdd ? "Reanudar" : "Ya hay 12 hábitos activos"}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setHabitPaused(h.id, false)}
                  >
                    Reanudar
                  </button>
                  <button
                    type="button"
                    className="hb-mini-btn"
                    aria-label={`Ajustes de ${h.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setDialog({ mode: "edit", id: h.id })}
                  >
                    ⚙
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {info && infoHabit && (
        <HabitInfoPopover
          rect={info.rect}
          name={infoHabit.name}
          description={infoHabit.description}
          onClose={() => setInfo(null)}
          onEdit={() => {
            setInfo(null);
            setDialog({ mode: "edit", id: infoHabit.id });
          }}
        />
      )}

      {dialog && (
        <Suspense fallback={null}>
          <HabitDialog target={dialog} onClose={() => setDialog(null)} />
        </Suspense>
      )}
      {monthOpen && (
        <Suspense fallback={null}>
          <MonthViewLazy
            date={date}
            onClose={() => setMonthOpen(false)}
            onPickDate={(d) => {
              onDateChange(d);
              setMonthOpen(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ---------------------------------- Fila ---------------------------------- */

function HabitRow({
  habit,
  date,
  today,
  hhmm,
  locked,
  streak,
  style,
  gridCols,
  onEdit,
  onInfo,
}: {
  habit: Habit;
  date: ISODate;
  today: ISODate;
  hhmm: string;
  locked: boolean;
  streak: Streaks | undefined;
  style: { left: number; top: number; width: number; height: number };
  gridCols: string;
  onEdit: () => void;
  onInfo: (rect: DOMRect) => void;
}) {
  const log = logsOf(habit.id)?.get(date);
  const state = resolveState(habit, date, log, today, hhmm);
  const tappable = state !== "off" && state !== "future" && !locked;
  const days = scheduleFor(habit, date);

  return (
    <div
      className="hb-row"
      data-state={state}
      style={{ ...style, gridTemplateColumns: gridCols }}
    >
      <button
        type="button"
        className="hb-cell hb-name hb-name-btn"
        aria-label={`Descripción de ${habit.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onInfo(e.currentTarget.getBoundingClientRect())}
      >
        <span className="hb-name-line">
          <span className="hb-name-text">{habit.name}</span>
          {habit.description && <InfoIcon className="hb-info" />}
        </span>
        <span className="hb-sub">
          {daysText(days)}
          {habit.remind && <BellMini />}
        </span>
      </button>

      <div className="hb-cell hb-time">{habit.time ?? "—"}</div>

      <div className="hb-cell hb-daycell">
        <button
          type="button"
          className="hb-day"
          data-state={state}
          disabled={!tappable}
          aria-label={`${habit.name}: ${STATE_LABEL[state]}${tappable ? ". Tocar para cambiar" : ""}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => cycleLog(habit.id, date)}
        >
          <StateGlyph state={state} />
        </button>
      </div>

      <div className="hb-cell hb-num" aria-label={`Racha ${streak?.current ?? 0} días`}>
        {streak?.current ?? 0}
      </div>
      <div className="hb-cell hb-num hb-num-best" aria-label={`Récord ${streak?.best ?? 0} días`}>
        {streak?.best ?? 0}
      </div>

      <div className="hb-cell hb-gearcell">
        <button
          type="button"
          className="hb-gear"
          aria-label={`Ajustes de ${habit.name}`}
          title="Ajustes"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onEdit}
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Iconos/estados ---------------------------- */

function StateGlyph({ state }: { state: DayState }) {
  switch (state) {
    case "done":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.6 4.6L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "partial":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 13.2C6 6.8 9.6 6.8 12 12s6 5.2 8.5-1.2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case "missed":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "late":
      return <span className="hb-late">Pendiente</span>;
    case "off":
      return <span className="hb-off">no toca</span>;
    default:
      return null;
  }
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.4c.05-.33.1-.66.1-1s-.04-.67-.1-1l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5c-.6.24-1.2.58-1.7 1l-2.4-.9-2 3.4 2 1.6c-.05.33-.1.66-.1 1s.04.67.1 1l-2 1.6 2 3.4 2.4-.9c.5.42 1.1.76 1.7 1l.4 2.5h4l.4-2.5c.6-.24 1.2-.58 1.7-1l2.4.9 2-3.4-2-1.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 20.5a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {off && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

function BellMini() {
  return (
    <svg className="hb-bellmini" viewBox="0 0 24 24" aria-label="Con recordatorio">
      <path
        d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 20.5a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
