import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  addMinutesHHMM,
  addMonths,
  activeHabits,
  completion,
  createHabit,
  dayProgress,
  daysInMonth,
  DESC_MAX,
  SNOOZE_DEFAULT,
  SNOOZE_MAX,
  SNOOZE_PRESETS,
  dueReminders,
  normalizeSnooze,
  parseDescription,
  sanitizeDescription,
  parseSnoozeMinutes,
  effectiveFired,
  isActiveOn,
  isPausedOn,
  isScheduledOn,
  isValidTime,
  lateCount,
  minutesBetween,
  monthDays,
  monthLabel,
  monthStart,
  nextLog,
  normalizeDays,
  pausedHabits,
  pausedLast,
  resolveState,
  sanitizeName,
  scheduleFor,
  sortHabits,
  streaks,
  weekdayOf,
  withDays,
  withPaused,
  withResumed,
  type Habit,
  type LogMap,
  type LogState,
} from "../src/habits/habitCore.ts";

/** Hábito diario creado el 2026-09-01 (salvo que se indique otra cosa). */
function mk(over: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Meditar",
    remind: false,
    schedules: [{ from: "2026-09-01", days: [0, 1, 2, 3, 4, 5, 6] }],
    pauses: [],
    createdOn: "2026-09-01",
    order: 0,
    updated: 0,
    ...over,
  };
}

function logs(entries: Record<string, LogState>): LogMap {
  return new Map(Object.entries(entries));
}

/* -------------------------------- calendario ------------------------------- */

test("addDays: cruza mes, año y bisiesto", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(addDays("2026-09-20", 0), "2026-09-20");
  assert.equal(addDays("2026-03-08", 30), "2026-04-07");
});

test("weekdayOf: 0 = lunes … 6 = domingo", () => {
  assert.equal(weekdayOf("2026-09-21"), 0); // lunes
  assert.equal(weekdayOf("2026-09-20"), 6); // domingo
  assert.equal(weekdayOf("2024-02-29"), 3); // jueves
  assert.equal(weekdayOf("2026-01-01"), 3); // jueves
});

test("daysInMonth / monthDays / monthStart / monthLabel", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 9), 30);
  const d = monthDays("2026-02-14");
  assert.equal(d.length, 28);
  assert.equal(d[0], "2026-02-01");
  assert.equal(d[27], "2026-02-28");
  assert.equal(monthStart("2026-09-20"), "2026-09-01");
  assert.equal(monthLabel("2026-09-20"), "septiembre 2026");
});

test("addMonths devuelve el primer día del mes", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-01");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-01");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-01");
  assert.equal(addMonths("2026-09-05", 0), "2026-09-01");
});

test("isValidTime / addMinutesHHMM", () => {
  assert.equal(isValidTime("07:00"), true);
  assert.equal(isValidTime("23:59"), true);
  assert.equal(isValidTime("24:00"), false);
  assert.equal(isValidTime("7:00"), false);
  assert.equal(isValidTime("07:60"), false);
  assert.equal(isValidTime(undefined), false);
  assert.equal(addMinutesHHMM("07:50", 15), "08:05");
  assert.equal(addMinutesHHMM("23:50", 30), "23:59");
});

/* -------------------------- calendario del hábito -------------------------- */

