import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { markError, markPending, markSaved } from "../saveStatus";
import { debounce, loadCells, saveCells } from "./persistence";
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
}

/**
 * Estilo hoja de cálculo: los valores de las celdas se pintan como texto SVG
 * (una sola capa ligera, sin captura de puntero, se mueve/zoom perfecto con la
 * hoja). Solo existe UN `<input>` real, que se coloca y enfoca sobre la celda
 * tocada cuando la barra está en "modo celdas". Al salir, el valor vuelve a ser
 * texto SVG. Así el zoom con 2 dedos no se traba.
 */
export const CellFields = forwardRef<CellFieldsHandle, Props>(function CellFields(
  { date, sectionId, cells, sheetW, sheetH },
  ref,
) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const valuesRef = useRef<Record<string, string>>({});
  const editorRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef<string | null>(null);
  editingRef.current = editingId;

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
      setValues(v);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [date, sectionId]);

  useEffect(() => {
    return () => void saveCells(date, sectionId, valuesRef.current);
  }, [date, sectionId]);

  const commit = () => {
    const id = editingRef.current;
    const el = editorRef.current;
    if (!id || !el) return;
    const v = el.value;
    if (v !== (valuesRef.current[id] ?? "")) {
      valuesRef.current = { ...valuesRef.current, [id]: v };
      setValues(valuesRef.current);
      markPending();
      flush();
    }
  };

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
      if (!c || !el) return;
      el.value = valuesRef.current[c.id] ?? "";
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

  if (!loaded) return null;

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
        onBlur={() => {
          commit();
          setEditingId(null);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") editorRef.current?.blur();
          if (e.key === "Escape") {
            const el = editorRef.current;
            if (el) el.value = valuesRef.current[editingRef.current ?? ""] ?? "";
            el?.blur();
          }
        }}
      />
    </>
  );
});
