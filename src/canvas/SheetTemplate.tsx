/**
 * Plantilla "CONCENTRACIÓN" dibujada en SVG, fiel a la hoja de referencia.
 * Es un fondo estático (`pointer-events: none`): toda la escritura ocurre en
 * el lienzo de Excalidraw que va por encima.
 *
 * Coordenadas en un lienzo virtual de 1000 x 750 (relación 4:3, apaisado).
 * El SVG se ancla al viewport de Excalidraw (scroll + zoom) desde App.tsx.
 */

import type { Hotspot } from "./hotspot";

/**
 * Significado de las columnas de la tabla. Se usará para conectar el panel de
 * objetivos y el registro de horas a cada fila en la siguiente iteración.
 *   Esp  – horas esperadas / estimadas   (por confirmar)
 *   Real – horas reales                   (por confirmar)
 *   Ti   – tiempo inicial (hora de inicio)
 *   Tf   – tiempo final (hora de fin)
 *   ⚡   – energía
 *   Ag   – agradabilidad
 *   Ac   – activación
 *   Ev   – evitación ("¿estoy evitando?")
 */
export const COLUMN_MEANINGS: Record<string, string> = {
  Esp: "Horas esperadas",
  Real: "Horas reales",
  Ti: "Tiempo inicial",
  Tf: "Tiempo final",
  Energia: "Energía",
  Ag: "Agradabilidad",
  Ac: "Activación",
  Ev: "Evitación (¿estoy evitando?)",
};

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const BOLT = "#f2b705";
const FAINT = "#b9b9b9";

const TABLE_T = 172;
const HROW = 26;
const BROW = 25.35;
const BODY_ROWS = 20;
const TABLE_L = 30;
const TABLE_R = 970;
const BOTTOM = TABLE_T + HROW + BROW * BODY_ROWS; // 705

/** Bordes verticales: 8 columnas estrechas + hueco de la casilla. */
const V_BORDERS = [70, 110, 140, 170, 200, 230, 260, 290, 324];

/** Cabeceras de las columnas estrechas (texto, centro x). "" = icono. */
const HEAD_COLS: Array<[string, number]> = [
  ["Esp", 50],
  ["Real", 90],
  ["Ti", 125],
  ["Tf", 155],
  ["", 185],
  ["Ag", 215],
  ["Ac", 245],
  ["Ev", 275],
];

const PRIORITY_Y = [92, 118, 144];

const PROD_COL1 = [
  { y: 92, t: "1 objetivo a la vez concentrado" },
  { y: 116, t: "¡Tomar descansos!" },
  { y: 140, t: "¡Enfocarse en terminar!" },
];

const NARROW_COLS = [
  { id: "esp", title: "Esp · horas esperadas", body: "Horas que calculas que te llevará el objetivo, antes de empezar." },
  { id: "real", title: "Real · horas reales", body: "Horas que te llevó de verdad. Compáralo con Esp para calibrar tus estimaciones." },
  { id: "ti", title: "Ti · tiempo inicial", body: "Hora a la que empiezas la tarea." },
  { id: "tf", title: "Tf · tiempo final", body: "Hora a la que la terminas." },
  { id: "energia", title: "⚡ · energía", body: "Tu nivel de energía mientras la haces, de 0 a 10." },
  { id: "ag", title: "Ag · agradabilidad", body: "Cuánto te gustó hacerla, de 0 a 10." },
  { id: "ac", title: "Ac · activación", body: "Cuánta tensión o activación sentiste, de 0 a 10." },
  { id: "ev", title: "Ev · evitación", body: "¿La estabas usando para evitar otra cosa? De 0 a 10." },
];

const COL_LEFT = [TABLE_L, ...V_BORDERS.slice(0, 7)]; // 30, 70, 110, 140, 170, 200, 230, 260

export const HOTSPOTS: Hotspot[] = [
  {
    id: "prioridades",
    x: TABLE_L,
    y: 50,
    w: 430,
    h: 24,
    title: "3 prioridades",
    body: "Las 3 tareas que más importan hoy. Hazlas antes que cualquier otra cosa.",
  },
  {
    id: "optimizar",
    x: 478,
    y: 50,
    w: 492,
    h: 24,
    title: "Optimizar productividad",
    body: "Recordatorios de enfoque: un objetivo a la vez, tomar descansos, terminar lo empezado, crear antes de consumir.",
  },
  ...NARROW_COLS.map((c, i) => ({
    ...c,
    x: COL_LEFT[i],
    y: TABLE_T,
    w: V_BORDERS[i] - COL_LEFT[i],
    h: HROW,
  })),
  {
    id: "obj",
    x: 324,
    y: TABLE_T,
    w: TABLE_R - 324,
    h: HROW,
    title: "Objetivo / Comentario",
    body: "El objetivo de la fila y, al terminar, una nota breve: qué pasó y qué ajustarías.",
  },
];

/**
 * Celdas de la tabla como campos de escritura digital: 8 columnas estrechas
 * (num) + la ancha "Objetivo / Comentario" (text), por cada una de las 20
 * filas. Mismo sistema de coordenadas que el SVG (ver CellFields + App).
 */
export interface Cell {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "num" | "text";
}

