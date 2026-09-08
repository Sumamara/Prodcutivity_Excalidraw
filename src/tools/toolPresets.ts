/**
 * Config de la barra de herramientas propia. En la Fase 1 vive en
 * `localStorage`; luego pasa a las preferencias del usuario en Supabase.
 */
export interface Pencil {
  id: string;
  label: string;
  color: string;
  /** strokeWidth de Excalidraw (número libre). */
  width: number;
  /** 0–100. */
  opacity: number;
}

export interface ToolConfig {
  pencils: Pencil[];
  /** Id del elemento seleccionado en la barra: un id de lápiz o un tipo base. */
  activeId: string;
  /** Modo lápiz: ignora dedo/palma, solo dibuja el Pencil. */
  penMode: boolean;
}

const KEY = "journal-horas:tools:v2";

export const DEFAULT_PENCILS: Pencil[] = [
  { id: "p1", label: "Negro", color: "#1e2a3a", width: 0.3, opacity: 100 },
  { id: "p2", label: "Rojo", color: "#c0392b", width: 0.4, opacity: 100 },
  { id: "p3", label: "Azul", color: "#2b6cb0", width: 0.4, opacity: 100 },
  { id: "p4", label: "Resaltador", color: "#f2b705", width: 6, opacity: 35 },
];

export function loadTools(): ToolConfig {
  // La app SIEMPRE abre en "mover" (hand). El `activeId` guardado no se
  // restaura al arrancar; sí se conservan lápices (color/grosor) y modo lápiz.
  const base: ToolConfig = {
    pencils: DEFAULT_PENCILS.map((p) => ({ ...p })),
    activeId: "hand",
    penMode: false,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ToolConfig>;
      if (Array.isArray(parsed.pencils) && parsed.pencils.length === 4) {
        base.pencils = parsed.pencils as Pencil[];
        base.penMode = parsed.penMode ?? false;
      }
    }
  } catch {
    /* noop */
  }
  return base;
}

export function saveTools(cfg: ToolConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}
