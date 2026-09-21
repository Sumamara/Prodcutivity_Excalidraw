import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ACCIDENTAL_MS,
  cellId,
  columnOfCellId,
  clockHHMM,
  createStopwatch,
  createTimer,
  elapsedMs,
  formatElapsed,
  formatWorked,
  isFreeTimer,
  finishTimer,
  formatRemaining,
  isOvertime,
  normalizeEsp,
  parseEsp,
  pauseTimer,
  remainingMs,
  restRangeMinutes,
  resumeTimer,
  rowOfCellId,
  startPatch,
  type ActiveTimer,
  type TimerColumns,
} from "../src/timer/timerCore.ts";

const COLS: TimerColumns = {
  esp: "esp",
  ti: "ti",
  tf: "tf",
  real: "real",
  label: "obj",
};

function mk(now = 1_000_000, plannedMs = 60 * 60_000, prev = {}): ActiveTimer {
  return createTimer({
    id: "t1",
    date: "2026-09-08",
    sectionId: "concentracion",
    cols: COLS,
    row: 3,
    plannedMs,
    label: "Tarea",
    prev,
    owner: "tab-a",
    now,
  });
}

/* --------------------------------- parseEsp -------------------------------- */

test("parseEsp: enteros sueltos son minutos", () => {
  assert.equal(parseEsp("45"), 45);
  assert.equal(parseEsp("90"), 90);
  assert.equal(parseEsp(" 25 "), 25);
});

test("parseEsp: decimales sueltos son horas", () => {
  assert.equal(parseEsp("1.5"), 90);
  assert.equal(parseEsp("1,5"), 90);
  assert.equal(parseEsp("0.5"), 30);
  assert.equal(parseEsp(".25"), 15);
});

test("parseEsp: unidades explícitas", () => {
  assert.equal(parseEsp("2h"), 120);
  assert.equal(parseEsp("1.5h"), 90);
  assert.equal(parseEsp("1h30"), 90);
  assert.equal(parseEsp("1h 30m"), 90);
  assert.equal(parseEsp("1h30m"), 90);
  assert.equal(parseEsp("2 horas"), 120);
  assert.equal(parseEsp("90m"), 90);
  assert.equal(parseEsp("90 min"), 90);
  assert.equal(parseEsp("45 minutos"), 45);
});

test("parseEsp: formato h:mm", () => {
  assert.equal(parseEsp("1:30"), 90);
  assert.equal(parseEsp("0:45"), 45);
  assert.equal(parseEsp("1:59"), 119);
});

test("parseEsp: valores inválidos", () => {
  for (const bad of ["", "   ", "abc", "0", "-5", "1:60", "1:75", "1h75", "1441", "25h", "1.", "0:00", "0.001"]) {
    assert.equal(parseEsp(bad), null, `"${bad}" debería ser inválido`);
  }
  assert.equal(parseEsp(null), null);
  assert.equal(parseEsp(undefined), null);
});

test("parseEsp: límites", () => {
  assert.equal(parseEsp("1"), 1);
  assert.equal(parseEsp("1440"), 1440);
  assert.equal(parseEsp("24h"), 1440);
});

test("normalizeEsp devuelve minutos como texto o null", () => {
  assert.equal(normalizeEsp("1h30"), "90");
  assert.equal(normalizeEsp("1,5"), "90");
  assert.equal(normalizeEsp("nada"), null);
});

/* --------------------------------- formato --------------------------------- */

test("formatRemaining: cuenta atrás con ceil", () => {
  assert.equal(formatRemaining(60_000), "01:00");
  assert.equal(formatRemaining(59_001), "01:00");
  assert.equal(formatRemaining(59_000), "00:59");
  assert.equal(formatRemaining(1), "00:01");
  assert.equal(formatRemaining(3_600_000), "1:00:00");
  assert.equal(formatRemaining(5_400_000), "1:30:00");
});

test("formatRemaining: tiempo extra con signo −", () => {
  assert.equal(formatRemaining(0), "00:00");
  assert.equal(formatRemaining(-500), "00:00");
  assert.equal(formatRemaining(-1_000), "−00:01");
  assert.equal(formatRemaining(-312_000), "−05:12");
  assert.equal(formatRemaining(-3_661_000), "−1:01:01");
});

