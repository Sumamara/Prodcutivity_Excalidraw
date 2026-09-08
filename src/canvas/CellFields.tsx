import {
  forwardRef,
  useCallback,
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
  // Solo guardar cuando la carga inicial ya terminó: si no, escribiríamos {}
  // encima de los datos (p. ej. en el desmontar simulado de StrictMode).
  const loadedRef = useRef(false);
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

  // Lee el valor actual del <input> y lo guarda (debounce). En iPad, Scribble y
  // el teclado con predicción a veces NO disparan `change` mientras escribes;
  // por eso se llama también en `input`, `compositionend`, un sondeo periódico
  // y al salir del campo.
  const syncEditor = useCallback((): boolean => {
    const id = editingRef.current;
    const el = editorRef.current;
    if (!id || !el) return false;
    if (el.value === (valuesRef.current[id] ?? "")) return false;
    valuesRef.current = { ...valuesRef.current, [id]: el.value };
    markPending();
    flush();
    return true;
  }, [flush]);

  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    loadCells(date, sectionId).then((v) => {
      if (!alive) return;
      valuesRef.current = v;
      loadedRef.current = true;
      setValues(v);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [date, sectionId]);

  useEffect(() => {
    return () => {
      if (loadedRef.current) void saveCells(date, sectionId, valuesRef.current);
    };
  }, [date, sectionId]);

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
      if (!c || !el) return;
      if (c.id === editingRef.current) {
        el.focus({ preventScroll: true });
        return;
      }
      // El <input> es único y compartido: antes de moverlo a la celda nueva,
      // confirma lo escrito en la anterior y muéstralo ya como texto.
      syncEditor();
      setValues({ ...valuesRef.current });

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
        onChange={syncEditor}
        onInput={syncEditor}
        onCompositionEnd={syncEditor}
        onBlur={() => {
          syncEditor();
          // Guardado inmediato al salir del campo (sin esperar al debounce).
          if (loadedRef.current) {
            void saveCells(date, sectionId, valuesRef.current).then((ok) =>
              ok ? markSaved() : markError(),
            );
          }
          setValues({ ...valuesRef.current });
          setEditingId(null);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Escape") editorRef.current?.blur();
        }}
      />
    </>
  );
});
