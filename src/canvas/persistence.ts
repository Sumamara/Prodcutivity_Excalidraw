import { serializeAsJSON } from "@excalidraw/excalidraw";

import type { SceneAppState, SceneElements, SceneFiles } from "./types";

const SCENE_PREFIX = "journal-horas:scene:v1:";
const ACTIVE_KEY = "journal-horas:active-section";

export interface RestoredScene {
  elements: SceneElements;
  appState: Partial<SceneAppState>;
  files: SceneFiles;
}

/**
 * Fase 1: una escena por sección, en `localStorage`. En la Fase 2 esto se
 * sustituye por un `upsert` contra Supabase (una fila `pages` por sección
 * con `scene_json` + `updated_at`).
 */
export function saveScene(
  sectionId: string,
  elements: SceneElements,
  appState: SceneAppState,
  files: SceneFiles,
): void {
  try {
    const json = serializeAsJSON(elements, appState, files, "local");
    localStorage.setItem(SCENE_PREFIX + sectionId, json);
  } catch (err) {
    console.warn("[persistence] no se pudo guardar la escena", err);
  }
}

export function loadScene(sectionId: string): RestoredScene | null {
  try {
    const raw = localStorage.getItem(SCENE_PREFIX + sectionId);
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

export function clearScene(sectionId: string): void {
  try {
    localStorage.removeItem(SCENE_PREFIX + sectionId);
  } catch {
    /* noop */
  }
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
