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
function make(accent: string, labels: string[]): ScaleLegend {
  return {
    accent,
    rows: labels.map((label, i) => ({ n: 10 - i, label, color: GRADIENT[i] })),
  };
}

export const ENERGIA_SCALE = make("#3a9d5d", [
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
]);

export const AGRADABILIDAD_SCALE = make("#5e3aa0", [
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
]);

export const ACTIVACION_SCALE = make("#e8722b", [
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
]);
