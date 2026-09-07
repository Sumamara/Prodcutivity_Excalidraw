/**
 * Zona interactiva de una plantilla: al tocarla sale su explicación.
 * Coordenadas en el sistema del SVG de la hoja (0–1000 x 0–750).
 */
export interface Hotspot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
}
