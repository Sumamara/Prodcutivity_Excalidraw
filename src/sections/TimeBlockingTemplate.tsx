/**
 * Plantilla "TIME BLOCKING" (vertical, tipo hoja carta).
 * Izquierda: 3 prioridades + Descarga mental. Derecha: bloque horario
 * 4:00 AM → medianoche. Abajo: Notas + ritual de INICIO.
 */
import type { Hotspot } from "../canvas/hotspot";

export const SHEET_SIZE = { w: 800, h: 1035 };

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const FAINT = "#b9b9b9";
const FRAME = "#111111";

const L = { x: 28, r: 384 };
const R = { x: 416, r: 772 };

const PRIORITY_Y = [148, 172, 196];

const DESCARGA_T = 256;
const DESCARGA_B = 686;
const DESCARGA_ROWS = 19;
const DR_H = (DESCARGA_B - DESCARGA_T) / DESCARGA_ROWS;

const HORA_T = 126;
const HORA_B = 686;
const HORA_ROWS = 21;
const HR_H = (HORA_B - HORA_T) / HORA_ROWS;
const HORA_LABEL_R = 486;

const TIMES = [
  "4:00 AM", "5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM",
  "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
  "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM",
  "10:00 PM", "11:00 PM", "12:00 AM",
];

const INICIO = [
  "Quitar distracciones",
  "Celular en otro cuarto",
  "Traer agua",
  "Entorno: solo lo del objetivo actual",
];

function Chk({ x, y, s = 12 }: { x: number; y: number; s?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={s}
      height={s}
      rx={2}
      fill="none"
      stroke={NAVY}
      strokeWidth={1.3}
    />
  );
}

function Bar({
  x,
  y,
  w,
  label,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={w} height={28} fill={NAVY} />
      <text
        x={x + w / 2}
        y={y + 19}
        fontSize={13}
        letterSpacing={1}
        fill="#fff"
        textAnchor="middle"
      >
        {label}
      </text>
    </>
  );
}

export function TimeBlockingTemplate() {
  return (
    <svg
      viewBox={`0 0 ${SHEET_SIZE.w} ${SHEET_SIZE.h}`}
      className="sheet-svg"
      role="img"
      aria-label="Hoja de time blocking"
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

      {/* ---- encabezado ---- */}
      <text x={28} y={48} fontSize={30} letterSpacing={4} fill={NAVY}>
        TIME BLOCKING
      </text>
      <text x={430} y={40} fontSize={12} letterSpacing={3} fill={NAVY}>
        FECHA
      </text>
      <line x1={485} y1={42} x2={655} y2={42} stroke={NAVY} strokeWidth={1} />
      <path d="M735,46 L752,22 L763,36 L770,27 L782,46 Z" fill={NAVY} />

      {/* ---- 3 prioridades ---- */}
      <Bar x={L.x} y={92} w={L.r - L.x} label="3 prioridades" />
      {PRIORITY_Y.map((y) => (
        <g key={`p${y}`}>
          <Chk x={38} y={y - 9} />
          <line
            x1={62}
            y1={y + 2}
            x2={L.r - 6}
            y2={y + 2}
            stroke={LINE}
            strokeWidth={0.9}
          />
        </g>
      ))}

      {/* ---- Descarga mental ---- */}
      <Bar x={L.x} y={222} w={L.r - L.x} label="Descarga mental" />
      <rect
        x={L.x}
        y={DESCARGA_T}
        width={L.r - L.x}
        height={DESCARGA_B - DESCARGA_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      <line
        x1={340}
        y1={DESCARGA_T}
        x2={340}
        y2={DESCARGA_B}
        stroke={LINE}
        strokeWidth={0.75}
      />
      {Array.from({ length: DESCARGA_ROWS }).map((_, i) => {
        const yTop = DESCARGA_T + i * DR_H;
        return (
          <g key={`d${i}`}>
            {i > 0 && (
              <line
                x1={L.x}
                y1={yTop}
                x2={L.r}
                y2={yTop}
                stroke={LINE}
                strokeWidth={0.6}
              />
            )}
            <Chk x={38} y={yTop + DR_H / 2 - 6} />
          </g>
        );
      })}

      {/* ---- Hora ---- */}
      <Bar x={R.x} y={92} w={R.r - R.x} label="Hora" />
      <rect
        x={R.x}
        y={HORA_T}
        width={R.r - R.x}
        height={HORA_B - HORA_T}
        fill="none"
        stroke={LINE}
        strokeWidth={1}
      />
      <line
        x1={HORA_LABEL_R}
        y1={HORA_T}
        x2={HORA_LABEL_R}
        y2={HORA_B}
        stroke={LINE}
        strokeWidth={0.75}
      />
      {TIMES.map((t, i) => {
        const yTop = HORA_T + i * HR_H;
        const cy = yTop + HR_H / 2;
        return (
          <g key={t + i}>
            {i > 0 && (
              <line
                x1={R.x}
                y1={yTop}
                x2={R.r}
                y2={yTop}
                stroke={LINE}
                strokeWidth={0.6}
              />
            )}
            <Chk x={R.x + 8} y={cy - 5.5} s={11} />
            <text x={R.x + 26} y={cy + 3.5} fontSize={8.5} fill={NAVY}>
              {t}
            </text>
          </g>
        );
      })}

      {/* ---- Notas ---- */}
      <Bar x={L.x} y={700} w={R.r - L.x} label="Notas" />
      <text
        x={110}
        y={752}
        fontSize={10}
        fontWeight={600}
        letterSpacing={1}
        fill={NAVY}
      >
        INICIO
      </text>
      <text
        x={560}
        y={752}
        fontSize={10}
        fontWeight={600}
        letterSpacing={1}
        fill={NAVY}
      >
        NOTAS
      </text>
      {INICIO.map((t, i) => {
        const y = 774 + i * 20;
        return (
          <g key={t}>
            <Chk x={40} y={y - 8} s={11} />
            <text x={58} y={y + 1} fontSize={9} fill={NAVY}>
              {t}
            </text>
          </g>
        );
      })}

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

export const TIME_BLOCKING_HOTSPOTS: Hotspot[] = [
  {
    id: "tb-prioridades",
    x: L.x,
    y: 92,
    w: L.r - L.x,
    h: 28,
    title: "3 prioridades",
    body: "Las 3 tareas que más importan hoy. Van antes que cualquier otra cosa.",
  },
  {
    id: "tb-descarga",
    x: L.x,
    y: 222,
    w: L.r - L.x,
    h: 28,
    title: "Descarga mental",
    body: "Vacía la cabeza: apunta todo lo que ronda, sin filtrar, para no cargarlo mientras trabajas.",
  },
  {
    id: "tb-hora",
    x: R.x,
    y: 92,
    w: R.r - R.x,
    h: 28,
    title: "Bloque horario",
    body: "Asigna cada hora a una tarea concreta y marca la casilla al cumplir el bloque.",
  },
  {
    id: "tb-notas",
    x: L.x,
    y: 700,
    w: R.r - L.x,
    h: 28,
    title: "Notas",
    body: "Lo que aprendiste del día: qué funcionó y qué cambiar mañana.",
  },
  {
    id: "tb-inicio",
    x: 96,
    y: 744,
    w: 130,
    h: 16,
    title: "Ritual de inicio",
    body: "Haz la lista entera cada vez, antes de empezar a trabajar.",
  },
];
