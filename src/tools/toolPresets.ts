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

const KEY = "journal-horas:tools:v1";

export const DEFAULT_PENCILS: Pencil[] = [
  { id: "p1", label: "Fino", color: "#1e2a3a", width: 1, opacity: 100 },
  { id: "p2", label: "Medio", color: "#1e2a3a", width: 2.5, opacity: 100 },
  { id: "p3", label: "Rotulador", color: "#2b6cb0", width: 4, opacity: 95 },
  { id: "p4", label: "Resaltador", color: "#f2b705", width: 16, opacity: 30 },
];

export function loadTools(): ToolConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ToolConfig>;
      if (Array.isArray(parsed.pencils) && parsed.pencils.length === 4) {
        return {
          pencils: parsed.pencils as Pencil[],
          activeId: parsed.activeId ?? "p1",
          penMode: parsed.penMode ?? false,
        };
      }
    }
  } catch {
    /* noop */
  }
  return {
    pencils: DEFAULT_PENCILS.map((p) => ({ ...p })),
    activeId: "p1",
    penMode: false,
  };
}

export function saveTools(cfg: ToolConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}
