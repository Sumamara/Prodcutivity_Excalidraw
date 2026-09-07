/**
 * Plantilla "MENÚ DESCANSOS ACTIVA" (apaisada).
 * Dos bloques de 4 columnas (tipos de descanso) + una columna aparte
 * "¿estoy procrastinando?", y una barra de Notas.
 */
import type { Hotspot } from "../canvas/hotspot";

export const SHEET_SIZE = { w: 1000, h: 790 };

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const FAINT = "#b9b9b9";
const FILL = "#c9d3e2";
const FRAME = "#111111";

const COL_X = [28, 196, 364, 532, 700]; // 4 columnas del bloque
const RIGHT_X = 730;
const RIGHT_R = 972;

const HEAD_H = 42;
const BODY_ROWS = 8;
const ROW_H = 27;

interface Block {
  headY: number;
  cols: { label: string[]; fill?: boolean }[];
  right: string[];
}

const BLOCK1: Block = {
  headY: 68,
  cols: [
    { label: ["PAUSAS ACTIVAS"], fill: true },
    { label: ["SIDES"] },
    { label: ["RELAJANTE", "PROFUNDO"] },
    { label: ["TIEMPO", "RELAJADO"] },
  ],
  right: ["¿ESTOY", "PROCRASTINANDO?"],
};

const BLOCK2: Block = {
  headY: 342,
  cols: [
    { label: ["ACTIVIDADES", "SOCIALES"], fill: true },
    { label: ["HOBBY"] },
    { label: ["FÍSICO"] },
    { label: ["HABILIDADES"] },
  ],
  right: [],
};

