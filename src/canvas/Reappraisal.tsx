import { useEffect } from "react";
import { createPortal } from "react-dom";

import "./MoodMeter.css";
import "./Reappraisal.css";

/** Preguntas para reinterpretar la situación (reapreciación cognitiva). */
const PROMPTS = [
  "¿Qué otra explicación posible tiene lo que pasó?",
  "¿Qué puedo aprender o ganar con esto?",
  "¿Cómo lo veré dentro de un mes? ¿Y de un año?",
  "¿Qué parte sí depende de mí?",
];

/**
 * Tarjeta de "Reapreciación": mismo estilo de modal que la matriz de emociones.
 * Mensaje: el agrado sube cuando cambias el significado de la situación.
 */
export function ReappraisalModal({ onClose }: { onClose: () => void }) {
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
        className="mm-panel ra-panel"
        role="dialog"
        aria-label="Reapreciación: aumentar la agradabilidad"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head ra-head">
          <strong>Reapreciación · sube tu agrado</strong>
          <button
            type="button"
            className="mm-x"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="ra-body">
          <p className="ra-lead">
            Lo que sientes no depende solo de lo que pasa, sino de{" "}
            <b>cómo lo interpretas</b>. Si cambias el significado de la
            situación, cambia cómo la vives.
          </p>

          <div className="ra-flow" aria-label="Situación, interpretación, agrado">
            <div className="ra-step">
              <span className="ra-step-n">1</span>
              <span className="ra-step-t">Situación</span>
              <span className="ra-step-d">Lo que ocurre</span>
            </div>
            <span className="ra-arrow" aria-hidden="true">
              →
            </span>
            <div className="ra-step ra-step-key">
              <span className="ra-step-n">2</span>
              <span className="ra-step-t">Interpretación</span>
              <span className="ra-step-d">Aquí puedes actuar</span>
            </div>
            <span className="ra-arrow" aria-hidden="true">
              →
            </span>
            <div className="ra-step">
              <span className="ra-step-n">3</span>
              <span className="ra-step-t">Agrado</span>
              <span className="ra-step-d">Cómo lo sientes</span>
            </div>
          </div>

          <div className="ra-example">
            <div className="ra-ex ra-ex-low">
              <span className="ra-ex-tag">Antes · agrado bajo</span>
              <span className="ra-ex-q">“Esta tarea es un castigo.”</span>
            </div>
            <span className="ra-arrow ra-arrow-down" aria-hidden="true">
              →
            </span>
            <div className="ra-ex ra-ex-high">
              <span className="ra-ex-tag">Después · agrado alto</span>
              <span className="ra-ex-q">
                “Esta tarea me acerca a lo que quiero lograr.”
              </span>
            </div>
          </div>

          <div className="ra-prompts-title">Pregúntate</div>
          <ul className="ra-prompts">
            {PROMPTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
