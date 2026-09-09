import Dexie, { type Table } from "dexie";

/**
 * Almacén local en IndexedDB. Cada fila va por (fecha, sección): el día 5 tiene
 * su escena y sus campos, el día 6 los suyos. Sin cuota de 5 MB como
 * `localStorage` y con escrituras asíncronas (no congela la interfaz).
 *
 * Sigue siendo local a este navegador: no sincroniza entre dispositivos, y en
 * Safari sin "añadir a pantalla de inicio" también se purga a los 7 días.
 */

interface SceneRow {
  key: string;
  json: string;
  updated: number;
}

interface CellsRow {
  key: string;
  values: Record<string, string>;
  updated: number;
}

/**
 * Plantilla de una sección como VERSIONES con fecha. Cada fila es una versión
 * guardada el día `effectiveFrom`. Para un día D, la versión aplicable es la de
 * mayor `effectiveFrom <= D`: editar el día 10 crea/actualiza la versión del 10
 * y no toca lo que ven los días 8-9 (que siguen con la versión del 8).
 * La versión aplicable se COPIA como semilla en cada día sin tinta propia.
 */
interface TemplateRow {
  key: string; // "<sección>::<effectiveFrom>"
  section: string;
  effectiveFrom: string; // ISO local YYYY-MM-DD
  json: string;
  updated: number;
}

class JournalDB extends Dexie {
  scenes!: Table<SceneRow, string>;
  cells!: Table<CellsRow, string>;
  templates!: Table<TemplateRow, string>;

  constructor() {
    super("journal-horas");
    this.version(1).stores({
      scenes: "key, updated",
      cells: "key, updated",
    });
    // v2: añade la tabla de plantillas (aditivo, sin migración de datos).
    this.version(2).stores({
      scenes: "key, updated",
      cells: "key, updated",
      templates: "key, updated",
    });
    // v3: la plantilla pasa a ser versiones con fecha. La fila única antigua
    // (key = "<sección>", con `appliesFrom`) se convierte en versión con fecha.
    this.version(3)
      .stores({
        scenes: "key, updated",
        cells: "key, updated",
        templates: "key, section, effectiveFrom",
      })
      .upgrade(async (tx) => {
        const t = tx.table("templates");
        const rows = (await t.toArray()) as Array<{
          key: string;
          appliesFrom?: string;
          effectiveFrom?: string;
          json: string;
          updated?: number;
        }>;
        for (const r of rows) {
          if (r.effectiveFrom || !r.appliesFrom) continue; // ya está en v3
          await t.delete(r.key);
          await t.put({
            key: `${r.key}::${r.appliesFrom}`,
            section: r.key,
            effectiveFrom: r.appliesFrom,
            json: r.json,
            updated: r.updated ?? Date.now(),
          });
        }
      });
  }
}

export const db = new JournalDB();

/** Clave de fila: "<fecha>::<sección>", p. ej. "2026-09-07::concentracion". */
function rowKey(date: string, section: string): string {
  return `${date}::${section}`;
}

export async function getSceneJSON(
  date: string,
  section: string,
): Promise<string | null> {
  try {
    const row = await db.scenes.get(rowKey(date, section));
    return row?.json ?? null;
  } catch (err) {
    console.warn("[db] getSceneJSON", err);
    return null;
  }
}

export async function putSceneJSON(
  date: string,
  section: string,
  json: string,
): Promise<boolean> {
  try {
    await db.scenes.put({ key: rowKey(date, section), json, updated: Date.now() });
    return true;
  } catch (err) {
    console.warn("[db] putSceneJSON", err);
    return false;
  }
}

/** ¿Tiene la versión al menos un elemento sin borrar? */
function templateHasContent(json: string): boolean {
  try {
    const p = JSON.parse(json) as { elements?: unknown };
    return (
      Array.isArray(p.elements) &&
      p.elements.some((e) => !(e as { isDeleted?: boolean }).isDeleted)
    );
  } catch {
    return false;
  }
}

/**
 * Versión de plantilla aplicable a `date`: la de mayor `effectiveFrom <= date`
 * QUE TENGA CONTENIDO. Una versión que quedó vacía (se borró todo al editarla)
 * se ignora y se usa la anterior con contenido.
 */
export async function getTemplateFor(
  section: string,
  date: string,
): Promise<{ effectiveFrom: string; json: string } | null> {
  try {
    const rows = await db.templates.where("section").equals(section).toArray();
    let best: TemplateRow | null = null;
    for (const r of rows) {
      if (r.effectiveFrom > date) continue;
      if (!templateHasContent(r.json)) continue;
      if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
    }
    return best ? { effectiveFrom: best.effectiveFrom, json: best.json } : null;
  } catch (err) {
    console.warn("[db] getTemplateFor", err);
    return null;
  }
}

/** Guarda (o reemplaza) la versión de plantilla con fecha `effectiveFrom`. */
export async function putTemplateVersion(
  section: string,
  effectiveFrom: string,
  json: string,
): Promise<boolean> {
  try {
    await db.templates.put({
      key: `${section}::${effectiveFrom}`,
      section,
      effectiveFrom,
      json,
      updated: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn("[db] putTemplateVersion", err);
    return false;
  }
}

export async function getCells(
  date: string,
  section: string,
): Promise<Record<string, string>> {
  try {
    const row = await db.cells.get(rowKey(date, section));
    return row?.values ?? {};
  } catch (err) {
    console.warn("[db] getCells", err);
    return {};
  }
}

export async function putCells(
  date: string,
  section: string,
  values: Record<string, string>,
): Promise<boolean> {
  try {
    await db.cells.put({ key: rowKey(date, section), values, updated: Date.now() });
    return true;
  } catch (err) {
    console.warn("[db] putCells", err);
    return false;
  }
}
