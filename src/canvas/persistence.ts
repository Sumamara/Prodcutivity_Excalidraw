import { serializeAsJSON } from "@excalidraw/excalidraw";

import {
  db,
  getCells,
  getSceneJSON,
  getTemplateFor,
  putCells,
  putSceneJSON,
  putTemplateVersion,
} from "./db";
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
): Promise<boolean> {
  try {
    const json = serializeAsJSON(elements, appState, files, "local");
    return await putSceneJSON(date, sectionId, json);
  } catch (err) {
    console.warn("[persistence] no se pudo guardar la escena", err);
    return false;
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

/* ------------------------------- Plantillas ------------------------------- */

/**
 * Versión de plantilla aplicable a `date` (escena + su `effectiveFrom`).
 * `null` si no hay ninguna versión con fecha <= `date`.
 */
export async function loadTemplateFor(
  section: string,
  date: string,
): Promise<{ effectiveFrom: string; scene: RestoredScene } | null> {
  const row = await getTemplateFor(section, date);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.json) as {
      elements?: SceneElements;
      appState?: Partial<SceneAppState>;
      files?: SceneFiles;
    };
    return {
      effectiveFrom: row.effectiveFrom,
      scene: {
        elements: parsed.elements ?? [],
        appState: { ...parsed.appState, collaborators: undefined },
        files: parsed.files ?? {},
      },
    };
  } catch (err) {
    console.warn("[persistence] no se pudo leer la plantilla", err);
    return null;
  }
}

/** Guarda la versión de plantilla con fecha `effectiveFrom` (el día editado). */
export async function saveTemplateVersion(
  section: string,
  effectiveFrom: string,
  elements: SceneElements,
  appState: SceneAppState,
  files: SceneFiles,
): Promise<boolean> {
  try {
    const json = serializeAsJSON(elements, appState, files, "local");
    return await putTemplateVersion(section, effectiveFrom, json);
  } catch (err) {
    console.warn("[persistence] no se pudo guardar la plantilla", err);
    return false;
  }
}

/**
 * Copia profunda de elementos de escena con ids nuevos, pensada para sembrar un
 * día a partir de la plantilla: los trazos quedan independientes (borrar/editar
 * en ese día no toca la plantilla). Se limpian vínculos (bindings/contenedores)
 * por seguridad; para tinta y texto sueltos —el contenido típico— basta.
 */
export function cloneElements(els: SceneElements): SceneElements {
  const idMap = new Map<string, string>();
  const fresh = (old: string): string => {
    let n = idMap.get(old);
    if (!n) {
      n =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      idMap.set(old, n);
    }
    return n;
  };
  const rnd = () => Math.floor(Math.random() * 2 ** 31);

  return els.map((e) => {
    const src = e as Record<string, unknown>;
    const out: Record<string, unknown> = {
      ...src,
      id: fresh(e.id),
      groupIds: Array.isArray(src.groupIds)
        ? (src.groupIds as string[]).map(fresh)
        : [],
      boundElements: null,
      frameId: null,
      seed: rnd(),
      versionNonce: rnd(),
      version: (typeof src.version === "number" ? src.version : 1) + 1,
      updated: Date.now(),
      isDeleted: false,
    };
    if ("containerId" in src) out.containerId = null;
    if ("startBinding" in src) out.startBinding = null;
    if ("endBinding" in src) out.endBinding = null;
    return out;
  }) as unknown as SceneElements;
}

/* --------------------- Limpieza de semillas "congeladas" ------------------- */

/** Campos estables de un elemento (ignora id/seed/nonce/versión). */
function elementSig(e: Record<string, unknown>): string {
  const r = (n: unknown) => Math.round((typeof n === "number" ? n : 0) * 10) / 10;
  const parts: unknown[] = [
    e.type,
    r(e.x),
    r(e.y),
    r(e.width),
    r(e.height),
    r(e.angle),
    e.strokeColor,
    e.backgroundColor,
    e.strokeWidth,
    e.opacity,
  ];
  if (e.type === "freedraw" && Array.isArray(e.points)) {
    parts.push(
      JSON.stringify(
        (e.points as number[][]).map((p) => [r(p[0]), r(p[1])]),
      ),
    );
  } else if (e.type === "text") {
    parts.push(e.text ?? "", e.fontSize ?? "");
  }
  return parts.join("|");
}

/** Firma estructural de una escena (independiente del orden y de los ids). */
function sceneSig(els: unknown): string {
  if (!Array.isArray(els)) return "";
  return (els as Record<string, unknown>[])
    .filter((e) => !e.isDeleted)
    .map(elementSig)
    .sort()
    .join("~~");
}

/**
 * Borra las escenas de `section` que son una COPIA EXACTA de alguna versión de
 * plantilla (semillas que se persistieron por error antes de que el guardado
 * exigiera un cambio real). Así vuelven a seguir la plantilla. No toca días con
 * tinta propia (su firma no coincide). Pensado para ejecutarse una sola vez.
 */
export async function healSeededScenes(section: string): Promise<number> {
  try {
    const tplRows = await db.templates
      .where("section")
      .equals(section)
      .toArray();
    if (!tplRows.length) return 0;

    const tplSigs = new Set<string>();
    for (const r of tplRows) {
      try {
        const p = JSON.parse(r.json) as { elements?: unknown };
        tplSigs.add(sceneSig(p.elements));
      } catch {
        /* noop */
      }
    }

    const suffix = `::${section}`;
    const scenes = await db.scenes.toArray();
    let removed = 0;
    for (const s of scenes) {
      if (!s.key.endsWith(suffix)) continue;
      try {
        const p = JSON.parse(s.json) as { elements?: unknown };
        if (tplSigs.has(sceneSig(p.elements))) {
          await db.scenes.delete(s.key);
          removed++;
        }
      } catch {
        /* noop */
      }
    }
    return removed;
  } catch (err) {
    console.warn("[persistence] healSeededScenes", err);
    return 0;
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
): Promise<boolean> {
  return putCells(date, sectionId, values);
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
