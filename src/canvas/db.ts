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

class JournalDB extends Dexie {
  scenes!: Table<SceneRow, string>;
  cells!: Table<CellsRow, string>;

  constructor() {
    super("journal-horas");
    this.version(1).stores({
      scenes: "key, updated",
      cells: "key, updated",
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