test("scheduleFor: versión con mayor `from <= día`", () => {
  const h = mk({
    schedules: [
      { from: "2026-09-01", days: [0, 1, 2, 3, 4, 5, 6] },
      { from: "2026-09-10", days: [0, 2] },
    ],
  });
  assert.deepEqual(scheduleFor(h, "2026-09-09"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(scheduleFor(h, "2026-09-10"), [0, 2]);
  assert.equal(scheduleFor(h, "2026-08-31"), null);
});

test("isPausedOn: `to` es exclusivo y una pausa abierta sigue", () => {
  const h = mk({ pauses: [{ from: "2026-09-05", to: "2026-09-08" }, { from: "2026-09-20" }] });
  assert.equal(isPausedOn(h, "2026-09-04"), false);
  assert.equal(isPausedOn(h, "2026-09-05"), true);
  assert.equal(isPausedOn(h, "2026-09-07"), true);
  assert.equal(isPausedOn(h, "2026-09-08"), false);
  assert.equal(isPausedOn(h, "2026-09-20"), true);
  assert.equal(isPausedOn(h, "2027-01-01"), true);
});

test("isActiveOn / isScheduledOn", () => {
  const h = mk({ schedules: [{ from: "2026-09-01", days: [0, 2, 4] }] }); // L X V
  assert.equal(isActiveOn(h, "2026-08-31"), false); // antes de crearse
  assert.equal(isScheduledOn(h, "2026-08-31"), false);
  assert.equal(isScheduledOn(h, "2026-09-21"), true); // lunes
  assert.equal(isScheduledOn(h, "2026-09-22"), false); // martes
  assert.equal(isScheduledOn(h, "2026-09-23"), true); // miércoles
});

/* ----------------------------- estado de un día ---------------------------- */

test("resolveState: orden de resolución", () => {
  const h = mk({ time: "07:00" });
  const today = "2026-09-20";
  // no cuenta
  assert.equal(resolveState(h, "2026-08-31", undefined, today, "12:00"), "off");
  // marca explícita gana
  assert.equal(resolveState(h, "2026-09-10", "done", today, "12:00"), "done");
  assert.equal(resolveState(h, "2026-09-10", "partial", today, "12:00"), "partial");
  assert.equal(resolveState(h, "2026-09-10", "missed", today, "12:00"), "missed");
  // día pasado sin marca → ✗ (igual que una ✗ marcada)
  assert.equal(resolveState(h, "2026-09-10", undefined, today, "12:00"), "missed");
  // futuro
  assert.equal(resolveState(h, "2026-09-25", undefined, today, "12:00"), "future");
  // hoy: antes / en / después de la hora
  assert.equal(resolveState(h, today, undefined, today, "06:59"), "pending");
  assert.equal(resolveState(h, today, undefined, today, "07:00"), "late");
  assert.equal(resolveState(h, today, undefined, today, "23:00"), "late");
  // hoy con marca
  assert.equal(resolveState(h, today, "done", today, "23:00"), "done");
});

test("resolveState: sin hora nunca está 'late'", () => {
  const h = mk();
  assert.equal(resolveState(h, "2026-09-20", undefined, "2026-09-20", "23:59"), "pending");
});

test("resolveState: hábito que no toca ese día o en pausa es 'off'", () => {
  const h = mk({
    schedules: [{ from: "2026-09-01", days: [0] }],
    pauses: [{ from: "2026-09-14", to: "2026-09-21" }],
  });
  assert.equal(resolveState(h, "2026-09-22", undefined, "2026-09-25", "12:00"), "off"); // martes
  assert.equal(resolveState(h, "2026-09-14", undefined, "2026-09-25", "12:00"), "off"); // lunes en pausa
  assert.equal(resolveState(h, "2026-09-21", undefined, "2026-09-25", "12:00"), "missed"); // lunes activo
});

test("nextLog: vacío → ✓ → ~ → ✗ → vacío", () => {
  assert.equal(nextLog(undefined), "done");
  assert.equal(nextLog("done"), "partial");
  assert.equal(nextLog("partial"), "missed");
  assert.equal(nextLog("missed"), undefined);
});

test("nextLog en un día pasado: ✓ → ~ → ✗ → ✓ (vacío ya se ve como ✗)", () => {
  assert.equal(nextLog(undefined, true), "done");
  assert.equal(nextLog("done", true), "partial");
  assert.equal(nextLog("partial", true), undefined); // sin marca = ✗ visible
  assert.equal(nextLog("missed", true), "done"); // ✗ guardada antes: no queda un paso muerto
});

/* ---------------------------------- rachas --------------------------------- */

test("streaks: ✓ y ~ suman, ✗ corta, hoy pendiente no corta", () => {
  const h = mk();
  const l = logs({
    "2026-09-01": "done",
    "2026-09-02": "done",
    "2026-09-03": "done",
    "2026-09-04": "done",
    "2026-09-05": "done",
    "2026-09-06": "partial", // ~ no rompe
    "2026-09-07": "missed", // ✗ corta
    "2026-09-08": "done",
    "2026-09-09": "done",
    "2026-09-10": "done",
  });
  const s = streaks(h, l, "2026-09-11"); // hoy sin marca
  assert.equal(s.current, 3);
  assert.equal(s.best, 6);
});

test("streaks: un día pasado sin marca (✗ automático) corta", () => {
  const h = mk();
  const l = logs({ "2026-09-01": "done", "2026-09-02": "done", "2026-09-04": "done" });
  const s = streaks(h, l, "2026-09-04");
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
});

test("streaks: ✗ marcado hoy pone la racha en 0; hoy hecho la suma", () => {
  const h = mk();
  const base = { "2026-09-01": "done", "2026-09-02": "done" } as Record<string, LogState>;
  assert.deepEqual(streaks(h, logs({ ...base, "2026-09-03": "missed" }), "2026-09-03"), { current: 0, best: 2 });
  assert.deepEqual(streaks(h, logs({ ...base, "2026-09-03": "done" }), "2026-09-03"), { current: 3, best: 3 });
  assert.deepEqual(streaks(h, logs({ ...base, "2026-09-03": "partial" }), "2026-09-03"), { current: 3, best: 3 });
});

test("streaks: los días que no tocan se saltan (no rompen ni suman)", () => {
  // L X V: 2026-09-07 (lun), 09 (mié), 11 (vie), 14 (lun)
  const h = mk({
    createdOn: "2026-09-07",
    schedules: [{ from: "2026-09-07", days: [0, 2, 4] }],
  });
  const l = logs({
    "2026-09-07": "done",
    "2026-09-09": "done",
    "2026-09-11": "done",
    "2026-09-14": "done",
  });
  assert.deepEqual(streaks(h, l, "2026-09-14"), { current: 4, best: 4 });
  // hoy = martes (no toca): sigue igual
  assert.deepEqual(streaks(h, l, "2026-09-15"), { current: 4, best: 4 });
});

test("streaks: las pausas no rompen la racha", () => {
  const h = mk({ pauses: [{ from: "2026-09-05", to: "2026-09-08" }] }); // 5, 6, 7 en pausa
  const l = logs({
    "2026-09-01": "done",
    "2026-09-02": "done",
    "2026-09-03": "done",
    "2026-09-04": "done",
    "2026-09-08": "done",
  });
  assert.deepEqual(streaks(h, l, "2026-09-08"), { current: 5, best: 5 });
});

test("streaks: hábito creado hoy o en el futuro", () => {
  const h = mk({ createdOn: "2026-09-20", schedules: [{ from: "2026-09-20", days: [0, 1, 2, 3, 4, 5, 6] }] });
  assert.deepEqual(streaks(h, logs({}), "2026-09-20"), { current: 0, best: 0 });
  assert.deepEqual(streaks(h, logs({ "2026-09-20": "done" }), "2026-09-20"), { current: 1, best: 1 });
  assert.deepEqual(streaks(h, logs({}), "2026-09-10"), { current: 0, best: 0 });
});

test("streaks: récord se conserva aunque la racha actual sea menor", () => {
  const h = mk();
  const l = logs({
    "2026-09-01": "done",
    "2026-09-02": "done",
    "2026-09-03": "done",
    "2026-09-04": "done",
    "2026-09-05": "missed",
    "2026-09-06": "done",
  });
  assert.deepEqual(streaks(h, l, "2026-09-06"), { current: 1, best: 4 });
});

/* ------------------------------- porcentajes ------------------------------- */

test("completion: ~ vale 0,25 y hoy pendiente no se evalúa", () => {
  const h = mk();
  const l = logs({
    "2026-09-01": "done",
    "2026-09-02": "done",
    "2026-09-03": "partial",
    "2026-09-04": "missed",
    // 05: sin marca (día pasado = ✗)
  });
  const c = completion(h, l, "2026-09-01", "2026-09-30", "2026-09-06"); // hoy = 06 sin marca
  assert.equal(c.done, 2);
  assert.equal(c.partial, 1);
  assert.equal(c.missed, 2); // la ✗ marcada y el día pasado sin marca
  assert.equal(c.evaluated, 5);
  assert.equal(c.pct, (2 + 0.25) / 5);
});

test("completion: sin días evaluados → pct null", () => {
  const h = mk({ createdOn: "2026-09-20", schedules: [{ from: "2026-09-20", days: [0, 1, 2, 3, 4, 5, 6] }] });
  assert.equal(completion(h, logs({}), "2026-09-01", "2026-09-30", "2026-09-20").pct, null);
});

test("dayProgress: pendientes cuentan en el total", () => {
  const a = mk({ id: "a" });
  const b = mk({ id: "b" });
  const c = mk({ id: "c" });
  const d = mk({ id: "d", createdOn: "2026-09-25", schedules: [{ from: "2026-09-25", days: [0, 1, 2, 3, 4, 5, 6] }] });
  const store: Record<string, LogMap> = {
    a: logs({ "2026-09-20": "done" }),
    b: logs({ "2026-09-20": "partial" }),
    c: logs({}),
  };
  const p = dayProgress([a, b, c, d], (id) => store[id], "2026-09-20");
  assert.equal(p.total, 3); // d aún no existe
  assert.equal(p.done, 1);
  assert.equal(p.partial, 1);
  assert.equal(p.pct, (1 + 0.25) / 3);
  assert.equal(dayProgress([], () => undefined, "2026-09-20").pct, null);
});

/* --------------------------------- hábitos --------------------------------- */

test("createHabit: recordatorio exige hora; nombre saneado; días válidos", () => {
  const h = createHabit({ id: "x", name: "   Leer   mucho  ", time: "21:00", remind: true, today: "2026-09-20", order: 1, now: 5 });
  assert.equal(h.name, "Leer mucho");
  assert.equal(h.remind, true);
  assert.deepEqual(h.schedules, [{ from: "2026-09-20", days: [0, 1, 2, 3, 4, 5, 6] }]);
  assert.equal(h.createdOn, "2026-09-20");
  const noTime = createHabit({ id: "y", name: "A", remind: true, today: "2026-09-20", order: 0, now: 0 });
  assert.equal(noTime.remind, false);
  const bad = createHabit({ id: "z", name: "A", time: "25:00", remind: true, today: "2026-09-20", order: 0, now: 0 });
  assert.equal(bad.time, undefined);
  assert.equal(bad.remind, false);
});

test("sanitizeName / normalizeDays", () => {
  assert.equal(sanitizeName("x".repeat(60)).length, 40);
  assert.deepEqual(normalizeDays([4, 0, 0, 9, -1, 2]), [0, 2, 4]);
  assert.deepEqual(normalizeDays([]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(normalizeDays(undefined), [0, 1, 2, 3, 4, 5, 6]);
});

test("withDays: cambia desde hoy y respeta el pasado", () => {
  const h = mk(); // diario desde 09-01
  const h2 = withDays(h, [0], "2026-09-10", 1); // solo lunes desde el 10
  assert.equal(h2.schedules.length, 2);
  // antes del cambio se evalúa con el calendario anterior (todos los días)
  assert.equal(isScheduledOn(h2, "2026-09-09"), true); // miércoles
  // desde el cambio solo los lunes
  assert.equal(isScheduledOn(h2, "2026-09-11"), false); // viernes
  assert.equal(isScheduledOn(h2, "2026-09-14"), true); // lunes
  // mismo día: reemplaza la versión de hoy
  const h3 = withDays(h2, [1], "2026-09-10", 2);
  assert.equal(h3.schedules.length, 2);
  assert.deepEqual(scheduleFor(h3, "2026-09-10"), [1]);
  // sin cambios: misma referencia
  assert.equal(withDays(h, [0, 1, 2, 3, 4, 5, 6], "2026-09-10", 3), h);
});

test("withPaused / withResumed", () => {
  const h = mk();
  const p = withPaused(h, "2026-09-10", 1);
  assert.equal(isPausedOn(p, "2026-09-10"), true);
  assert.equal(isPausedOn(p, "2026-09-09"), false);
  assert.equal(withPaused(p, "2026-09-12", 2), p); // ya en pausa
  const r = withResumed(p, "2026-09-15", 3);
  assert.deepEqual(r.pauses, [{ from: "2026-09-10", to: "2026-09-15" }]);
  assert.equal(isPausedOn(r, "2026-09-14"), true);
  assert.equal(isPausedOn(r, "2026-09-15"), false);
  // pausar y reanudar el mismo día no deja rastro
  const same = withResumed(withPaused(h, "2026-09-10", 1), "2026-09-10", 2);
  assert.deepEqual(same.pauses, []);
  // reanudar algo que no está en pausa no hace nada
  assert.equal(withResumed(h, "2026-09-10", 4), h);
});

test("activeHabits / pausedHabits", () => {
  const a = mk({ id: "a" });
  const b = mk({ id: "b", pauses: [{ from: "2026-09-10" }] });
  assert.deepEqual(activeHabits([a, b], "2026-09-15").map((h) => h.id), ["a"]);
  assert.deepEqual(pausedHabits([a, b], "2026-09-15").map((h) => h.id), ["b"]);
});

test("sortHabits: por hora (sin hora al final), luego order", () => {
  const a = mk({ id: "a", time: "21:00", order: 0 });
  const b = mk({ id: "b", time: "07:00", order: 5 });
  const c = mk({ id: "c", order: 1 });
  const d = mk({ id: "d", time: "07:00", order: 2 });
  assert.deepEqual(sortHabits([a, b, c, d]).map((h) => h.id), ["d", "b", "a", "c"]);
});

/* ------------------------------- recordatorios ----------------------------- */

test("dueReminders: hora pasada, sin marca, toca hoy y no avisado", () => {
  const today = "2026-09-20"; // domingo
  const a = mk({ id: "a", time: "07:00", remind: true });
  const b = mk({ id: "b", time: "21:00", remind: true }); // aún no es la hora
  const c = mk({ id: "c", time: "07:00", remind: false }); // sin recordatorio
  const d = mk({ id: "d", time: "07:00", remind: true, schedules: [{ from: "2026-09-01", days: [0] }] }); // hoy no toca
  const e = mk({ id: "e", time: "06:00", remind: true }); // ya marcado
  const f = mk({ id: "f", time: "06:30", remind: true }); // ya avisado
  const g = mk({ id: "g", time: "06:45", remind: true, pauses: [{ from: "2026-09-10" }] }); // pausado
  const logsOf = (id: string): LogMap | undefined => (id === "e" ? logs({ [today]: "done" }) : undefined);
  const due = dueReminders({
    habits: [a, b, c, d, e, f, g],
    logsOf,
    today,
    nowHHMM: "08:00",
    fired: new Set(["f"]),
  });
  assert.deepEqual(due.map((h) => h.id), ["a"]);
  // a las 07:00 en punto ya está vencido; a las 06:59 no
  assert.equal(dueReminders({ habits: [a], logsOf, today, nowHHMM: "07:00", fired: new Set() }).length, 1);
  assert.equal(dueReminders({ habits: [a], logsOf, today, nowHHMM: "06:59", fired: new Set() }).length, 0);
});

test("lateCount: solo hoy, con hora pasada y sin marca", () => {
  const today = "2026-09-20";
  const a = mk({ id: "a", time: "07:00" });
  const b = mk({ id: "b", time: "21:00" });
  const c = mk({ id: "c" }); // sin hora
  const d = mk({ id: "d", time: "06:00" });
  const logsOf = (id: string): LogMap | undefined => (id === "d" ? logs({ [today]: "done" }) : undefined);
  assert.equal(lateCount([a, b, c, d], logsOf, today, "08:00"), 1);
  assert.equal(lateCount([a, b, c, d], logsOf, today, "22:00"), 2);
});

test("minutesBetween", () => {
  assert.equal(minutesBetween("07:00", "07:05"), 5);
  assert.equal(minutesBetween("07:00", "06:30"), -30);
  assert.equal(minutesBetween("00:00", "23:59"), 1439);
});

test("effectiveFired: cambiar la hora del hábito rearma el aviso", () => {
  const a = mk({ id: "a", time: "07:00", remind: true });
  const b = mk({ id: "b", time: "08:00", remind: true });
  const c = mk({ id: "c", time: "09:00", remind: true });
  const ids = ["a", "b"];
  // a avisó a las 07:00 (sigue igual); b avisó a las 06:00 pero ahora es 08:00; c nunca avisó
  const times = { a: "07:00", b: "06:00" };
  const set = effectiveFired([a, b, c], ids, times);
  assert.equal(set.has("a"), true);
  assert.equal(set.has("b"), false);
  assert.equal(set.has("c"), false);
  // sin registro de hora (datos antiguos) se respeta el aviso
  assert.equal(effectiveFired([a], ["a"], {}).has("a"), true);
  // quitar la hora también lo rearma (time undefined ≠ "07:00")
  const noTime = mk({ id: "a", time: undefined, remind: false });
  assert.equal(effectiveFired([noTime], ["a"], { a: "07:00" }).has("a"), false);
});

test("parseSnoozeMinutes: enteros de 1 a 240, nada más", () => {
  assert.equal(parseSnoozeMinutes("45"), 45);
  assert.equal(parseSnoozeMinutes(" 7 "), 7);
  assert.equal(parseSnoozeMinutes("1"), 1);
  assert.equal(parseSnoozeMinutes(String(SNOOZE_MAX)), SNOOZE_MAX);
  for (const bad of ["", "0", "241", "-5", "1.5", "1,5", "abc", "12m", "1000", "٣"]) {
    assert.equal(parseSnoozeMinutes(bad), null, bad);
  }
});

test("normalizeSnooze: lo inválido vuelve al predeterminado", () => {
  assert.equal(normalizeSnooze(30), 30);
  for (const bad of [0, -1, 241, 2.5, NaN, "15", null, undefined]) {
    assert.equal(normalizeSnooze(bad), SNOOZE_DEFAULT);
  }
  assert.ok(SNOOZE_PRESETS.includes(SNOOZE_DEFAULT));
});

test("pausedLast: los pausados hoy van al final, sin alterar el orden relativo", () => {
  const today = "2026-09-20";
  const a = mk({ id: "a", time: "07:00" });
  const b = mk({ id: "b", time: "08:00", pauses: [{ from: "2026-09-01" }] });
  const c = mk({ id: "c", time: "09:00" });
  const d = mk({ id: "d", time: "10:00", pauses: [{ from: "2026-09-01" }] });
  assert.deepEqual(pausedLast([a, b, c, d], today).map((h) => h.id), ["a", "c", "b", "d"]);
  // una pausa ya terminada no cuenta
  const e = mk({ id: "e", time: "06:00", pauses: [{ from: "2026-08-01", to: "2026-08-10" }] });
  assert.deepEqual(pausedLast([e, b], today).map((h) => h.id), ["e", "b"]);
});

test("sanitizeDescription: conserva las líneas, limpia espacios y recorta", () => {
  assert.equal(sanitizeDescription("  Propósito:  calma \r\n\r\n\r\n\r\nVersión mínima: 1 min  "), "Propósito: calma\n\nVersión mínima: 1 min");
  assert.equal(sanitizeDescription("   \n \t "), "");
  assert.equal(sanitizeDescription("a".repeat(DESC_MAX + 50)).length, DESC_MAX);
});

test("parseDescription: reconoce Propósito / Versión mínima / Versión completa", () => {
  const parts = parseDescription(
    "Propósito: cuidar mi cuerpo\nversion minima - 2 min de estiramiento\nVersión completa: 30 min\nnota libre: sin etiqueta\n\nsolo texto",
  );
  assert.deepEqual(parts, [
    { label: "Propósito", text: "cuidar mi cuerpo" },
    { label: "Versión mínima", text: "2 min de estiramiento" },
    { label: "Versión completa", text: "30 min" },
    { text: "nota libre: sin etiqueta" },
    { text: "solo texto" },
  ]);
  assert.deepEqual(parseDescription(""), []);
});

test("createHabit: la descripción es opcional y no deja clave vacía", () => {
  const base = { id: "x", name: "A", today: "2026-09-20", order: 0, now: 1 };
  assert.equal("description" in createHabit(base), false);
  assert.equal("description" in createHabit({ ...base, description: "   " }), false);
  assert.equal(createHabit({ ...base, description: " Propósito: x " }).description, "Propósito: x");
});
