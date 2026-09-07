/**
 * Plantilla "TIME BLOCKING": rejilla horaria de 06:00 a 22:00 en tramos de
 * 30 min. Se dibujan los bloques sobre las líneas, una tarea por bloque.
 * Mismo lienzo virtual 1000 x 750 que el resto de secciones.
 */
import type { Hotspot } from "../canvas/hotspot";

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const HALF = "#cfcfcf";
const FAINT = "#b9b9b9";

const GRID_T = 100;
const GRID_B = 712;
const HALF_ROWS = 32; // 06:00 -> 22:00
const ROW_H = (GRID_B - GRID_T) / HALF_ROWS;
const HOUR_COL_R = 104;
const RIGHT = 970;
const START_HOUR = 6;

export function TimeBlockingTemplate() {
  return (
    <svg
      viewBox="0 0 1000 750"
      className="sheet-svg"
      role="img"
      aria-label="Hoja de time blocking"
    >
      <text x={30} y={34} fontSize={21} letterSpacing={3} fill={NAVY}>
        TIME BLOCKING
      </text>
      <text x={648} y={30} fontSize={11} letterSpacing={3} fill={NAVY}>
        FECHA
      </text>
      <line x1={702} y1={32} x2={905} y2={32} stroke={NAVY} strokeWidth={1} />
      <path d="M916,36 L932,14 L943,27 L949,20 L961,36 Z" fill={NAVY} />

      <rect x={30} y={52} width={940} height={24} fill={NAVY} />
      <text
        x={500}
        y={68}
        fontSize={13}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        Un bloque, una tarea — sin solaparlas
      </text>

      <rect
        x={30}
        y={GRID_T}
        width={RIGHT - 30}
        height={GRID_B - GRID_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      <line
        x1={HOUR_COL_R}
        y1={GRID_T}
        x2={HOUR_COL_R}
        y2={GRID_B}
        stroke={LINE}
        strokeWidth={0.75}
      />

      {Array.from({ length: HALF_ROWS }).map((_, i) => {
        const y = GRID_T + i * ROW_H;
        const onHour = i % 2 === 0;
        return (
          <g key={i}>
            <line
              x1={30}
              y1={y}
              x2={RIGHT}
              y2={y}
              stroke={onHour ? LINE : HALF}
              strokeWidth={onHour ? 0.75 : 0.5}
            />
            {onHour && (
              <text
                x={HOUR_COL_R - 10}
                y={y + 13}
                fontSize={10}
                fill={NAVY}
                textAnchor="end"
              >
                {String(START_HOUR + i / 2).padStart(2, "0")}:00
              </text>
            )}
          </g>
        );
      })}

      <text
        x={500}
        y={734}
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

export const TIME_BLOCKING_HOTSPOTS: Hotspot[] = [
  {
    id: "tb-bar",
    x: 30,
    y: 52,
    w: 940,
    h: 24,
    title: "Cómo bloquear el tiempo",
    body: "Asigna cada tarea a una franja concreta y dibújala sobre las líneas. Una tarea por bloque; deja huecos para imprevistos.",
  },
  {
    id: "tb-hours",
    x: 30,
    y: GRID_T,
    w: HOUR_COL_R - 30,
    h: 44,
    title: "Franja horaria",
    body: "De 06:00 a 22:00 en tramos de 30 min. Escribe la tarea a la derecha de su hora.",
  },
];
