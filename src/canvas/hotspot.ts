/**
 * Zona interactiva de una plantilla: al tocarla sale su explicación.
 * Coordenadas en el sistema del SVG de la hoja.
 */
export interface ScaleRow {
  n: number;
  label: string;
  color: string;
}

/** Leyenda de una escala 1–10 (energía, agradabilidad, activación, evitación). */
export interface ScaleLegend {
  /** Color de la cabecera del popover. */
  accent: string;
  /** Filas de 10 a 1. */
  rows: ScaleRow[];
  /** Si está, el popover añade un botón que abre la matriz energía × agrado. */
  moodMeter?: boolean;
  /** Si está, el popover añade un botón "Reapreciación" que abre su tarjeta. */
  reappraisal?: boolean;
  /** Si está, el popover añade un botón que abre el diagrama "¿Estoy evitando?". */
  avoidance?: boolean;
  /** Si está, el popover añade un botón que lleva a otra pestaña (sección). */
  sectionLink?: { sectionId: string; label: string };
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
  /** Si está, el popover muestra la escala 1–10 en vez del texto corto. */
  scale?: ScaleLegend;
}
