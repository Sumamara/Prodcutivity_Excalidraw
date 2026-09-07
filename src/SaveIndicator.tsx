import { useEffect, useRef, useState } from "react";

import { useSaveStatus } from "./saveStatus";
import "./SaveIndicator.css";

/**
 * Estado del guardado local, a la derecha de la fecha. Un disquete + marca.
 * Al tocarlo aparece la hora del último guardado. Si hay cambios sin guardar o
 * un error, se pone en rojo/ámbar.
 */
export function SaveIndicator() {
  const { status, at } = useSaveStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const text =
    status === "error"
      ? "Sin guardar — reintentando"
      : status === "pending"
        ? "Guardando…"
        : at
          ? `Guardado a las ${new Date(at).toLocaleTimeString()}`
          : "Sin cambios";

  return (
    <div className="save-ind" ref={ref} data-status={status}>
      <button
        type="button"
        className="save-ind-btn"
        title={text}
        aria-label={text}
        onClick={() => setOpen((o) => !o)}
      >
        <FloppyIcon />
        <span className="save-ind-badge" aria-hidden="true">
          {status === "saved" ? "✓" : status === "pending" ? "…" : "!"}
        </span>
      </button>
      {open && <div className="save-ind-tip">{text}</div>}
    </div>
  );
}

function FloppyIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <rect x="8" y="13" width="8" height="4" />
    </svg>
  );
}
