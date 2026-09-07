import { serializeAsJSON } from "@excalidraw/excalidraw";

import { getCells, getSceneJSON, putCells, putSceneJSON } from "./db";
import type { SceneAppState, SceneElements, SceneFiles } from "./types";

const ACTIVE_KEY = "journal-horas:active-section";

export interface RestoredScene {
  elements: SceneElements;
  appState: Partial<SceneAppState>;
  files: SceneFiles;
}

/**
 * Guardado por (fecha, sección) en IndexedDB (ver db.ts). En la Fase 2 esto se
 * sustituye por un `upsert` contra Supabase.
 */
export async function saveScene(
  date: string,
  sectionId: string,
  elements: SceneElements,
  appState: SceneAppState,
  files: SceneFiles,
): Promise<void> {
  try {
    const json = serializeAsJSON(elements, appState, files, "local");
    await putSceneJSON(date, sectionId, json);
  } catch (err) {
    console.warn("[persistence] no se pudo guardar la escena", err);
  }
}

export async function loadScene(
  date: string,
  sectionId: string,
): Promise<RestoredScene | null> {
  try {
    const raw = await getSceneJSON(date, sectionId);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      elements?: SceneElements;
      appState?: Partial<SceneAppState>;
      files?: SceneFiles;
    };

    return {
      elements: parsed.elements ?? [],
      // No restauramos el estado de colaboración.
      appState: { ...parsed.appState, collaborators: undefined },
      files: parsed.files ?? {},
    };
  } catch (err) {
    console.warn("[persistence] no se pudo leer la escena guardada", err);
    return null;
  }
}

/** Texto de los campos de celda por (fecha, sección): { "<col>-<fila>": valor }. */
export async function loadCells(
  date: string,
  sectionId: string,
): Promise<Record<string, string>> {
  return getCells(date, sectionId);
}

export async function saveCells(
  date: string,
  sectionId: string,
  values: Record<string, string>,
): Promise<void> {
  await putCells(date, sectionId, values);
}

export function loadActiveSection(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSection(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* noop */
  }
}

/** Limpia las claves de la versión anterior (localStorage sin fecha). */
export function cleanupLegacyStorage(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("journal-horas:scene:v1:") ||
          k.startsWith("journal-horas:cells:v1:"))
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* noop */
  }
}

/** Debounce simple para no escribir en cada frame del `onChange`. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
