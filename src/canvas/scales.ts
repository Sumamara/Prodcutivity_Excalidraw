import type { ScaleLegend } from "./hotspot";

/** Degradado compartido: índice 0 = nivel 10 (rojo) … índice 9 = nivel 1 (azul). */
const GRADIENT = [
  "#e02424",
  "#ee4d2d",
  "#f2711c",
  "#f4a71d",
  "#9dbf2e",
  "#57ab5a",
  "#37a89e",
  "#2aa2b8",
  "#2f7fc9",
  "#2f6fd0",
];

/** `labels[0]` = nivel 10 … `labels[9]` = nivel 1. */
function make(
  accent: string,
  labels: string[],
  opts: {
    moodMeter?: boolean;
    reappraisal?: boolean;
    avoidance?: boolean;
    sectionLink?: ScaleLegend["sectionLink"];
  } = {},
): ScaleLegend {
  return {
    accent,
    rows: labels.map((label, i) => ({ n: 10 - i, label, color: GRADIENT[i] })),
    moodMeter: opts.moodMeter,
    reappraisal: opts.reappraisal,
    avoidance: opts.avoidance,
    sectionLink: opts.sectionLink,
  };
}

export const ENERGIA_SCALE = make(
  "#3a9d5d",
  [
    "Al máximo",
    "Muy enérgico",
    "Enérgico",
    "Activo",
    "Aceptable",
    "Funcional",
    "Cansado",
    "Muy cansado",
    "Agotado",
    "Colapsado",
  ],
  // "menu-dia" = pestaña "Descansos activos" (ver sections/registry.ts).
  { sectionLink: { sectionId: "menu-dia", label: "Pestaña descansos" } },
);

export const AGRADABILIDAD_SCALE = make(
  "#5e3aa0",
  [
    "Plenitud máxima",
    "Muy bien / Excelente",
    "Bien",
    "A gusto",
    "Ligeramente agradable",
    "Ligeramente desagradable",
    "Incómodo / Irritado",
    "Mal",
    "Muy mal",
    "Fatal",
  ],
  { reappraisal: true },
);

export const ACTIVACION_SCALE = make(
  "#e8722b",
  [
    "Máxima",
    "Muy alta",
    "Alta",
    "Elevada",
    "Ligeramente alta",
    "Ligeramente baja",
    "Atenuada",
    "Baja",
    "Muy baja",
    "Mínima",
  ],
  { moodMeter: true },
);

/** 10 = evito por completo (rojo) … 1 = sin evitar (azul). */
export const EVITACION_SCALE = make(
  "#2c7a8c",
  [
    "Huyendo por completo",
    "Evito casi todo",
    "Evito mucho",
    "Evito bastante",
    "Evito a ratos",
    "Me distraigo a veces",
    "Ligera tentación",
    "Casi sin evitar",
    "Enfocado",
    "Sin evitar",
  ],
  { avoidance: true },
);
