import { useEffect, useMemo, useRef, useState } from "react";

import { markError, markPending, markSaved } from "../saveStatus";
import { debounce, loadCells, saveCells } from "./persistence";
import type { Cell } from "./SheetTemplate";
import "./CellFields.css";

/** Herramientas de dibujo: con una de estas activa, los campos no molestan. */
const DRAW_TOOLS = new Set(["freedraw", "eraser", "laser"]);

/**
 * Campos de escritura digital, uno por celda de la tabla. Van dentro de un
 * anchor que App transforma igual que la hoja, así quedan alineados a cualquier
 * zoom.
 *
 * - Teclado / tocar para editar: siempre que NO haya un lápiz/borrador activo.
 * - Escribir a mano con el Pencil (Scribble de iPadOS lo pasa a texto): solo
 *   con la herramienta Texto (T) activa. Con selección o mover, el toque del
 *   Pencil sobre una celda se ignora (no la enfoca, no dispara Scribble).
 *
 * Inputs no controlados: el valor vive en un ref y se guarda con debounce, así
 * teclear no re-renderiza los campos. Se monta con key={fecha:sección} desde
 * App, por eso basta cargar una vez.
 */
export function CellFields({
  date,
  sectionId,
  cells,
  activeToolType,
}: {
  date: string;
  sectionId: string;
  cells: Cell[];
  activeToolType: string;
}) {
  const [initial, setInitial] = useState<Record<string, string> | null>(null);
  const valuesRef = useRef<Record<string, string>>({});
  const layerRef = useRef<HTMLDivElement>(null);

  // Editar con teclado/tocar: con cualquier herramienta que no sea de dibujo.
  const interactive = !DRAW_TOOLS.has(activeToolType);
  // Escribir a mano con el Pencil (Scribble): solo con Texto (T).
  const scribble = activeToolType === "text";

  const flush = useMemo(
    () =>
      debounce(() => {
        void saveCells(date, sectionId, valuesRef.current).then((ok) =>
          ok ? markSaved() : markError(),
        );
      }, 500),
    [date, sectionId],
  );

  useEffect(() => {
    let alive = true;
    loadCells(date, sectionId).then((v) => {
      if (!alive) return;
      valuesRef.current = v;
      setInitial(v);
    });
    return () => {
      alive = false;
    };
  }, [date, sectionId]);

  // Al cambiar a modo dibujo, saca el foco de cualquier campo (cierra el
  // teclado en pantalla y evita seguir escribiendo sin querer).
  useEffect(() => {
    if (interactive) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && layerRef.current?.contains(el)) el.blur();
  }, [interactive]);

  // Guardado inmediato al desmontar (cambio de fecha/sección).
  useEffect(() => {
    return () => void saveCells(date, sectionId, valuesRef.current);
  }, [date, sectionId]);

  if (!initial) return null;

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
            markPending();
            flush();
          }}
          onBlur={() =>
            void saveCells(date, sectionId, valuesRef.current).then((ok) =>
              ok ? markSaved() : markError(),
            )
          }
          onPointerDown={(e) => {
            e.stopPropagation();
            // Sin la herramienta Texto, el Pencil no interactúa con la celda:
            // no la enfoca y así iPadOS no arranca Scribble.
            if (e.pointerType === "pen" && !scribble) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
      ))}
    </div>
  );
}
