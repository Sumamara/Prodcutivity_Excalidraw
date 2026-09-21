import type { ComponentType } from "react";

import {
  SheetTemplate,
  HOTSPOTS as CONCENTRACION_HOTSPOTS,
  CELLS as CONCENTRACION_CELLS,
  SHEET_SIZE as CONCENTRACION_SIZE,
  type Cell,
} from "../canvas/SheetTemplate";
import type { Hotspot } from "../canvas/hotspot";
import type { TimerColumns } from "../timer/timerCore";
import {
  TimeBlockingTemplate,
  TIME_BLOCKING_HOTSPOTS,
  SHEET_SIZE as TIME_BLOCKING_SIZE,
} from "./TimeBlockingTemplate";
import {
  HabitosTemplate,
  HABITOS_HOTSPOTS,
  SHEET_SIZE as HABITOS_SIZE,
} from "./HabitosTemplate";
import { HabitsLayer } from "../habits/HabitsLayer";
import { HabitTabBadge } from "../habits/TabBadge";
import {
  MenuDiaTemplate,
  MENU_DIA_HOTSPOTS,
  SHEET_SIZE as MENU_DIA_SIZE,
} from "./MenuDiaTemplate";

/** Props de la capa dinámica (`overlay`) que una sección pinta sobre su hoja. */
export interface SectionOverlayProps {
  /** Día que se está viendo (ISO). */
  date: string;
  /** Cambia el día global (p. ej. desde la vista del mes). */
  onDateChange: (date: string) => void;
}

export interface Section {
  id: string;
  label: string;
  /** Fondo SVG de la sección. */
  Template: ComponentType;
  /** Tamaño del lienzo virtual de esta plantilla (px a zoom 100%). */
  width: number;
  height: number;
  /**
   * `true` (por defecto): una hoja por día (Concentración, Time blocking).
   * `false`: una sola hoja persistente que no cambia con la fecha (Descansos
   * activos es una lista de referencia que vas construyendo).
   */
  dateScoped: boolean;
  /** Zonas interactivas con explicación. */
  hotspots: Hotspot[];
  /** Celdas con campo de escritura digital (opcional). */
  cells?: Cell[];
  /**
   * `true`: la sección admite "modo plantilla" (icono P junto a la fecha). La
   * plantilla se copia como semilla en cada día nuevo (sin escena) cuya fecha
   * sea >= la fecha desde la que aplica.
   */
  supportsTemplate?: boolean;
  /**
   * Si está, la sección tiene temporizador por fila: ▶ en el margen izquierdo,
   * cuenta atrás desde Esp (en minutos) y autorrelleno de Ti/Tf/Real. Requiere
   * `cells`; las columnas se indican por su nombre (ids `<columna>-<fila>`).
   */
  timer?: TimerColumns;
  /**
   * Capa de componentes reales (botones, textos dinámicos) que se pinta sobre la
   * hoja con el MISMO `transform` que las demás capas y en unidades de la hoja.
   */
  overlay?: ComponentType<SectionOverlayProps>;
  /** Insignia que se muestra dentro de la pestaña (p. ej. "3 pendientes"). */
  tabBadge?: ComponentType;
}

export const SECTIONS: Section[] = [
  {
    id: "concentracion",
    label: "Concentración",
    Template: SheetTemplate,
    width: CONCENTRACION_SIZE.w,
    height: CONCENTRACION_SIZE.h,
    dateScoped: true,
    hotspots: CONCENTRACION_HOTSPOTS,
    cells: CONCENTRACION_CELLS,
    timer: { esp: "esp", ti: "ti", tf: "tf", real: "real", label: "obj" },
  },
  {
    id: "time-blocking",
    label: "Time blocking",
    Template: TimeBlockingTemplate,
    width: TIME_BLOCKING_SIZE.w,
    height: TIME_BLOCKING_SIZE.h,
    dateScoped: true,
    hotspots: TIME_BLOCKING_HOTSPOTS,
    supportsTemplate: true,
  },
  {
    id: "menu-dia",
    label: "Descansos activos",
    Template: MenuDiaTemplate,
    width: MENU_DIA_SIZE.w,
    height: MENU_DIA_SIZE.h,
    dateScoped: false,
    hotspots: MENU_DIA_HOTSPOTS,
  },
  {
    // Hábitos: una hoja VERTICAL por día (sigue la fecha global). Lo dinámico
    // (filas, rachas, marcas) lo pinta `overlay`; debajo hay tinta para notas.
    id: "habitos",
    label: "Hábitos",
    Template: HabitosTemplate,
    width: HABITOS_SIZE.w,
    height: HABITOS_SIZE.h,
    dateScoped: true,
    hotspots: HABITOS_HOTSPOTS,
    overlay: HabitsLayer,
    tabBadge: HabitTabBadge,
  },
];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;

export function resolveSection(id: string | null | undefined): Section {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
}
