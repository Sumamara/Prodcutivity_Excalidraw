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
 * Plantilla de una sección: una sola escena que se COPIA como semilla en cada
 * día nuevo (sin escena propia) cuya fecha sea >= `appliesFrom`. Al copiarse en
 * un día, ese día es libre de borrarla/modificarla sin afectar a la plantilla.
 */
interface TemplateRow {
  key: string; // sección, p. ej. "time-blocking"
  appliesFrom: string; // ISO local YYYY-MM-DD
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

export async function getTemplate(
  section: string,
): Promise<{ appliesFrom: string; json: string } | null> {
  try {
    const row = await db.templates.get(section);
    return row ? { appliesFrom: row.appliesFrom, json: row.json } : null;
  } catch (err) {
    console.warn("[db] getTemplate", err);
    return null;
  }
}

export async function putTemplate(
  section: string,
  appliesFrom: string,
  json: string,
): Promise<boolean> {
  try {
    await db.templates.put({
      key: section,
      appliesFrom,
      json,
      updated: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn("[db] putTemplate", err);
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
