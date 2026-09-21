import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  flushCells,
  patchCells,
  peekCells,
  useCellValues,
} from "./cellsStore";
import { columnOfCellId } from "../timer/timerCore";
import type { Cell } from "./SheetTemplate";
import "./CellFields.css";

export interface CellFieldsHandle {
  /** Abre el editor sobre la celda que contiene el punto (coords de la hoja). */
  editAt(x: number, y: number): void;
  /** Cierra el editor si está abierto (confirma el valor). */
  close(): void;
}

interface Props {
  date: string;
  sectionId: string;
  cells: Cell[];
  sheetW: number;
  sheetH: number;
  /**
   * Normalizadores por columna, aplicados SOLO al confirmar la celda (salir /
   * Enter), nunca mientras escribes. Devuelven el texto a guardar o `null` si el
   * valor no es válido (entonces se conserva lo escrito).
   */
  normalize?: Record<string, (raw: string) => string | null>;
  /**
   * Se llama al tocar una celda (`id`) o un punto sin celda (`null`). Sirve para
   * saber qué fila se ha seleccionado (p. ej. mostrar ▶ en la celda Esp tocada).
   */
  onSelect?: (cellId: string | null) => void;
}

/**
 * Estilo hoja de cálculo: los valores de las celdas se pintan como texto SVG
 * (una sola capa ligera, sin captura de puntero, se mueve/zoom perfecto con la
 * hoja). Solo existe UN `<input>` real, que se coloca y enfoca sobre la celda
 * tocada cuando la barra está en "modo celdas". Al salir, el valor vuelve a ser
 * texto SVG. Así el zoom con 2 dedos no se traba.
 *
 * Los valores viven en `cellsStore` (único escritor, por parches): aquí solo se
 * leen y se parchean, de modo que el temporizador puede escribir Ti/Tf/Real a
 * la vez sin que este componente lo pise.
 */
export const CellFields = forwardRef<CellFieldsHandle, Props>(function CellFields(
  { date, sectionId, cells, sheetW, sheetH, normalize, onSelect },
  ref,
) {
  const values = useCellValues(date, sectionId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef<string | null>(null);
  editingRef.current = editingId;

  // Lee el valor actual del <input> y lo parchea (debounce en el almacén). En
  // iPad, Scribble y el teclado con predicción a veces NO disparan `change`
  // mientras escribes; por eso se llama también en `input`, `compositionend`, un
  // sondeo periódico y al salir del campo. Guarda el valor CRUDO.
  const syncEditor = useCallback((): boolean => {
    const id = editingRef.current;
    const el = editorRef.current;
    if (!id || !el) return false;
    if (el.value === (peekCells(date, sectionId)?.[id] ?? "")) return false;
    void patchCells(date, sectionId, { [id]: el.value });
    return true;
  }, [date, sectionId]);

  // Confirma la celda en edición: normaliza según su columna y guarda al
  // instante (sin esperar al debounce).
  const commit = useCallback(() => {
    const id = editingRef.current;
    const el = editorRef.current;
    if (!id || !el) return;
    const raw = el.value;
    const norm = normalize?.[columnOfCellId(id)];
    const value = norm ? (norm(raw) ?? raw) : raw;
    if (value === (peekCells(date, sectionId)?.[id] ?? "")) {
      // Sin cambios de valor, pero puede quedar pendiente lo escrito en crudo.
      flushCells(date, sectionId);
      return;
    }
    void patchCells(date, sectionId, { [id]: value }, { immediate: true });
  }, [date, sectionId, normalize]);

  // Mientras el editor está abierto, sondea el valor por si el método de
  // entrada (Scribble, teclado iPad) no dispara eventos al escribir.
  useEffect(() => {
    if (!editingId) return;
    const t = window.setInterval(syncEditor, 600);
    return () => window.clearInterval(t);
  }, [editingId, syncEditor]);

  useImperativeHandle(ref, () => ({
    editAt(x, y) {
      const c = cells.find(
        (cell) =>
          x >= cell.x &&
          x < cell.x + cell.w &&
          y >= cell.y &&
          y < cell.y + cell.h,
      );
      const el = editorRef.current;

      if (!c) {
        onSelect?.(null);
        return;
      }
      if (!el) return;
      onSelect?.(c.id);
      if (c.id === editingRef.current) {
        el.focus({ preventScroll: true });
        return;
      }
      // El <input> es único y compartido: antes de moverlo a la celda nueva,
      // confirma lo escrito en la anterior y muéstralo ya como texto.
      commit();

      el.value = peekCells(date, sectionId)?.[c.id] ?? "";
      el.style.left = `${c.x}px`;
      el.style.top = `${c.y}px`;
      el.style.width = `${c.w}px`;
      el.style.height = `${c.h}px`;
      el.classList.toggle("cell-num", c.kind === "num");
      el.classList.toggle("cell-text", c.kind === "text");
      setEditingId(c.id);
      // Enfocar en el mismo tick del gesto (iOS lo necesita para el teclado).
      el.focus({ preventScroll: true });
      el.select();
    },
    close() {
      editorRef.current?.blur();
    },
  }));

  if (!values) return null;

  return (
    <>
      <svg
        className="cell-values"
        viewBox={`0 0 ${sheetW} ${sheetH}`}
        aria-hidden="true"
      >
        {cells.map((c) => {
          const v = values[c.id];
          if (!v || c.id === editingId) return null;
          return (
            <text
              key={c.id}
              x={c.kind === "num" ? c.x + c.w / 2 : c.x + 5}
              y={c.y + c.h * 0.68}
              fontSize={12}
              fill="#1e2a3a"
              textAnchor={c.kind === "num" ? "middle" : "start"}
            >
              {v}
            </text>
          );
        })}
      </svg>

      <input
        ref={editorRef}
        className={editingId ? "cell-editor on" : "cell-editor"}
        enterKeyHint="done"
        onChange={syncEditor}
        onInput={syncEditor}
        onCompositionEnd={syncEditor}
        onBlur={() => {
          syncEditor();
          commit();
          setEditingId(null);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          // Tocar la celda que ya se está editando también la "selecciona".
          if (editingRef.current) onSelect?.(editingRef.current);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Escape") editorRef.current?.blur();
        }}
      />
    </>
  );
});
