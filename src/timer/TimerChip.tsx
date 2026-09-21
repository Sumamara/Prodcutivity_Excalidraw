import { useEffect } from "react";

import { formatShort } from "../dates";
import { useNow } from "./clock";
import {
  finishTimer,
  startStopwatch,
  toggleTimer,
  useActiveTimer,
} from "./timerStore";
import {
  elapsedMs,
  formatElapsed,
  formatRemaining,
  isFreeTimer,
  isOvertime,
  remainingMs,
  type ActiveTimer,
} from "./timerCore";
import "./Timer.css";

const BASE_TITLE = "Journal de Horas";

interface Props {
  /** Fecha y sección que se están viendo (para mostrar de dónde viene el timer). */
  viewedDate: string;
  viewedSectionId: string;
  /** Lleva a la hoja (fecha + sección) donde se inició el temporizador. */
  onGoTo: (timer: ActiveTimer) => void;
}

/**
 * Contador de la cabecera, a la izquierda de la fecha. SIEMPRE visible:
 *  - Sin temporizador: `00:00` y ▶ → inicia un CRONÓMETRO libre (cuenta hacia
 *    arriba). Al detenerlo sale el aviso con el tiempo de descanso sugerido.
 *  - Temporizador de una fila: `Fila N · mm:ss · ⏸ · ■`. Corriendo = azul marino;
 *    en pausa = gris; en tiempo extra = amarillo apagado (con signo "−").
 */
export function TimerChip(props: Props) {
  const timer = useActiveTimer();
  if (!timer) return <IdleChip />;
  return <ChipBody timer={timer} {...props} />;
}

/** Sin temporizador: contador en 0 y ▶ para iniciar el cronómetro. */
function IdleChip() {
  return (
    <div className="tm-chip" data-state="idle">
      <span className="tm-main tm-static">
        <span className="tm-label">Cronómetro</span>
        <span className="tm-time">00:00</span>
      </span>
      <button
        type="button"
        className="tm-btn"
        aria-label="Iniciar cronómetro"
        title="Iniciar cronómetro"
        onClick={startStopwatch}
      >
        <PlayIcon />
      </button>
    </div>
  );
}

function ChipBody({
  timer,
  viewedDate,
  viewedSectionId,
  onGoTo,
}: Props & { timer: ActiveTimer }) {
  const now = useNow();
  const free = isFreeTimer(timer);
  const over = !free && isOvertime(timer, now);
  const text = free
    ? formatElapsed(elapsedMs(timer, now))
    : formatRemaining(remainingMs(timer, now));
  const label = free ? "Cronómetro" : `Fila ${timer.row + 1}`;

  // Tiempo en el título de la pestaña (útil cuando estás en otra pestaña).
  useEffect(() => {
    document.title = `${text} · ${label}`;
  }, [text, label]);
  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const elsewhere =
    !free && (viewedDate !== timer.date || viewedSectionId !== timer.sectionId);
  const paused = timer.status === "paused";
  const state = over ? "over" : paused ? "paused" : "running";

  const inner = (
    <>
      {elsewhere && (
        <span className="tm-where" aria-hidden="true">
          ↩ {formatShort(timer.date)}
        </span>
      )}
      <span className="tm-label">{label}</span>
      <span className="tm-time" role="timer" aria-live="off">
        {text}
      </span>
    </>
  );

  return (
    <div className="tm-chip" data-state={state}>
      {free ? (
        <span className="tm-main tm-static">{inner}</span>
      ) : (
        <button
          type="button"
          className="tm-main"
          title="Ir a la hoja de esta tarea"
          onClick={() => onGoTo(timer)}
        >
          {inner}
        </button>
      )}

      <button
        type="button"
        className="tm-btn"
        aria-label={paused ? "Reanudar" : "Pausar"}
        title={paused ? "Reanudar" : "Pausar"}
        onClick={toggleTimer}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button
        type="button"
        className="tm-btn"
        aria-label={free ? "Detener cronómetro" : "Terminar"}
        title={free ? "Detener cronómetro" : "Terminar"}
        onClick={finishTimer}
      >
        <StopIcon />
      </button>

      {/* Solo lectores de pantalla: se anuncia una vez al pasar del tiempo. */}
      <span className="tm-sr" aria-live="polite">
        {over ? "Tiempo cumplido. Ahora en tiempo extra." : ""}
      </span>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2.5" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
      <rect x="6.9" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}