test("clockHHMM usa 24 h con ceros", () => {
  const d = new Date(2026, 8, 8, 9, 5, 30).getTime();
  assert.equal(clockHHMM(d), "09:05");
  const e = new Date(2026, 8, 8, 21, 47, 0).getTime();
  assert.equal(clockHHMM(e), "21:47");
});

test("columnOfCellId", () => {
  assert.equal(columnOfCellId("esp-3"), "esp");
  assert.equal(columnOfCellId("energia-12"), "energia");
  assert.equal(columnOfCellId("solo"), "solo");
});

test("cellId / rowOfCellId", () => {
  assert.equal(cellId("esp", 3), "esp-3");
  assert.equal(rowOfCellId("esp-3"), 3);
  assert.equal(rowOfCellId("energia-12"), 12);
  assert.equal(rowOfCellId("nofila"), null);
  assert.equal(rowOfCellId("esp-x"), null);
});

/* ------------------------------ estados/tiempo ----------------------------- */

test("elapsed/remaining corriendo", () => {
  const t = mk(1_000_000, 10 * 60_000);
  assert.equal(elapsedMs(t, 1_000_000), 0);
  assert.equal(elapsedMs(t, 1_030_000), 30_000);
  assert.equal(remainingMs(t, 1_030_000), 10 * 60_000 - 30_000);
  assert.equal(isOvertime(t, 1_030_000), false);
});

test("pausa y reanudación: en pausa el tiempo no avanza", () => {
  let t = mk(1_000_000, 10 * 60_000);
  t = pauseTimer(t, 1_060_000); // 60 s activos
  assert.equal(t.status, "paused");
  assert.equal(elapsedMs(t, 1_060_000), 60_000);
  assert.equal(elapsedMs(t, 2_000_000), 60_000); // no avanza
  t = resumeTimer(t, 2_000_000, "tab-b");
  assert.equal(t.status, "running");
  assert.equal(t.owner, "tab-b");
  assert.equal(elapsedMs(t, 2_030_000), 90_000);
});

test("pauseTimer/resumeTimer son idempotentes según el estado", () => {
  const t = mk();
  assert.equal(resumeTimer(t, 5, "x"), t); // ya corre
  const p = pauseTimer(t, 1_010_000);
  assert.equal(pauseTimer(p, 1_020_000), p); // ya en pausa
});

test("tiempo extra: cruza 0 y sigue contando", () => {
  const t = mk(1_000_000, 60_000);
  assert.equal(isOvertime(t, 1_059_999), false);
  assert.equal(isOvertime(t, 1_060_000), true);
  assert.equal(remainingMs(t, 1_065_000), -5_000);
});

/* --------------------------------- celdas ---------------------------------- */

test("startPatch pone Ti y vacía Tf/Real", () => {
  const now = new Date(2026, 8, 8, 14, 5, 0).getTime();
  const t = mk(now);
  assert.deepEqual(startPatch(t), {
    "ti-3": "14:05",
    "tf-3": null,
    "real-3": null,
  });
});

test("finish < 10 s descarta y restaura los valores previos", () => {
  const t = mk(1_000_000, 60 * 60_000, { ti: "09:00", tf: "10:00", real: "60" });
  const r = finishTimer(t, 1_000_000 + ACCIDENTAL_MS - 1);
  assert.equal(r.kind, "discard");
  assert.deepEqual(r.patch, { "ti-3": "09:00", "tf-3": "10:00", "real-3": "60" });
});

test("finish < 10 s sin valores previos los vacía", () => {
  const t = mk(1_000_000);
  const r = finishTimer(t, 1_002_000);
  assert.equal(r.kind, "discard");
  assert.deepEqual(r.patch, { "ti-3": null, "tf-3": null, "real-3": null });
});

test("finish >= 10 s rellena Tf y Real (min) y devuelve la sesión", () => {
  const start = new Date(2026, 8, 8, 14, 0, 0).getTime();
  const t = mk(start, 30 * 60_000);
  const end = start + 45 * 60_000 + 20_000; // 45 min 20 s → Real 45
  const r = finishTimer(t, end);
  assert.equal(r.kind, "finish");
  if (r.kind !== "finish") return;
  assert.deepEqual(r.patch, { "tf-3": "14:45", "real-3": "45" });
  assert.equal(r.session.activeMs, 45 * 60_000 + 20_000);
  assert.equal(r.session.plannedMs, 30 * 60_000);
  assert.equal(r.session.overtimeMs, 15 * 60_000 + 20_000);
  assert.equal(r.session.startedAt, start);
  assert.equal(r.session.endedAt, end);
  assert.equal(r.session.id, "t1");
});