export const CELLS: Cell[] = (() => {
  const cols = [
    ...NARROW_COLS.map((c, i) => ({
      key: c.id,
      x: COL_LEFT[i],
      w: V_BORDERS[i] - COL_LEFT[i],
      kind: "num" as const,
    })),
    { key: "obj", x: 324, w: TABLE_R - 324, kind: "text" as const },
  ];
  const out: Cell[] = [];
  for (let row = 0; row < BODY_ROWS; row++) {
    const y = TABLE_T + HROW + row * BROW;
    for (const c of cols) {
      out.push({ id: `${c.key}-${row}`, x: c.x, y, w: c.w, h: BROW, kind: c.kind });
    }
  }
  return out;
})();

function Box({ x, y, s = 11 }: { x: number; y: number; s?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={s}
      height={s}
      rx={2}
      fill="none"
      stroke={NAVY}
      strokeWidth={1.2}
    />
  );
}

export function SheetTemplate() {
  return (
    <svg
      viewBox="0 0 1000 750"
      className="sheet-svg"
      role="img"
      aria-label="Hoja de concentración"
    >
      {/* ---- encabezado ---- */}
      <text x={TABLE_L} y={34} fontSize={21} letterSpacing={3} fill={NAVY}>
        CONCENTRACIÓN
      </text>
      <text x={648} y={30} fontSize={11} letterSpacing={3} fill={NAVY}>
        FECHA
      </text>
      <line x1={702} y1={32} x2={905} y2={32} stroke={NAVY} strokeWidth={1} />
      <path d="M916,36 L932,14 L943,27 L949,20 L961,36 Z" fill={NAVY} />

      {/* ---- barras de panel ---- */}
      <rect x={TABLE_L} y={50} width={430} height={24} fill={NAVY} />
      <text
        x={245}
        y={66}
        fontSize={13}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        3 prioridades
      </text>

      <rect x={478} y={50} width={492} height={24} fill={NAVY} />
      <text
        x={724}
        y={66}
        fontSize={13}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        Optimizar productividad
      </text>

      {/* ---- 3 prioridades ---- */}
      {PRIORITY_Y.map((y) => (
        <g key={`p${y}`}>
          <Box x={40} y={y - 9} />
          <line x1={60} y1={y} x2={452} y2={y} stroke={LINE} strokeWidth={0.9} />
        </g>
      ))}

      {/* ---- optimizar productividad ---- */}
      {PROD_COL1.map(({ y, t }) => (
        <g key={`c1${y}`}>
          <Box x={490} y={y - 9} />
          <text x={508} y={y} fontSize={10.5} fill={NAVY}>
            {t}
          </text>
        </g>
      ))}
      <Box x={740} y={92 - 9} />
      <text x={758} y={92} fontSize={10.5} fill={NAVY}>
        Crear antes de consumir
      </text>

      {/* ---- cabecera de la tabla ---- */}
      <rect x={TABLE_L} y={TABLE_T} width={TABLE_R - TABLE_L} height={HROW} fill={NAVY} />
      {HEAD_COLS.map(([label, cx]) =>
        label ? (
          <text
            key={label}
            x={cx}
            y={TABLE_T + 17}
            fontSize={11}
            letterSpacing={0.4}
            fill="#fff"
            textAnchor="middle"
          >
            <title>{COLUMN_MEANINGS[label] ?? label}</title>
            {label}
          </text>
        ) : null,
      )}
      {/* rayo (columna de energía) */}
      <path
        d={`M188,${TABLE_T + 5} L180,${TABLE_T + 15} L185,${TABLE_T + 15} L183,${TABLE_T + 23} L192,${TABLE_T + 12} L186,${TABLE_T + 12} Z`}
        fill={BOLT}
      />
      <text
        x={647}
        y={TABLE_T + 17}
        fontSize={11}
        letterSpacing={0.5}
        fill="#fff"
        textAnchor="middle"
      >
        Objetivo / Comentario
      </text>

      {/* separadores tenues sobre la cabecera */}
      {V_BORDERS.map((x) => (
        <line
          key={`hv${x}`}
          x1={x}
          y1={TABLE_T}
          x2={x}
          y2={TABLE_T + HROW}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.75}
        />
      ))}

      {/* ---- rejilla del cuerpo ---- */}
      <rect
        x={TABLE_L}
        y={TABLE_T}
        width={TABLE_R - TABLE_L}
        height={BOTTOM - TABLE_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      {V_BORDERS.map((x) => (
        <line
          key={`bv${x}`}
          x1={x}
          y1={TABLE_T + HROW}
          x2={x}
          y2={BOTTOM}
          stroke={LINE}
          strokeWidth={0.75}
        />
      ))}
      {Array.from({ length: BODY_ROWS }).map((_, i) => {
        const yTop = TABLE_T + HROW + i * BROW;
        const cy = yTop + BROW / 2;
        return (
          <g key={`row${i}`}>
            <line
              x1={TABLE_L}
              y1={yTop}
              x2={TABLE_R}
              y2={yTop}
              stroke={LINE}
              strokeWidth={0.75}
            />
            <Box x={298} y={cy - 5.5} />
          </g>
        );
      })}

      {/* ---- pie ---- */}
      <text
        x={500}
        y={732}
        fontSize={10}
        letterSpacing={3}
        fill={FAINT}
        textAnchor="middle"
      >
        @Inner Base
      </text>
    </svg>
  );
}
