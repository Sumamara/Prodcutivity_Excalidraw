/**
 * Portapapeles propio de la tinta (botones Copiar / Pegar de la barra).
 *
 * En el iPad el menú de "mantener pulsado" de Excalidraw reemplaza la selección
 * por el trazo bajo el dedo, y el Ctrl+C/V nativo depende del foco y del puntero
 * (que se pierden al cambiar de día porque el lienzo se vuelve a montar). Este
 * módulo guarda los elementos copiados FUERA del lienzo (memoria + localStorage)
 * para pegarlos en cualquier día. Sin dependencias de Excalidraw en tiempo de
 * ejecución: la lógica es pura y se prueba con `node:test`.
 */

export type ClipElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  isDeleted?: boolean;
  groupIds?: readonly string[];
  containerId?: string | null;
  boundElements?: readonly { id: string; type: string }[] | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  fileId?: string | null;
  [key: string]: unknown;
};

export type ClipFiles = Record<string, unknown>;

export type Clip = { elements: ClipElement[]; files: ClipFiles };

/** Separación (px de escena) al pegar sobre elementos idénticos ya presentes. */
export const PASTE_STEP = 24;
const PASTE_MAX_STEPS = 20;

/**
 * Elementos a copiar: los seleccionados (no borrados) más los textos ligados a
 * un contenedor seleccionado. Conserva el orden de la escena.
 */
export function pickForCopy(
  elements: readonly ClipElement[],
  selectedIds: Readonly<Record<string, boolean | undefined>>,
): ClipElement[] {
  const live = elements.filter((e) => !e.isDeleted);
  const chosen = new Set(live.filter((e) => selectedIds[e.id]).map((e) => e.id));
  for (const e of live) {
    if (e.containerId && chosen.has(e.containerId)) chosen.add(e.id);
  }
  return live.filter((e) => chosen.has(e.id));
}

/** Archivos (imágenes) que usan los elementos copiados. */
export function pickFiles(
  elements: readonly ClipElement[],
  files: Readonly<Record<string, unknown>>,
): ClipFiles {
  const out: ClipFiles = {};
  for (const e of elements) {
    const id = e.fileId;
    if (id && files[id] !== undefined) out[id] = files[id];
  }
  return out;
}

/**
 * Desplazamiento (mismo en x e y) con el que pegar: 0 si no hay nada idéntico en
 * esa posición (lo normal al pegar en otro día: mismas coordenadas de la hoja) y
 * un paso más por cada colisión, para que pegar dos veces no apile las copias.
 */
export function freeOffset(
  existing: readonly ClipElement[],
  pasted: readonly ClipElement[],
): number {
  const live = existing.filter((e) => !e.isDeleted);
  const collides = (d: number) =>
    pasted.some((p) =>
      live.some(
        (e) =>
          e.type === p.type &&
          Math.abs(e.x - (p.x + d)) < 0.5 &&
          Math.abs(e.y - (p.y + d)) < 0.5,
      ),
    );
  for (let k = 0; k <= PASTE_MAX_STEPS; k++) {
    const d = k * PASTE_STEP;
    if (!collides(d)) return d;
  }
  return PASTE_MAX_STEPS * PASTE_STEP;
}

/**
 * Copia lista para insertar: ids nuevos (los vínculos internos se reasignan; los
 * que apuntan fuera de la copia se cortan), grupos nuevos, semillas nuevas,
 * desplazada `offset`. `index: null` deja que Excalidraw reasigne el orden.
 */
export function instantiate(
  clipElements: readonly ClipElement[],
  offset: number,
  newId: () => string,
): ClipElement[] {
  const idMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  for (const e of clipElements) idMap.set(e.id, newId());
  const mapGroup = (g: string) => {
    let n = groupMap.get(g);
    if (!n) {
      n = newId();
      groupMap.set(g, n);
    }
    return n;
  };
  const rnd = () => Math.floor(Math.random() * 2 ** 31);
  const inside = (id: string | undefined | null) => (id ? idMap.get(id) : undefined);

  return clipElements.map((src) => {
    const e = JSON.parse(JSON.stringify(src)) as ClipElement;
    const out: ClipElement = {
      ...e,
      id: idMap.get(src.id) as string,
      x: e.x + offset,
      y: e.y + offset,
      groupIds: (e.groupIds ?? []).map(mapGroup),
      frameId: null,
      index: null,
      seed: rnd(),
      versionNonce: rnd(),
      version: (typeof e.version === "number" ? e.version : 1) + 1,
      updated: Date.now(),
      isDeleted: false,
    };
    if ("containerId" in e) out.containerId = inside(e.containerId) ?? null;
    if ("boundElements" in e) {
      out.boundElements = e.boundElements
        ? e.boundElements
            .filter((b) => inside(b.id))
            .map((b) => ({ ...b, id: inside(b.id) as string }))
        : null;
    }
    for (const k of ["startBinding", "endBinding"] as const) {
      if (k in e) {
        const b = e[k];
        const to = b ? inside(b.elementId) : undefined;
        out[k] = b && to ? { ...b, elementId: to } : null;
      }
    }
    return out;
  });
}

/** Grupos de más alto nivel de los elementos (para seleccionarlos completos). */
export function topGroupIds(elements: readonly ClipElement[]): string[] {
  const s = new Set<string>();
  for (const e of elements) {
    const g = e.groupIds;
    if (g && g.length) s.add(g[g.length - 1]);
  }
  return [...s];
}

export function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ------------------------------ almacén ------------------------------ */

const KEY = "journal-horas:clipboard:v1";

function load(): Clip | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const p = JSON.parse(raw) as Clip;
    if (Array.isArray(p.elements) && p.elements.length) {
      return { elements: p.elements, files: p.files ?? {} };
    }
  } catch {
    /* noop */
  }
  return null;
}

let clip: Clip | null = load();
const listeners = new Set<() => void>();

export function getClip(): Clip | null {
  return clip;
}

export function hasClip(): boolean {
  return clip !== null;
}

export function subscribeClip(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Guarda una copia profunda (los elementos de Excalidraw están congelados). */
export function setClip(elements: readonly ClipElement[], files: ClipFiles): void {
  clip = {
    elements: JSON.parse(JSON.stringify(elements)) as ClipElement[],
    files: JSON.parse(JSON.stringify(files)) as ClipFiles,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(clip));
  } catch {
    // Cuota llena (imágenes grandes): sigue disponible en memoria esta sesión.
  }
  listeners.forEach((fn) => fn());
}
