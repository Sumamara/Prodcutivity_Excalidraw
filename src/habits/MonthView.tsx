import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  WEEKDAY_LETTERS,
  addMonths,
  completion,
  dayProgress,
  monthDays,
  monthLabel,
  monthStart,
  parseISO,
  resolveState,
  sortHabits,
  streaks,
  weekdayOf,
  type DayState,
  type ISODate,
  type LogMap,
} from "./habitCore";
import { cycleLog, logsOf, useHabitsSnapshot } from "./habitsStore";
import { useMinute } from "./minute";
import "../canvas/MoodMeter.css"; // reutiliza el modal (.mm-backdrop/.mm-panel/…)
import "./Habits.css";

const EMPTY: LogMap = new Map();

const STATE_LABEL: Record<DayState, string> = {
  done: "cumplido",
  partial: "a medias",
  missed: "no cumplido",
  "auto-missed": "no cumplido (automático)",
  late: "pendiente",
  pending: "sin marcar",
  future: "día futuro",
  off: "no toca",
};

/**
 * Vista del mes ("Extender"): hábitos × días con fechas automáticas, color por
 * estado, hoy resaltado, totales por día y por hábito. Tocar una celda (hasta
 * hoy) cambia su estado; tocar la cabecera de un día salta a ese día.
 */
export default function MonthView({
  date,
  onClose,
  onPickDate,
}: {
  date: ISODate;
  onClose: () => void;
  onPickDate: (d: ISODate) => void;
}) {
  const snap = useHabitsSnapshot();
  const { today, hhmm } = useMinute();
  const [month, setMonth] = useState<ISODate>(() => monthStart(date));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = useMemo(() => monthDays(month), [month]);
  const first = days[0];
  const last = days[days.length - 1];

  // Hábitos que existían durante ese mes.
  const habits = useMemo(
    () => sortHabits(snap.habits.filter((h) => h.createdOn <= last)),
    [snap.v, last],
  );

  const stats = useMemo(() => {
    return habits.map((h) => {
      const l = logsOf(h.id) ?? EMPTY;
      return { pct: completion(h, l, first, last, today).pct, ...streaks(h, l, today) };
    });
  }, [habits, snap.v, first, last, today]);

  const totals = useMemo(
    () => days.map((d) => dayProgress(habits, (id) => logsOf(id), d)),
    [days, habits, snap.v],
  );

  const isCurrentMonth = monthStart(today) === month;

  return createPortal(
    <div className="mm-backdrop" onPointerDown={onClose}>
      <div
        className="mm-panel mv-panel"
        role="dialog"
        aria-label={`Hábitos de ${monthLabel(month)}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head mv-head">
          <div className="mv-nav">
            <button
              type="button"
              className="mv-navbtn"
              aria-label="Mes anterior"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              ◀
            </button>
            <strong className="mv-title">{monthLabel(month)}</strong>
            <button
              type="button"
              className="mv-navbtn"
              aria-label="Mes siguiente"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              ▶
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                className="mv-today"
                onClick={() => setMonth(monthStart(today))}
              >
                Hoy
              </button>
            )}
          </div>
          <button type="button" className="mm-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="mv-scroll">
          {habits.length === 0 ? (
            <p className="mv-empty">Todavía no hay hábitos en este mes.</p>
          ) : (
            <table className="mv-table">
              <thead>
                <tr>
                  <th className="mv-namecol">Hábito</th>
                  {days.map((d) => {
                    const dow = weekdayOf(d);
                    return (
                      <th
                        key={d}
                        className="mv-dayhead"
                        data-today={d === today || undefined}
                        data-weekend={dow >= 5 || undefined}
                      >
                        <button
                          type="button"
                          className="mv-daybtn"
                          title="Ver este día"
                          onClick={() => onPickDate(d)}
                        >
                          <span className="mv-dl">{WEEKDAY_LETTERS[dow]}</span>
                          <span className="mv-dn">{parseISO(d).d}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="mv-stat">%</th>
                  <th className="mv-stat" title="Racha actual">Racha</th>
                  <th className="mv-stat" title="Récord">Máx</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h, i) => (
                  <tr key={h.id}>
                    <th className="mv-namecol" scope="row" title={h.name}>
                      {h.name}
                    </th>
                    {days.map((d) => {
                      const state = resolveState(h, d, logsOf(h.id)?.get(d), today, hhmm);
                      const tappable = state !== "off" && state !== "future";
                      return (
                        <td key={d} data-today={d === today || undefined}>
                          <button
                            type="button"
                            className="mv-cell"
                            data-state={state}
                            disabled={!tappable}
                            aria-label={`${h.name}, ${parseISO(d).d}: ${STATE_LABEL[state]}`}
                            onClick={() => cycleLog(h.id, d)}
                          >
                            <Glyph state={state} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="mv-stat">
                      {stats[i].pct === null ? "—" : `${Math.round((stats[i].pct ?? 0) * 100)}`}
                    </td>
                    <td className="mv-stat">{stats[i].current}</td>
                    <td className="mv-stat">{stats[i].best}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="mv-namecol">Total del día</th>
                  {days.map((d, i) => (
                    <td key={d} className="mv-total" data-today={d === today || undefined}>
                      {totals[i].total ? `${totals[i].done}/${totals[i].total}` : ""}
                    </td>
                  ))}
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="mv-legend" aria-hidden="true">
          <span><i className="mv-dot" data-state="done" /> cumplido</span>
          <span><i className="mv-dot" data-state="partial" /> a medias</span>
          <span><i className="mv-dot" data-state="missed" /> no cumplido</span>
          <span><i className="mv-dot" data-state="auto-missed" /> automático</span>
          <span><i className="mv-dot" data-state="off" /> no toca</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Glyph({ state }: { state: DayState }) {
  switch (state) {
    case "done":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.6 4.6L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "partial":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 13.2C6 6.8 9.6 6.8 12 12s6 5.2 8.5-1.2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "missed":
    case "auto-missed":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "late":
      return <span className="mv-late">!</span>;
    default:
      return null;
  }
}
