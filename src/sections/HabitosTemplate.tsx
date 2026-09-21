/**
 * Plantilla "HÁBITOS" (apaisada): seguimiento manual de hábitos.
 * Columna de hábitos a la izquierda y 31 columnas de días. Todo es manual: los
 * hábitos y las fechas se escriben (celdas de texto o a mano con el lápiz) y en
 * cada cruce hábito × día se toca la celda para marcar ✓ (cumplido) → ~ (a
 * medias, amarillo) → ✗ (no cumplido) → vacío. (También se puede marcar a mano
 * con el lápiz.)
 * No depende de la fecha de la barra: es una sola hoja persistente.
 */
import type { Cell } from "../canvas/SheetTemplate";
import type { Hotspot } from "../canvas/hotspot";

export const SHEET_SIZE = { w: 1000, h: 750 };

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const FAINT = "#b9b9b9";
const STRIPE = "#f6f7f9";
const DATE_FILL = "#eef1f5";

const TABLE_L = 30;
const TABLE_R = 970;
const TABLE_T = 50;
const HROW = 26; // cabecera azul marino
const DROW = 30; // fila de fechas (se escriben a mano)
const BODY_ROWS = 20;
const BROW = 29.7;

const DAYS = 31;
const DAY_W = 24.5;
const DAYS_L = TABLE_R - DAYS * DAY_W; // 210.5: borde derecho de la columna de hábitos

const DATE_T = TABLE_T + HROW; // 76
const BODY_T = DATE_T + DROW; // 106
const BOTTOM = BODY_T + BODY_ROWS * BROW; // 700

const HAB_CENTER = (TABLE_L + DAYS_L) / 2;
const DAYS_CENTER = (DAYS_L + TABLE_R) / 2;

export const HABITOS_HOTSPOTS: Hotspot[] = [
  {
    id: "hb-habito",
    x: TABLE_L,
    y: TABLE_T,
    w: DAYS_L - TABLE_L,
    h: HROW,
    title: "Hábitos",
    body: "Escribe aquí cada hábito que quieres construir, uno por fila. Puedes teclearlo (modo celdas) o escribirlo a mano con el lápiz.",
  },
  {
    id: "hb-dias",
    x: DAYS_L,
    y: TABLE_T,
    w: TABLE_R - DAYS_L,
    h: HROW,
    title: "Días",
    body: "Escribe la fecha de cada día justo cuando lo marques (en la fila gris de abajo). Luego toca la celda del hábito de ese día: ✓ si lo cumpliste, otro toque ~ si lo hiciste a medias, otro ✗ si no, y otro para dejarla vacía.",
  },
];

/**
 * Celdas digitales: la fila de fechas (una por día, numéricas), el nombre de
 * cada hábito (texto) y una celda `check` por cada cruce hábito × día (`c<día>-<fila>`).
 */
export const HABITOS_CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let c = 0; c < DAYS; c++) {
    out.push({
      id: `dia-${c}`,
      x: DAYS_L + c * DAY_W,
      y: DATE_T,
      w: DAY_W,
      h: DROW,
      kind: "num",
    });
  }
  for (let r = 0; r < BODY_ROWS; r++) {
    out.push({
      id: `hab-${r}`,
      x: TABLE_L,
      y: BODY_T + r * BROW,
      w: DAYS_L - TABLE_L,
      h: BROW,
      kind: "text",
    });
  }
  for (let r = 0; r < BODY_ROWS; r++) {
    for (let c = 0; c < DAYS; c++) {
      out.push({
        id: `c${c}-${r}`,
        x: DAYS_L + c * DAY_W,
        y: BODY_T + r * BROW,
        w: DAY_W,
        h: BROW,
        kind: "check",
      });
    }
  }
  return out;
})();

export function HabitosTemplate() {
  return (
    <svg
      viewBox={`0 0 ${SHEET_SIZE.w} ${SHEET_SIZE.h}`}
      className="sheet-svg"
      role="img"
      aria-label="Hoja de hábitos"
    >
      {/* ---- encabezado ---- */}
      <text x={TABLE_L} y={34} fontSize={21} letterSpacing={3} fill={NAVY}>
        HÁBITOS
      </text>
      <path d="M916,36 L932,14 L943,27 L949,20 L961,36 Z" fill={NAVY} />

      {/* ---- cabecera de la tabla ---- */}
      <rect x={TABLE_L} y={TABLE_T} width={TABLE_R - TABLE_L} height={HROW} fill={NAVY} />
      <text
        x={HAB_CENTER}
        y={TABLE_T + 17}
        fontSize={12}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        Hábito
      </text>
      <text
        x={DAYS_CENTER}
        y={TABLE_T + 17}
        fontSize={12}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        Días
      </text>
      <line
        x1={DAYS_L}
        y1={TABLE_T}
        x2={DAYS_L}
        y2={DATE_T}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={0.9}
      />

      {/* ---- fila de fechas (se escriben en el momento) ---- */}
      <rect x={TABLE_L} y={DATE_T} width={TABLE_R - TABLE_L} height={DROW} fill={DATE_FILL} />
      <text
        x={TABLE_L + 10}
        y={DATE_T + DROW / 2 + 3.5}
        fontSize={10.5}
        letterSpacing={0.5}
        fill={FAINT}
      >
        fecha
      </text>

      {/* ---- franjas alternas (guía visual de las 31 columnas de días) ---- */}
      {Array.from({ length: DAYS }).map((_, c) =>
        c % 2 === 1 ? (
          <rect
            key={`st${c}`}
            x={DAYS_L + c * DAY_W}
            y={BODY_T}
            width={DAY_W}
            height={BOTTOM - BODY_T}
            fill={STRIPE}
          />
        ) : null,
      )}

      {/* ---- rejilla ---- */}
      <rect
        x={TABLE_L}
        y={TABLE_T}
        width={TABLE_R - TABLE_L}
        height={BOTTOM - TABLE_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      {/* borde entre la fila de fechas y el cuerpo */}
      <line x1={TABLE_L} y1={BODY_T} x2={TABLE_R} y2={BODY_T} stroke={LINE} strokeWidth={1} />
      {/* columna de hábitos | días */}
      <line x1={DAYS_L} y1={DATE_T} x2={DAYS_L} y2={BOTTOM} stroke={LINE} strokeWidth={1} />
      {/* separadores de día */}
      {Array.from({ length: DAYS - 1 }).map((_, i) => {
        const x = DAYS_L + (i + 1) * DAY_W;
        return (
          <line
            key={`dv${i}`}
            x1={x}
            y1={DATE_T}
            x2={x}
            y2={BOTTOM}
            stroke={LINE}
            strokeWidth={0.6}
          />
        );
      })}
      {/* filas */}
      {Array.from({ length: BODY_ROWS - 1 }).map((_, i) => {
        const y = BODY_T + (i + 1) * BROW;
        return (
          <line
            key={`hr${i}`}
            x1={TABLE_L}
            y1={y}
            x2={TABLE_R}
            y2={y}
            stroke={LINE}
            strokeWidth={0.6}
          />
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
