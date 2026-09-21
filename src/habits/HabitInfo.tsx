import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { parseDescription } from "./habitCore";
import "./Habits.css";

/** Descripción del hábito: cada línea aparte; las etiquetas conocidas en negrita. */
export function DescriptionText({ text }: { text: string }) {
  const parts = parseDescription(text);
  return (
    <div className="hi-desc">
      {parts.map((p, i) => (
        <p className="hi-line" key={i}>
          {p.label && <b className="hi-label">{p.label}</b>}
          {p.label ? " " : ""}
          {p.text}
        </p>
      ))}
    </div>
  );
}

/** Icono "i" de información. */
export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1.25" fill="currentColor" />
    </svg>
  );
}

const POP_W = 300;
const EST_H = 190;

/**
 * Popover con la descripción de un hábito, anclado al elemento que se tocó
 * (`rect`). Sale por portal a <body> (la hoja lleva un `transform`, que rompería
 * `position: fixed`) y por encima de los modales. Se cierra tocando fuera,
 * con Escape (sin cerrar además el modal de debajo), al hacer zoom o girar.
 */
export function HabitInfoPopover({
  rect,
  name,
  description,
  onClose,
  onEdit,
}: {
  rect: DOMRect;
  name: string;
  description: string | undefined;
  onClose: () => void;
  /** Si está, ofrece "Editar" / "Añadir descripción" (abre el engrane). */
  onEdit?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.min(POP_W, window.innerWidth - 16);
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - width - 8),
  );
  const [top, setTop] = useState(() => rect.bottom + 8);

  // Con la altura real: debajo del elemento si cabe; si no, encima.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? EST_H;
    let t = rect.bottom + 8;
    if (t + h > window.innerHeight - 8) t = rect.top - 8 - h;
    setTop(Math.max(8, t));
  }, [rect, description]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // solo cierra el popover, no el modal de debajo
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="hi-pop"
      style={{ top, left, width }}
      role="dialog"
      aria-label={`Descripción de ${name}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="hi-x" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
      <div className="hi-title">{name}</div>
      {description ? (
        <DescriptionText text={description} />
      ) : (
        <p className="hi-empty">Sin descripción todavía.</p>
      )}
      {onEdit && (
        <button type="button" className="hi-edit" onClick={onEdit}>
          {description ? "Editar" : "Añadir descripción"}
        </button>
      )}
    </div>,
    document.body,
  );
}
