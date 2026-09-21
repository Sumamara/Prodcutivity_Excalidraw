import { useEffect } from "react";
import { createPortal } from "react-dom";

import "./MoodMeter.css";
import "./Avoidance.css";

/**
 * Cada paso del diagrama: una pregunta. `out` es la respuesta que SALE del
 * flujo (con su acción); la otra respuesta baja a la siguiente pregunta.
 */
interface Step {
  q: string;
  /** Respuesta que abre una rama lateral. */
  out: "Sí" | "No";
  /** Acción de la rama. */
  action: string;
  /** Detalle breve bajo la acción. */
  hint?: string;
  /** Tono de la rama: fin del flujo bien (verde) o acción a tomar (ámbar). */
  tone: "ok" | "act";
  /** Botón opcional dentro de la rama. */
  link?: "reappraisal" | "rest";
}

const STEPS: Step[] = [
  {
    q: "¿Estoy evitando algo ahora mismo?",
    out: "No",
    action: "Sigue con tu objetivo",
    hint: "Un objetivo a la vez; toma tus descansos.",
    tone: "ok",
  },
  {
    q: "¿Sé cuál es el siguiente paso concreto?",
    out: "No",
    action: "Hazlo más pequeño",
    hint: "Escribe el primer paso de 2 minutos: algo tan simple que no dé miedo empezar.",
    tone: "act",
  },
  {
    q: "¿Tengo muy poca energía?",
    out: "Sí",
    action: "Descanso activo real",
    hint: "Sin pantallas, algo que recargue de verdad. Luego vuelve.",
    tone: "act",
    link: "rest",
  },
  {
    q: "¿Hay una emoción incómoda (miedo, aburrimiento, ansiedad)?",
    out: "Sí",
    action: "Nómbrala y reinterprétala",
    hint: "Di qué sientes, respira 3 veces y cambia el significado de la tarea.",
    tone: "act",
    link: "reappraisal",
  },
  {
    q: "¿Sigue siendo importante hoy?",
    out: "No",
    action: "Decide a propósito",
    hint: "Elimínala, delégala o pospónla con una fecha. Eso no es evitar: es elegir.",
    tone: "act",
  },
];

/**
 * Diagrama de decisión "¿Estoy evitando?": qué hacer según la causa. Mismo estilo
 * de modal que la matriz de emociones y la Reapreciación.
 */
export function AvoidanceModal({
  onClose,
  onReappraisal,
  onRest,
}: {
  onClose: () => void;
  /** Abre la tarjeta de Reapreciación (cierra este diagrama). */
  onReappraisal: () => void;
  /** Lleva a la pestaña "Descansos activos" (cierra este diagrama). */
  onRest: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="mm-backdrop" onPointerDown={onClose}>
      <div
        className="mm-panel av-panel"
        role="dialog"
        aria-label="¿Estoy evitando? Qué hacer"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head av-head">
          <strong>¿Estoy evitando? · qué hacer</strong>
          <button
            type="button"
            className="mm-x"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="av-body">
          <p className="av-lead">
            Evitar es una señal, no un defecto: casi siempre hay una causa.
            Recorre las preguntas de arriba abajo.
          </p>

          <ol className="av-flow">
            {STEPS.map((s, i) => {
              const stay = s.out === "Sí" ? "No" : "Sí";
              return (
                <li className="av-row" key={s.q}>
                  <div className="av-main">
                    <div className="av-q">
                      <span className="av-n">{i + 1}</span>
                      {s.q}
                    </div>
                    <div className="av-down" aria-hidden="true">
                      <span className="av-down-lbl">{stay}</span>
                      <span className="av-down-arrow">↓</span>
                    </div>
                  </div>

                  <div className="av-branch">
                    <span className="av-out" aria-hidden="true">
                      {s.out} →
                    </span>
                    <div className={`av-act av-act-${s.tone}`}>
                      <span className="av-act-t">{s.action}</span>
                      {s.hint && <span className="av-act-d">{s.hint}</span>}
                      {s.link === "rest" && (
                        <button type="button" className="av-link" onClick={onRest}>
                          Ir a Descansos activos
                        </button>
                      )}
                      {s.link === "reappraisal" && (
                        <button
                          type="button"
                          className="av-link"
                          onClick={onReappraisal}
                        >
                          Abrir Reapreciación
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}

            <li className="av-final">
              <div className="av-act av-act-go">
                <span className="av-act-t">Regla de los 5 minutos</span>
                <span className="av-act-d">
                  Empieza solo 5 minutos con el temporizador. Cuando acaben,
                  decide si sigues: lo difícil casi siempre es empezar.
                </span>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  );
}
