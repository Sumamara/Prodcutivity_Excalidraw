import type { ComponentType } from "react";

import {
  SheetTemplate,
  HOTSPOTS as CONCENTRACION_HOTSPOTS,
  CELLS as CONCENTRACION_CELLS,
  SHEET_SIZE as CONCENTRACION_SIZE,
  type Cell,
} from "../canvas/SheetTemplate";
import type { Hotspot } from "../canvas/hotspot";
import {
  TimeBlockingTemplate,
  TIME_BLOCKING_HOTSPOTS,
  SHEET_SIZE as TIME_BLOCKING_SIZE,
} from "./TimeBlockingTemplate";
import {
  MenuDiaTemplate,
  MENU_DIA_HOTSPOTS,
  SHEET_SIZE as MENU_DIA_SIZE,
} from "./MenuDiaTemplate";

export interface Section {
  id: string;
  label: string;
  /** Fondo SVG de la sección. */
  Template: ComponentType;
  /** Tamaño del lienzo virtual de esta plantilla (px a zoom 100%). */
  width: number;
  height: number;
  /** Zonas interactivas con explicación. */
  hotspots: Hotspot[];
  /** Celdas con campo de escritura digital (opcional). */
  cells?: Cell[];
}

export const SECTIONS: Section[] = [
  {
    id: "concentracion",
    label: "Concentración",
    Template: SheetTemplate,
    width: CONCENTRACION_SIZE.w,
    height: CONCENTRACION_SIZE.h,
    hotspots: CONCENTRACION_HOTSPOTS,
    cells: CONCENTRACION_CELLS,
  },
  {
    id: "time-blocking",
    label: "Time blocking",
    Template: TimeBlockingTemplate,
    width: TIME_BLOCKING_SIZE.w,
    height: TIME_BLOCKING_SIZE.h,
    hotspots: TIME_BLOCKING_HOTSPOTS,
  },
  {
    id: "menu-dia",
    label: "Descansos activos",
    Template: MenuDiaTemplate,
    width: MENU_DIA_SIZE.w,
    height: MENU_DIA_SIZE.h,
    hotspots: MENU_DIA_HOTSPOTS,
  },
];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;

export function resolveSection(id: string | null | undefined): Section {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
}
