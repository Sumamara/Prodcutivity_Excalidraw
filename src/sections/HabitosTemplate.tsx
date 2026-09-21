/**
 * Plantilla "HÁBITOS" (vertical, como Time blocking): la hoja de UN día.
 *
 * El fondo (esta plantilla) solo dibuja la rejilla, la cabecera y las etiquetas.
 * Lo dinámico —nombre del hábito, hora, botón del día, racha, récord, engrane,
 * "Pendiente", resumen del día— lo pinta la capa `HabitsLayer` encima, con las
 * MISMAS constantes de geometría (`HB`), así que ambas capas siempre coinciden.
 * Debajo hay una franja "Notas" para escribir a mano (tinta de Excalidraw).
 */
import type { Hotspot } from "../canvas/hotspot";

export const SHEET_SIZE = { w: 800, h: 1035 };

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const FAINT = "#b9b9b9";
const FRAME = "#111111";

/** Geometría compartida con la capa (unidades de la hoja). */
export const HB = {
  L: 28,
  R: 772,
  /** Cabecera azul marino de la tabla. */
  HEAD_T: 112,
  HEAD_H: 32,
  /** Filas de hábitos. */
  ROW_T: 144,
  ROW_H: 62,
  MAX_ROWS: 12,
  /** Columnas: [x izquierda, x derecha]. */
  cols: {
    name: [28, 338],
    time: [338, 408],
    day: [408, 528],
    streak: [528, 608],
    best: [608, 688],
    gear: [688, 772],
  },
  /** Franja "En pausa". */
  PAUSE_T: 896,
  PAUSE_H: 28,
  /** Barra "Notas" y su área de tinta. */
  NOTES_T: 934,
  NOTES_H: 28,
} as const;

const TABLE_B = HB.ROW_T + HB.MAX_ROWS * HB.ROW_H; // 888

type ColKey = keyof typeof HB.cols;
const COL_ORDER: ColKey[] = ["name", "time", "day", "streak", "best", "gear"];

function center(c: ColKey): number {
  const [a, b] = HB.cols[c];
  return (a + b) / 2;
}

export const HABITOS_HOTSPOTS: Hotspot[] = [
  {
    id: "hb-habito",
    x: HB.cols.name[0],
    y: HB.HEAD_T,
    w: HB.cols.name[1] - HB.cols.name[0],
    h: HB.HEAD_H,
    title: "Hábito",
    body: "Cada fila es un hábito que quieres construir. Toca «+ Añadir hábito» para crear uno y el engrane ⚙ para editarlo, pausarlo o eliminarlo.",
  },
  {
    id: "hb-hora",
    x: HB.cols.time[0],
    y: HB.HEAD_T,
    w: HB.cols.time[1] - HB.cols.time[0],
    h: HB.HEAD_H,
    title: "Hora recomendada",
    body: "La hora a la que te conviene hacerlo. Si ya pasó y no lo marcaste, la fila dice «Pendiente». Con el recordatorio activado, a esa hora sale un aviso.",
  },
  {
    id: "hb-dia",
    x: HB.cols.day[0],
    y: HB.HEAD_T,
    w: HB.cols.day[1] - HB.cols.day[0],
    h: HB.HEAD_H,
    title: "Día",
    body: "Toca para marcar el día: ✓ cumplido, ~ a medias, ✗ no cumplido, y otro toque para dejarlo vacío. Si termina el día sin marcar, queda como ✗ automático (atenuado).",
  },
  {
    id: "hb-racha",
    x: HB.cols.streak[0],
    y: HB.HEAD_T,
    w: HB.cols.streak[1] - HB.cols.streak[0],
    h: HB.HEAD_H,
    title: "Racha",
    body: "Días seguidos que has cumplido el hábito. Cuentan ✓ y ~ (a medias); un ✗ la rompe. Los días en que no toca o está en pausa no la rompen.",
  },
  {
    id: "hb-max",
    x: HB.cols.best[0],
    y: HB.HEAD_T,
    w: HB.cols.best[1] - HB.cols.best[0],
    h: HB.HEAD_H,
    title: "Máx",
    body: "Tu récord: la racha más larga de todo el historial de este hábito.",
  },
];

export function HabitosTemplate() {
  return (
    <svg
      viewBox={`0 0 ${SHEET_SIZE.w} ${SHEET_SIZE.h}`}
      className="sheet-svg"
      role="img"
      aria-label="Hoja de hábitos del día"
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

      {/* ---- encabezado (la fecha va en la barra de pestañas) ---- */}
      <text x={28} y={48} fontSize={30} letterSpacing={4} fill={NAVY}>
        HÁBITOS
      </text>
      <path d="M735,46 L752,22 L763,36 L770,27 L782,46 Z" fill={NAVY} />

      {/* ---- cabecera de la tabla ---- */}
      <rect x={HB.L} y={HB.HEAD_T} width={HB.R - HB.L} height={HB.HEAD_H} fill={NAVY} />
      <text x={HB.cols.name[0] + 16} y={HB.HEAD_T + 21} fontSize={13} letterSpacing={1} fill="#fff">
        Hábito
      </text>
      {(
        [
          ["time", "Hora"],
          ["day", "Día"],
          ["streak", "Racha"],
          ["best", "Máx"],
        ] as Array<[ColKey, string]>
      ).map(([c, label]) => (
        <text
          key={c}
          x={center(c)}
          y={HB.HEAD_T + 21}
          fontSize={13}
          letterSpacing={1}
          fill="#fff"
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
      {COL_ORDER.slice(1).map((c) => (
        <line
          key={`hv-${c}`}
          x1={HB.cols[c][0]}
          y1={HB.HEAD_T}
          x2={HB.cols[c][0]}
          y2={HB.HEAD_T + HB.HEAD_H}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.75}
        />
      ))}

      {/* ---- rejilla ---- */}
      <rect
        x={HB.L}
        y={HB.HEAD_T}
        width={HB.R - HB.L}
        height={TABLE_B - HB.HEAD_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      {COL_ORDER.slice(1).map((c) => (
        <line
          key={`bv-${c}`}
          x1={HB.cols[c][0]}
          y1={HB.ROW_T}
          x2={HB.cols[c][0]}
          y2={TABLE_B}
          stroke={LINE}
          strokeWidth={0.75}
        />
      ))}
      {Array.from({ length: HB.MAX_ROWS - 1 }).map((_, i) => {
        const y = HB.ROW_T + (i + 1) * HB.ROW_H;
        return (
          <line
            key={`hr-${i}`}
            x1={HB.L}
            y1={y}
            x2={HB.R}
            y2={y}
            stroke={LINE}
            strokeWidth={0.6}
          />
        );
      })}

      {/* ---- notas (a mano) ---- */}
      <rect x={HB.L} y={HB.NOTES_T} width={HB.R - HB.L} height={HB.NOTES_H} fill={NAVY} />
      <text
        x={(HB.L + HB.R) / 2}
        y={HB.NOTES_T + 19}
        fontSize={13}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        Notas del día
      </text>

      {/* ---- pie ---- */}
      <line x1={28} y1={1000} x2={772} y2={1000} stroke={FAINT} strokeWidth={0.75} />
      <text
        x={400}
        y={1018}
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