test("finish: Real mínimo 1 y no cuenta las pausas", () => {
  let t = mk(0, 60 * 60_000);
  t = pauseTimer(t, 12_000); // 12 s activos
  const r = finishTimer(t, 10 * 60_000); // 10 min de pared, pero en pausa
  assert.equal(r.kind, "finish");
  if (r.kind !== "finish") return;
  assert.equal(r.patch["real-3"], "1"); // 12 s → mínimo 1
  assert.equal(r.session.activeMs, 12_000);
  assert.equal(r.session.overtimeMs, 0);
});

/* --------------------------------- descanso -------------------------------- */

test("restRangeMinutes: 15–20 % del tiempo trabajado", () => {
  assert.deepEqual(restRangeMinutes(60 * 60_000), { lo: 9, hi: 12 });
  assert.deepEqual(restRangeMinutes(25 * 60_000), { lo: 4, hi: 5 });
  assert.deepEqual(restRangeMinutes(90 * 60_000), { lo: 14, hi: 18 });
});

test("restRangeMinutes: mínimo 1 y hi >= lo", () => {
  assert.deepEqual(restRangeMinutes(2 * 60_000), { lo: 1, hi: 1 });
  assert.deepEqual(restRangeMinutes(0), { lo: 1, hi: 1 });
  const r = restRangeMinutes(10 * 60_000);
  assert.ok(r.hi >= r.lo);
});

/* -------------------------------- cronómetro ------------------------------- */

test("formatElapsed: cuenta hacia arriba", () => {
  assert.equal(formatElapsed(0), "00:00");
  assert.equal(formatElapsed(999), "00:00");
  assert.equal(formatElapsed(1_000), "00:01");
  assert.equal(formatElapsed(65_000), "01:05");
  assert.equal(formatElapsed(3_661_000), "1:01:01");
  assert.equal(formatElapsed(-5), "00:00");
});

test("formatWorked: lenguaje natural", () => {
  assert.equal(formatWorked(0), "menos de 1 min");
  assert.equal(formatWorked(20_000), "menos de 1 min");
  assert.equal(formatWorked(60_000), "1 min");
  assert.equal(formatWorked(25 * 60_000), "25 min");
  assert.equal(formatWorked(60 * 60_000), "1 h");
  assert.equal(formatWorked(65 * 60_000), "1 h 05 min");
  assert.equal(formatWorked(125 * 60_000), "2 h 05 min");
});

test("createStopwatch: libre, corriendo, sin fila", () => {
  const t = createStopwatch({ id: "sw", date: "2026-09-20", owner: "tab-a", now: 1000 });
  assert.equal(isFreeTimer(t), true);
  assert.equal(t.status, "running");
  assert.equal(t.row, -1);
  assert.equal(t.sectionId, "");
  assert.equal(elapsedMs(t, 61_000), 60_000);
  assert.equal(isFreeTimer(mk()), false);
});

test("cronómetro: pausa y reanudación no cuentan la pausa", () => {
  let t = createStopwatch({ id: "sw", date: "2026-09-20", owner: "a", now: 0 });
  t = pauseTimer(t, 30_000);
  assert.equal(elapsedMs(t, 500_000), 30_000);
  t = resumeTimer(t, 500_000, "a");
  assert.equal(elapsedMs(t, 520_000), 50_000);
});

test("finish de un cronómetro: siempre 'free' con sesión, sin tocar celdas", () => {
  const t = createStopwatch({ id: "sw", date: "2026-09-20", owner: "a", now: 0 });
  // incluso con menos de 10 s (no aplica el descarte de arranque accidental)
  const quick = finishTimer(t, 3_000);
  assert.equal(quick.kind, "free");
  const r = finishTimer(t, 25 * 60_000);
  assert.equal(r.kind, "free");
  if (r.kind !== "free") return;
  assert.equal(r.session.kind, "free");
  assert.equal(r.session.row, -1);
  assert.equal(r.session.activeMs, 25 * 60_000);
  assert.equal(r.session.overtimeMs, 0);
  assert.equal("patch" in r, false);
});