function HeadLabel({
  cx,
  y,
  lines,
}: {
  cx: number;
  y: number;
  lines: string[];
}) {
  const start = y + (lines.length === 1 ? 5 : 0);
  return (
    <text
      x={cx}
      y={start}
      fontSize={9}
      letterSpacing={0.6}
      fill="#fff"
      textAnchor="middle"
    >
      {lines.map((ln, i) => (
        <tspan key={ln} x={cx} dy={i === 0 ? 0 : 11}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

function TableBlock({ block }: { block: Block }) {
  const { headY, cols } = block;
  const bodyT = headY + HEAD_H;
  const bodyH = BODY_ROWS * ROW_H;
  const blockR = COL_X[COL_X.length - 1];

  return (
    <>
      {/* relleno de la 1ª columna */}
      {cols[0].fill && (
        <rect
          x={COL_X[0]}
          y={bodyT}
          width={COL_X[1] - COL_X[0]}
          height={bodyH}
          fill={FILL}
        />
      )}

      {/* cabeceras */}
      {cols.map((c, i) => (
        <g key={i}>
          <rect
            x={COL_X[i]}
            y={headY}
            width={COL_X[i + 1] - COL_X[i]}
            height={HEAD_H}
            fill={NAVY}
          />
          <HeadLabel
            cx={(COL_X[i] + COL_X[i + 1]) / 2}
            y={headY + HEAD_H / 2}
            lines={c.label}
          />
        </g>
      ))}

      {/* rejilla del cuerpo */}
      <rect
        x={COL_X[0]}
        y={bodyT}
        width={blockR - COL_X[0]}
        height={bodyH}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      {COL_X.slice(1, -1).map((x) => (
        <line
          key={x}
          x1={x}
          y1={bodyT}
          x2={x}
          y2={bodyT + bodyH}
          stroke={LINE}
          strokeWidth={0.75}
        />
      ))}
      {Array.from({ length: BODY_ROWS - 1 }).map((_, i) => (
        <line
          key={i}
          x1={COL_X[0]}
          y1={bodyT + (i + 1) * ROW_H}
          x2={blockR}
          y2={bodyT + (i + 1) * ROW_H}
          stroke={LINE}
          strokeWidth={0.6}
        />
      ))}
    </>
  );
}

function RightColumn({ block }: { block: Block }) {
  const { headY, right } = block;
  const bodyT = headY + HEAD_H;
  const bodyH = BODY_ROWS * ROW_H;
  return (
    <>
      <rect
        x={RIGHT_X}
        y={headY}
        width={RIGHT_R - RIGHT_X}
        height={HEAD_H}
        fill={NAVY}
      />
      {right.length > 0 && (
        <HeadLabel cx={(RIGHT_X + RIGHT_R) / 2} y={headY + HEAD_H / 2} lines={right} />
      )}
      <rect
        x={RIGHT_X}
        y={bodyT}
        width={RIGHT_R - RIGHT_X}
        height={bodyH}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      {Array.from({ length: BODY_ROWS - 1 }).map((_, i) => (
        <line
          key={i}
          x1={RIGHT_X}
          y1={bodyT + (i + 1) * ROW_H}
          x2={RIGHT_R}
          y2={bodyT + (i + 1) * ROW_H}
          stroke={LINE}
          strokeWidth={0.6}
        />
      ))}
    </>
  );
}

export function MenuDiaTemplate() {
  return (
    <svg
      viewBox={`0 0 ${SHEET_SIZE.w} ${SHEET_SIZE.h}`}
      className="sheet-svg"
      role="img"
      aria-label="Hoja de menú de descansos"
    >
      <rect
        x={8}
        y={8}
        width={SHEET_SIZE.w - 16}
        height={SHEET_SIZE.h - 16}
        fill="none"
        stroke={FRAME}
        strokeWidth={2}
      />

      <text x={28} y={44} fontSize={22} letterSpacing={2} fill={NAVY}>
        MENÚ DESCANSOS ACTIVA
      </text>
      <path d="M940,44 L956,18 L966,32 L972,24 L982,44 Z" fill={NAVY} />

      <TableBlock block={BLOCK1} />
      <RightColumn block={BLOCK1} />
      <TableBlock block={BLOCK2} />
      <RightColumn block={BLOCK2} />

      {/* Notas: solo bajo los bloques, no bajo la columna derecha */}
      <rect x={COL_X[0]} y={616} width={COL_X[4] - COL_X[0]} height={26} fill={NAVY} />
      <text
        x={(COL_X[0] + COL_X[4]) / 2}
        y={633}
        fontSize={11}
        fill="#fff"
        textAnchor="middle"
      >
        Notas
      </text>

      <line x1={28} y1={752} x2={972} y2={752} stroke={FAINT} strokeWidth={0.75} />
      <text
        x={500}
        y={770}
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

export const MENU_DIA_HOTSPOTS: Hotspot[] = [
  {
    id: "md-pausas",
    x: COL_X[0],
    y: BLOCK1.headY,
    w: COL_X[1] - COL_X[0],
    h: HEAD_H,
    title: "Pausas activas",
    body: "Micro-descansos de movimiento: estírate, camina, respira. Cortos y frecuentes.",
  },
  {
    id: "md-relajante",
    x: COL_X[2],
    y: BLOCK1.headY,
    w: COL_X[3] - COL_X[2],
    h: HEAD_H,
    title: "Relajante profundo",
    body: "Descanso de calma real: sin pantallas, algo que baje de verdad la activación.",
  },
  {
    id: "md-procrastinando",
    x: RIGHT_X,
    y: BLOCK1.headY,
    w: RIGHT_R - RIGHT_X,
    h: HEAD_H,
    title: "¿Estoy procrastinando?",
    body: "Marca si el descanso era, en realidad, evitar la tarea.",
  },
  {
    id: "md-sociales",
    x: COL_X[0],
    y: BLOCK2.headY,
    w: COL_X[1] - COL_X[0],
    h: HEAD_H,
    title: "Actividades sociales",
    body: "Descansos con otras personas: charla, llamada, café.",
  },
  {
    id: "md-hobby",
    x: COL_X[1],
    y: BLOCK2.headY,
    w: COL_X[2] - COL_X[1],
    h: HEAD_H,
    title: "Hobby",
    body: "Tiempo para una afición que disfrutas de verdad.",
  },
  {
    id: "md-notas",
    x: COL_X[0],
    y: 616,
    w: COL_X[4] - COL_X[0],
    h: 26,
    title: "Notas",
    body: "Qué descansos te recargaron y cuáles no.",
  },
];
