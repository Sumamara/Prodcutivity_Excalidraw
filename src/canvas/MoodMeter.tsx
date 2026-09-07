import { useEffect } from "react";
import { createPortal } from "react-dom";

import "./MoodMeter.css";

/** Filas de energía 10 (arriba) a 1 (abajo); columnas de agrado 1 a 10. */
const ROWS: string[][] = [
  ["Enfurecido", "Presa del pánico", "Estresado", "Inquieto", "Conmocionado", "Sorprendido", "Animado", "Festivo", "Exultante", "Eufórico"],
  ["Furibundo", "Furioso", "Frustrado", "Tenso", "Atónito", "Hiperactivo", "Alegre", "Motivado", "Inspirado", "Exaltado"],
  ["Echando humo", "Asustado", "Enojado", "Nervioso", "Inquieto", "Lleno de energía", "Vivaz", "Entusiasta", "Optimista", "Emocionado"],
  ["Ansioso", "Aprensivo", "Preocupado", "Irritado", "Molesto", "Complacido", "Feliz", "Concentrado", "Orgulloso", "Emocionado (entusiasmado)"],
  ["Repugnado", "Atribulado", "Preocupado", "Incómodo", "Fastidiado", "Agradable", "Alegre", "Esperanzado", "Juguetón", "Dichoso"],
  ["Asqueado", "Decaído", "Decepcionado", "Abatido", "Apático", "En paz", "Despreocupado", "Conforme", "Amoroso", "Plenamente satisfecho"],
  ["Pesimista", "Sombrío", "Desanimado", "Triste", "Aburrido", "Tranquilo", "Seguro", "Satisfecho", "Agradecido", "Conmovido"],
  ["Alienado", "Miserable", "Solitario", "Desalentado", "Cansado", "Relajado", "Tranquilo", "Descansado", "Bendecido", "Equilibrado"],
  ["Desesperanzado", "Deprimido", "Malhumorado", "Exhausto", "Fatigado", "Apacible", "Reflexivo", "Pacífico", "Cómodo", "Despreocupado"],
  ["Desesperación", "Sin esperanza", "Desolado", "Agotado", "Drenado", "Somnoliento", "Complaciente", "Sereno", "Acogedor", "Sereno"],
];

function cell(energy: number, agrado: number): { bg: string; fg: string } {
  const highE = energy >= 6;
  const highA = agrado >= 6;
  const hue =
    !highA && highE ? 4 : highA && highE ? 45 : !highA && !highE ? 214 : 142;

  const dx = Math.abs(agrado - 5.5) / 4.5;
  const dy = Math.abs(energy - 5.5) / 4.5;
  const dist = Math.max(dx, dy) * 0.65 + ((dx + dy) / 2) * 0.35;

  const light = 60 - dist * 28;
  const sat = 46 + dist * 30;
  return {
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    fg: light > 52 ? "#17202b" : "#ffffff",
  };
}

export function MoodMeterModal({ onClose }: { onClose: () => void }) {
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
        className="mm-panel"
        role="dialog"
        aria-label="Matriz de emociones: energía y agrado"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mm-head">
          <strong>Emociones · Energía × Agrado</strong>
          <button
            type="button"
            className="mm-x"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="mm-scroll">
          <div className="mm-axis-y">ENERGÍA</div>
          <div className="mm-grid">
            {ROWS.map((row, r) => {
              const energy = 10 - r;
              return (
                <div className="mm-line" key={energy}>
                  <span className="mm-rlabel">{energy}</span>
                  {row.map((word, c) => {
                    const { bg, fg } = cell(energy, c + 1);
                    return (
                      <span
                        className="mm-cell"
                        key={c}
                        style={{ background: bg, color: fg }}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              );
            })}
            <div className="mm-line mm-clabels">
              <span className="mm-rlabel" />
              {Array.from({ length: 10 }, (_, i) => (
                <span className="mm-clabel" key={i}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="mm-axis-x">AGRADO</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
