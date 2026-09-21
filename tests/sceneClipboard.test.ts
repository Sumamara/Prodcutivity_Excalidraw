import test from "node:test";
import assert from "node:assert/strict";

import {
  PASTE_STEP,
  freeOffset,
  instantiate,
  pickFiles,
  pickForCopy,
  topGroupIds,
  type ClipElement,
} from "../src/canvas/sceneClipboard.ts";

const el = (o: Partial<ClipElement> & { id: string }): ClipElement => ({
  type: "freedraw",
  x: 0,
  y: 0,
  ...o,
});

let n = 0;
const nid = () => `new-${++n}`;

test("pickForCopy: solo seleccionados, sin borrados, con su texto ligado", () => {
  const els = [
    el({ id: "a" }),
    el({ id: "b", isDeleted: true }),
    el({ id: "box", type: "rectangle" }),
    el({ id: "t", type: "text", containerId: "box" }),
    el({ id: "z" }),
  ];
  const got = pickForCopy(els, { a: true, b: true, box: true });
  assert.deepEqual(got.map((e) => e.id), ["a", "box", "t"]);
  assert.deepEqual(pickForCopy(els, {}), []);
});

test("pickFiles: solo los archivos usados", () => {
  const els = [el({ id: "i", type: "image", fileId: "f1" }), el({ id: "j" })];
  assert.deepEqual(pickFiles(els, { f1: { d: 1 }, f2: { d: 2 } }), { f1: { d: 1 } });
});

test("freeOffset: 0 sin colisión; un paso por cada copia ya pegada", () => {
  const clip = [el({ id: "a", x: 10, y: 20 })];
  assert.equal(freeOffset([], clip), 0);
  assert.equal(freeOffset([el({ id: "otro", x: 99, y: 99 })], clip), 0);
  const same = [el({ id: "x", x: 10, y: 20 })];
  assert.equal(freeOffset(same, clip), PASTE_STEP);
  const two = [...same, el({ id: "y", x: 10 + PASTE_STEP, y: 20 + PASTE_STEP })];
  assert.equal(freeOffset(two, clip), PASTE_STEP * 2);
  // un borrado no cuenta
  assert.equal(freeOffset([el({ id: "x", x: 10, y: 20, isDeleted: true })], clip), 0);
  // otro tipo en la misma posición no cuenta
  assert.equal(freeOffset([el({ id: "x", type: "text", x: 10, y: 20 })], clip), 0);
});

test("instantiate: ids nuevos, vínculos internos remapeados, desplazamiento", () => {
  const src = [
    el({
      id: "box",
      type: "rectangle",
      x: 5,
      y: 6,
      groupIds: ["g1"],
      boundElements: [
        { id: "t", type: "text" },
        { id: "fuera", type: "arrow" },
      ],
    }),
    el({ id: "t", type: "text", containerId: "box", groupIds: ["g1"] }),
    el({ id: "arr", type: "arrow", startBinding: { elementId: "box" }, endBinding: { elementId: "fuera" } }),
  ];
  const before = JSON.stringify(src);
  const out = instantiate(src, 10, nid);
  assert.equal(JSON.stringify(src), before, "no muta el original");
  assert.equal(new Set(out.map((e) => e.id)).size, 3);
  assert.ok(out.every((e) => !["box", "t", "arr"].includes(e.id)));
  const [box, t, arr] = out;
  assert.equal(box.x, 15);
  assert.equal(box.y, 16);
  assert.equal(t.containerId, box.id);
  assert.deepEqual(box.boundElements, [{ id: t.id, type: "text" }]);
  assert.equal(arr.startBinding?.elementId, box.id);
  assert.equal(arr.endBinding, null);
  assert.deepEqual(box.groupIds, t.groupIds);
  assert.notEqual(box.groupIds?.[0], "g1");
  assert.equal(box.index, null);
  assert.equal(box.isDeleted, false);
});

test("topGroupIds: el grupo más externo de cada elemento", () => {
  const els = [el({ id: "a", groupIds: ["in", "out"] }), el({ id: "b", groupIds: ["out"] }), el({ id: "c" })];
  assert.deepEqual(topGroupIds(els), ["out"]);
});
