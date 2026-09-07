/**
 * Plantilla "MENÚ DEL DÍA": eliges tus tareas como si pidieras de un menú.
 * Cada plato es un tipo de tarea. Mismo lienzo virtual 1000 x 750.
 */
import type { Hotspot } from "../canvas/hotspot";

const NAVY = "#1e2a3a";
const LINE = "#8a8a8a";
const DOT = "#c7c7c7";
const FAINT = "#b9b9b9";

const MENU_L = 60;
const MENU_R = 940;

const COURSES = [
  {
    id: "entrada",
    name: "Entrada",
    lines: 2,
    desc: "Un arranque fácil: una tarea corta para coger ritmo.",
  },
  {
    id: "principal",
    name: "Plato principal",
    lines: 3,
    desc: "La tarea más importante del día, la que de verdad mueve la aguja.",
  },
  {
    id: "guarnicion",
    name: "Guarnición",
    lines: 3,
    desc: "Tareas de apoyo, pequeñas y necesarias.",
  },
  {
    id: "postre",
    name: "Postre",
    lines: 2,
    desc: "Algo ligero y agradable para cerrar bien el día.",
  },
];

interface CourseLayout {
  id: string;
  name: string;
  desc: string;
  headY: number;
  lineYs: number[];
}

function buildLayout() {
  const courses: CourseLayout[] = [];
  let cy = 118;
  for (const c of COURSES) {
    const lineYs = Array.from({ length: c.lines }, (_, k) => cy + 26 + k * 28);
    courses.push({ id: c.id, name: c.name, desc: c.desc, headY: cy, lineYs });
    cy += 26 + c.lines * 28 + 26;
  }
  return { courses, notesY: cy };
}

const LAYOUT = buildLayout();

export function MenuDiaTemplate() {
  return (
    <svg
      viewBox="0 0 1000 750"
      className="sheet-svg"
      role="img"
      aria-label="Hoja de menú del día"
    >
      {/* marco doble tipo carta */}
      <rect
        x={24}
        y={24}
        width={952}
        height={702}
        fill="none"
        stroke={NAVY}
        strokeWidth={1}
      />
      <rect
        x={30}
        y={30}
        width={940}
        height={690}
        fill="none"
        stroke={DOT}
        strokeWidth={0.75}
      />

      <text
        x={500}
        y={62}
        fontSize={22}
        letterSpacing={4}
        fill={NAVY}
        textAnchor="middle"
      >
        MENÚ DEL DÍA
      </text>
      <text
        x={500}
        y={82}
        fontSize={10}
        letterSpacing={3}
        fill={FAINT}
        textAnchor="middle"
      >
        FECHA
      </text>
      <line x1={455} y1={90} x2={545} y2={90} stroke={NAVY} strokeWidth={0.75} />

      {LAYOUT.courses.map((c) => (
        <g key={c.id}>
          <text x={MENU_L} y={c.headY} fontSize={14} letterSpacing={1} fill={NAVY}>
            {c.name}
          </text>
          <line
            x1={MENU_L + 150}
            y1={c.headY - 4}
            x2={MENU_R}
            y2={c.headY - 4}
            stroke={DOT}
            strokeWidth={1}
            strokeDasharray="1.5 4"
          />
          {c.lineYs.map((ly, i) => (
            <line
              key={i}
              x1={MENU_L}
              y1={ly}
              x2={MENU_R}
              y2={ly}
              stroke={LINE}
              strokeWidth={0.75}
            />
          ))}
        </g>
      ))}

      <text
        x={MENU_L}
        y={LAYOUT.notesY}
        fontSize={14}
        letterSpacing={1}
        fill={NAVY}
      >
        Notas del chef
      </text>
      <rect
        x={MENU_L}
        y={LAYOUT.notesY + 12}
        width={MENU_R - MENU_L}
        height={690 + 30 - (LAYOUT.notesY + 12) - 24}
        fill="none"
        stroke={LINE}
        strokeWidth={0.75}
      />

      <text
        x={500}
        y={710}
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

export const MENU_DIA_HOTSPOTS: Hotspot[] = LAYOUT.courses.map((c) => ({
  id: `menu-${c.id}`,
  x: MENU_L - 6,
  y: c.headY - 18,
  w: 200,
  h: 24,
  title: c.name,
  body: c.desc,
}));
