import { useEffect } from "react";

import { useCellValues } from "../canvas/cellsStore";
import { useNow } from "./clock";
import {
  cellId,
  elapsedMs,
  formatElapsed,
  formatRemaining,
  isFreeTimer,
  isOvertime,
  remainingMs,
  type ActiveTimer,
} from "./timerCore";
import {
  finishTimer,
  startStopwatch,
  toggleTimer,
  useActiveTimer,
} from "./timerStore";
import "./Timer.css";

interface Props {
  /** Sale del Modo Mini y vuelve al cuaderno. */
  onExit: () => void;
}

/**
 * Vista enfocada en el contador para ventanas pequeñas (ventana flotante en
 * Android, Slide Over en iPadOS o modo manual desde la cabecera).
 */
export function MiniTimerView({ onExit }: Props) {
  const timer = useActiveTimer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExit]);

  if (!timer) {
    return <IdleMiniView onExit={onExit} />;
  }
  return <ActiveMiniView timer={timer} onExit={onExit} />;
}

function IdleMiniView({ onExit }: Props) {
  return (
    <div className="mini-timer" data-state="idle">
      <div className="mini-top">
        <span className="mini-kicker">Cronómetro</span>
        <button
          type="button"
          className="mini-exit"
          onClick={onExit}
          aria-label="Volver al cuaderno"
          title="Volver al cuaderno"
        >
          <ExpandIcon />
          <span>Cuaderno</span>
        </button>
      </div>

      <div className="mini-center">
        <div className="mini-clock" role="timer" aria-live="off">
          00:00
        </div>
        <div className="mini-task mini-task-muted">Sin actividad en curso</div>
      </div>

      <div className="mini-actions">
        <button
          type="button"
          className="mini-btn mini-btn-primary"
          onClick={startStopwatch}
        >
          Iniciar cronómetro
        </button>
      </div>
    </div>
  );
}

function ActiveMiniView({
  timer,
  onExit,
}: {
  timer: ActiveTimer;
  onExit: () => void;
}) {
  const now = useNow();
  const free = isFreeTimer(timer);
  const over = !free && isOvertime(timer, now);
  const paused = timer.status === "paused";
  const state = over ? "over" : paused ? "paused" : "running";

  const timeText = free
    ? formatElapsed(elapsedMs(timer, now))
    : formatRemaining(remainingMs(timer, now));

  // Lee en vivo la celda de Objetivo de la fila; si está vacía usa el respaldo.
  const values = useCellValues(
    free ? "__none__" : timer.date,
    free ? "__none__" : timer.sectionId,
  );
  const taskName = free
    ? "Cronómetro libre"
    : (values?.[cellId(timer.cols.label, timer.row)] ?? "").trim() ||
      timer.label.trim();

  const kicker = free
    ? paused
      ? "Cronómetro · en pausa"
      : "Cronómetro"
    : `Fila ${timer.row + 1}${over ? " · tiempo extra" : paused ? " · en pausa" : ""}`;

  const handleFinish = () => {
    finishTimer();
    onExit();
  };

  return (
    <div className="mini-timer" data-state={state}>
      <div className="mini-top">
        <span className="mini-kicker">{kicker}</span>
        <button
          type="button"
          className="mini-exit"
          onClick={onExit}
          aria-label="Volver al cuaderno"
          title="Volver al cuaderno"
        >
          <ExpandIcon />
          <span>Cuaderno</span>
        </button>
      </div>

      <div className="mini-center">
        <div className="mini-clock" role="timer" aria-live="off">
          {timeText}
        </div>
        {taskName && (
          <div className="mini-task" title={taskName}>
            {taskName}
          </div>
        )}
      </div>

      <div className="mini-actions">
        <button
          type="button"
          className="mini-btn mini-btn-primary"
          onClick={toggleTimer}
        >
          {paused ? "Reanudar" : "Pausar"}
        </button>
        <button
          type="button"
          className="mini-btn mini-btn-secondary"
          onClick={handleFinish}
        >
          {free ? "Detener" : "Terminar"}
        </button>
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10 2h4v4M14 2l-4.5 4.5M6 14H2v-4M2 14l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
