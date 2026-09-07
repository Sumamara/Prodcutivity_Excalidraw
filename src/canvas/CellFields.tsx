import { useEffect, useMemo, useRef, useState } from "react";

import { markError, markPending, markSaved } from "../saveStatus";
import { debounce, loadCells, saveCells } from "./persistence";
import type { Cell } from "./SheetTemplate";
import "./CellFields.css";

/**
 * Campos de escritura digital, uno por celda de la tabla. Van dentro de un
 * anchor que App transforma igual que la hoja, así quedan alineados a cualquier
 * zoom.
 *
 * Solo se pueden editar (teclado, tocar, y a mano con el Pencil vía Scribble de
 * iPadOS) con la herramienta **Texto (T)** activa. Con cualquier otra —lápiz,
 * borrador, seleccionar, mover— la capa deja pasar el puntero: mover tiene
 * prioridad aunque arrastres sobre una celda. El texto ya escrito se ve siempre.
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

  // Solo la herramienta Texto activa las celdas. Cualquier otra las deja pasar
  // (mover, seleccionar, lápices, borrador todos priorizan el lienzo).
  const interactive = activeToolType === "text";

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
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      ))}
    </div>
  );
}
