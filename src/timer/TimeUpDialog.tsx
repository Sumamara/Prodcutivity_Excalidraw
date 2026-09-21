import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useCellValues } from "../canvas/cellsStore";
import { useNow } from "./clock";
import {
  closeTimeUp,
  openTimeUp,
  useActiveTimer,
  useTimeUp,
  type TimeUpInfo,
} from "./timerStore";
import {
  cellId,
  elapsedMs,
  formatWorked,
  isFreeTimer,
  remainingMs,
  restRangeMinutes,
  type ActiveTimer,
} from "./timerCore";
import "../canvas/MoodMeter.css"; // reutiliza el modal (.mm-backdrop/.mm-panel/…)
import "./Timer.css";

/**
 * Aviso "Tiempo finalizado" con Replantear / Descansar. Sale en dos casos:
 *  - Temporizador de una fila que, corriendo, llega a 0 (una sola vez, y solo si
 *    vimos la cuenta atrás en esta sesión). Cerrarlo NO lo detiene.
 *  - Al DETENER el cronómetro libre (lo abre el propio almacén).
 * Los datos viven en el almacén, así que el aviso del cronómetro sigue abierto
 * aunque el cronómetro ya no exista.
 */
export function TimeUpDialog() {
  const info = useTimeUp();
  const timer = useActiveTimer();
  return (
    <>
      {timer && !isFreeTimer(timer) && (
        <CrossingWatcher key={timer.id} timer={timer} />
      )}
      {info && <Dialog info={info} />}
    </>
  );
}

/** Detecta el paso por 0 de un temporizador de fila y abre el aviso. */
function CrossingWatcher({ timer }: { timer: ActiveTimer }) {
  const now = useNow();
  const sawCountdown = useRef(false);
  const shown = useRef(false);

  useEffect(() => {
    if (timer.status !== "running") return;
    if (remainingMs(timer, now) > 0) {
      sawCountdown.current = true;
      return;
    }
    if (sawCountdown.current && !shown.current) {
      shown.current = true;
      // Tiempo trabajado al llegar a 0 (queda fijo mientras el aviso está abierto).
      openTimeUp({
        kind: "task",
        timerId: timer.id,
        workedMs: elapsedMs(timer, now),
        date: timer.date,
        sectionId: timer.sectionId,
        row: timer.row,
        cols: timer.cols,
        label: timer.label,
      });
    }
  }, [now, timer]);

  return null;
}

function Dialog({ info }: { info: TimeUpInfo }) {
  const { lo, hi } = restRangeMinutes(info.workedMs);
  const unit = (n: number) => (n === 1 ? "minuto" : "minutos");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTimeUp();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="mm-backdrop" onPointerDown={closeTimeUp}>
      <div
        className="mm-panel tu-panel"
        role="dialog"
        aria-label="Tiempo finalizado"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head tu-head">
          <span className="tu-check" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <strong>Tiempo finalizado</strong>
          <button
            type="button"
            className="mm-x"
            onClick={closeTimeUp}
            aria-label={
              info.kind === "task" ? "Cerrar (el temporizador sigue)" : "Cerrar"
            }
            title={
              info.kind === "task" ? "Cerrar (el temporizador sigue)" : "Cerrar"
            }
          >
            ×
          </button>
        </div>

        <div className="tu-body">
          <p className="tu-praise">¡Muy bien!</p>
          <p className="tu-praise-sub">Un bloque de enfoque más a tu favor.</p>

          {info.kind === "task" ? (
            <TaskLine info={info} />
          ) : (
            <p className="tu-task">
              del cronómetro · trabajaste <b>{formatWorked(info.workedMs)}</b>
            </p>
          )}

          <div className="tu-opt">
            <span className="tu-n">1</span>
            <div className="tu-txt">
              <b>Replantear</b>
              <span>¿Cómo se ve más fácil?</span>
            </div>
          </div>

          <div className="tu-opt">
            <span className="tu-n">2</span>
            <div className="tu-txt">
              <b>Descansar</b>
              <span>
                Puedes descansar{" "}
                {lo === hi ? (
                  <>
                    <b>{lo}</b> {unit(lo)}
                  </>
                ) : (
                  <>
                    de <b>{lo}</b> a <b>{hi}</b> minutos
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** "de la tarea <nombre>": celda Objetivo de esa fila (en vivo), con respaldos. */
function TaskLine({ info }: { info: Extract<TimeUpInfo, { kind: "task" }> }) {
  const values = useCellValues(info.date, info.sectionId);
  const name =
    (values?.[cellId(info.cols.label, info.row)] ?? "").trim() ||
    info.label ||
    `Fila ${info.row + 1}`;
  return (
    <p className="tu-task">
      de la tarea <b>{name}</b> · trabajaste{" "}
      <b>{formatWorked(info.workedMs)}</b>
    </p>
  );
}
