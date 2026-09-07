import { useEffect, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";

import type { Hotspot } from "./hotspot";
import "./SheetHotspots.css";

interface OpenState {
  id: string;
  rect: DOMRect;
}

/**
 * Zonas transparentes sobre las cabeceras de la hoja. Al tocarlas sale su
 * explicación en un popover. Van dentro de `.hotspot-anchor`, que App mueve
 * con el mismo transform que la hoja, así quedan siempre alineadas.
 *
 * El popover se saca por portal a <body>: dentro del anchor (que tiene
 * `transform`) un `position: fixed` se rompería y además se escalaría.
 */
export function SheetHotspots({
  hotspots,
  closeRef,
}: {
  /** Zonas interactivas de la sección activa. */
  hotspots: Hotspot[];
  /** App registra aquí el cierre para ocultar el popover al mover/zoomear. */
  closeRef: MutableRefObject<(() => void) | null>;
}) {
  const [open, setOpen] = useState<OpenState | null>(null);

  useEffect(() => {
    closeRef.current = () => setOpen(null);
    return () => {
      closeRef.current = null;
    };
  }, [closeRef]);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".hs-pop") || t.closest(".hs-dot")) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = open
    ? (hotspots.find((h) => h.id === open.id) ?? null)
    : null;

  return (
    <>
      {hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          className="hs-dot"
          style={{ left: h.x, top: h.y, width: h.w, height: h.h }}
          title={h.title}
          aria-label={h.title}
          aria-expanded={open?.id === h.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            // Leer el rect AQUÍ: dentro del updater de setState, React ya ha
            // puesto e.currentTarget a null (pantalla en blanco).
            const rect = e.currentTarget.getBoundingClientRect();
            setOpen((cur) => (cur?.id === h.id ? null : { id: h.id, rect }));
          }}
        />
      ))}

      {open &&
        current &&
        createPortal(
          <Popover
            rect={open.rect}
            title={current.title}
            body={current.body}
            onClose={() => setOpen(null)}
          />,
          document.body,
        )}
    </>
  );
}

function Popover({
  rect,
  title,
  body,
  onClose,
}: {
  rect: DOMRect;
  title: string;
  body: string;
  onClose: () => void;
}) {
  const POP_W = 250;
  const EST_H = 150;

  let top = rect.bottom + 8;
  if (top + EST_H > window.innerHeight) {
    top = Math.max(8, rect.top - 8 - EST_H);
  }
  let left = rect.left + rect.width / 2 - POP_W / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - POP_W - 8);

  return (
    <div
      className="hs-pop"
      style={{ top, left, width: POP_W }}
      role="dialog"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="hs-pop-x"
        onClick={onClose}
        aria-label="Cerrar"
      >
        ×
      </button>
      <div className="hs-pop-title">{title}</div>
      <p className="hs-pop-body">{body}</p>
    </div>
  );
}
