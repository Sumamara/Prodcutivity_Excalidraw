import { useMemo } from "react";

import { useCellValues } from "../canvas/cellsStore";
import type { Cell } from "../canvas/SheetTemplate";
import { startTimer, toggleTimer, useActiveTimer } from "./timerStore";
import {
  cellId,
  parseEsp,
  rowOfCellId,
  type TimerColumns,
} from "./timerCore";
import "./Timer.css";

interface RowGeom {
  row: number;
  /** Borde izquierdo de la tabla (= ancho del margen libre a su izquierda). */
  x0: number;
  /** Borde derecho de la tabla. */
  x1: number;
  y: number;
  h: number;
}

/**
 * ▶ en el MARGEN IZQUIERDO de la hoja, a la izquierda de la columna Esp. Va
 * dentro de una capa anclada al viewport (mismo `transform` que la hoja), así
 * que se mueve y hace zoom con ella.
 *
 * Reglas:
 *  - Sin temporizador activo, el ▶ está OCULTO en todas las filas y solo sale en
 *    la fila cuya celda Esp acabas de tocar (`selectedRow`), y solo si su Esp es
 *    válido.
 *  - Con temporizador activo, los ▶ de las demás filas (y de otras hojas/fechas)
 *    siguen ocultos. En la fila activa SIEMPRE se ve el botón de pausa/reanudar
 *    y la fila queda resaltada en gris.
 */
export function RowPlayLayer({
  date,
  sectionId,
  cells,
  cols,
  selectedRow,
  onStarted,
}: {
  date: string;
  sectionId: string;
  cells: Cell[];
  cols: TimerColumns;
  /** Fila cuya celda Esp se tocó (o null): solo esa muestra ▶. */
  selectedRow: number | null;
  /** Se llama al pulsar ▶ (para deseleccionar la fila). */
  onStarted: () => void;
}) {
  const values = useCellValues(date, sectionId);
  const timer = useActiveTimer();

  // Geometría de cada fila (a partir de las celdas ya definidas por la hoja).
  const rows = useMemo<RowGeom[]>(() => {
    const byRow = new Map<number, RowGeom>();
    for (const c of cells) {
      const r = rowOfCellId(c.id);
      if (r === null) continue;
      const g = byRow.get(r);
      if (!g) {
        byRow.set(r, { row: r, x0: c.x, x1: c.x + c.w, y: c.y, h: c.h });
      } else {
        g.x0 = Math.min(g.x0, c.x);
        g.x1 = Math.max(g.x1, c.x + c.w);
      }
    }
    return [...byRow.values()].sort((a, b) => a.row - b.row);
  }, [cells]);

  if (!values) return null;

  const ownHere =
    timer && timer.date === date && timer.sectionId === sectionId ? timer : null;

  return (
    <>
      {ownHere && <RowHighlight geom={rows.find((g) => g.row === ownHere.row)} />}

      {rows.map((g) => {
        const isOwn = ownHere?.row === g.row;
        const valid = parseEsp(values[cellId(cols.esp, g.row)]) !== null;

        // Con un timer activo, solo la fila activa muestra su botón. Sin timer,
        // solo la fila tocada (y con Esp válido).
        if (timer && !isOwn) return null;
        if (!timer && !(g.row === selectedRow && valid)) return null;

        const paused = isOwn && ownHere?.status === "paused";
        const label = isOwn
          ? paused
            ? "Reanudar temporizador"
            : "Pausar temporizador"
          : `Iniciar temporizador de la fila ${g.row + 1}`;

        return (
          <button
            key={g.row}
            type="button"
            className="tm-play"
            data-active={isOwn || undefined}
            style={{ left: 0, top: g.y, width: g.x0, height: g.h }}
            aria-label={label}
            title={label}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (isOwn) {
                toggleTimer();
              } else {
                void startTimer({ date, sectionId, row: g.row, cols });
                onStarted();
              }
            }}
          >
            {isOwn && !paused ? <PauseGlyph /> : <PlayGlyph />}
          </button>
        );
      })}
    </>
  );
}

/** Fila activa resaltada en gris (fija, sin barra que avance). */
function RowHighlight({ geom }: { geom: RowGeom | undefined }) {
  if (!geom) return null;
  return (
    <div
      className="tm-active-row"
      style={{
        left: geom.x0,
        top: geom.y,
        width: geom.x1 - geom.x0,
        height: geom.h,
      }}
      aria-hidden="true"
    />
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2.5" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
      <rect x="6.9" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
    </svg>
  );
}
