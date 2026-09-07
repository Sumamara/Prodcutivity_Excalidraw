import type { ComponentType } from "react";

import { SheetTemplate, HOTSPOTS as CONCENTRACION_HOTSPOTS } from "../canvas/SheetTemplate";
import type { Hotspot } from "../canvas/hotspot";
import {
  TimeBlockingTemplate,
  TIME_BLOCKING_HOTSPOTS,
} from "./TimeBlockingTemplate";
import { MenuDiaTemplate, MENU_DIA_HOTSPOTS } from "./MenuDiaTemplate";

export interface Section {
  id: string;
  label: string;
  /** Fondo SVG de la sección (lienzo virtual 1000 x 750). */
  Template: ComponentType;
  /** Zonas interactivas con explicación. */
  hotspots: Hotspot[];
}

export const SECTIONS: Section[] = [
  {
    id: "concentracion",
    label: "Concentración",
    Template: SheetTemplate,
    hotspots: CONCENTRACION_HOTSPOTS,
  },
  {
    id: "time-blocking",
    label: "Time blocking",
    Template: TimeBlockingTemplate,
    hotspots: TIME_BLOCKING_HOTSPOTS,
  },
  {
    id: "menu-dia",
    label: "Menú del día",
    Template: MenuDiaTemplate,
    hotspots: MENU_DIA_HOTSPOTS,
  },
];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;

export function resolveSection(id: string | null | undefined): Section {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
}
