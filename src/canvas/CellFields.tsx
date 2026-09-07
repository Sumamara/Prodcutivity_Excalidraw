import { useEffect, useMemo, useRef } from "react";

import { debounce, loadCells, saveCells } from "./persistence";
import type { Cell } from "./SheetTemplate";
import "./CellFields.css";

/** Herramientas de dibujo: con una de estas activa, los campos no molestan. */
const DRAW_TOOLS = new Set(["freedraw", "eraser", "laser"]);

/**
 * Campos de escritura digital, uno por celda de la tabla. Van dentro de un
 * anchor que App transforma igual que la hoja, así quedan alineados a cualquier
 * zoom. `pointer-events` solo se activa cuando NO hay un lápiz/borrador activo,
 * de modo que escribir a mano por encima nunca queda bloqueado.
 *
 * Inputs no controlados: el valor vive en un ref y se guarda con debounce, así
 * teclear no re-renderiza los 180 campos.
 */
export function CellFields({
  sectionId,
  cells,
  activeToolType,
}: {
  sectionId: string;
  cells: Cell[];
  activeToolType: string;
}) {
  const initial = useMemo(() => loadCells(sectionId), [sectionId]);
  const valuesRef = useRef<Record<string, string>>(initial);
  const layerRef = useRef<HTMLDivElement>(null);

  const interactive = !DRAW_TOOLS.has(activeToolType);

  const flush = useMemo(
    () => debounce(() => saveCells(sectionId, valuesRef.current), 500),
    [sectionId],
  );

  // Al cambiar a modo dibujo, saca el foco de cualquier campo (cierra el
  // teclado en pantalla y evita seguir escribiendo sin querer).
  useEffect(() => {
    if (interactive) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && layerRef.current?.contains(el)) el.blur();
  }, [interactive]);

  // Guardado inmediato al desmontar (cambio de sección).
  useEffect(() => {
    return () => saveCells(sectionId, valuesRef.current);
  }, [sectionId]);

  return (
    <div
      ref={layerRef}
      className={interactive ? "cell-fields on" : "cell-fields off"}
    >
      {cells.map((c) => (
        <input
          key={c.id}
          className={c.kind === "num" ? "cell-input cell-num" : "cell-input cell-text"}
          style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
          defaultValue={initial[c.id] ?? ""}
          inputMode={c.kind === "num" ? "decimal" : "text"}
          enterKeyHint="next"
          tabIndex={interactive ? 0 : -1}
          aria-hidden={!interactive}
          onInput={(e) => {
            valuesRef.current[c.id] = (e.target as HTMLInputElement).value;
            flush();
          }}
          onBlur={() => saveCells(sectionId, valuesRef.current)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      ))}
    </div>
  );
}
