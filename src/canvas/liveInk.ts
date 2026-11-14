import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import { makeId } from "./sceneClipboard";
import type { ExcalidrawAPI, SceneAppState, SceneElements } from "./types";

interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

interface ActiveStroke {
  pointerId: number;
  scrollX: number;
  scrollY: number;
  zoom: number;
  rectLeft: number;
  rectTop: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  simulatePressure: boolean;
  points: InkPoint[];
  predicted: InkPoint[];
}

/**
 * Motor ligero de tinta en vivo sobre un `<canvas>` 2D `desynchronized`:
 * - Lee `getCoalescedEvents()` para capturar muestras de alta frecuencia (120+ Hz)
 *   del Apple Pencil / stylus sin pasar por React ni Excalidraw durante el trazo.
 * - Lee `getPredictedEvents()` para dibujar un adelanto de 1 frame en la punta.
 * - Al soltar el lápiz, guarda el trazo completo como elemento `freedraw` real en
 *   Excalidraw (compatible con Dexie, Deshacer, Borrador y Selección).
 */
export class LiveInkSession {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private stroke: ActiveStroke | null = null;
  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d", { desynchronized: true }) ??
      canvas.getContext("2d");
  }

  get activePointerId(): number | null {
    return this.stroke?.pointerId ?? null;
  }

  start(e: PointerEvent, api: ExcalidrawAPI, host: HTMLElement): void {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const st = api.getAppState();
    const zoom = st.zoom.value;
    const x = (e.clientX - rect.left) / zoom - st.scrollX;
    const y = (e.clientY - rect.top) / zoom - st.scrollY;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    this.stroke = {
      pointerId: e.pointerId,
      scrollX: st.scrollX,
      scrollY: st.scrollY,
      zoom,
      rectLeft: rect.left,
      rectTop: rect.top,
      color: st.currentItemStrokeColor || "#1e2a3a",
      strokeWidth: st.currentItemStrokeWidth || 1,
      opacity: st.currentItemOpacity ?? 100,
      simulatePressure: e.pressure === 0 || e.pressure === 0.5,
      points: [{ x, y, pressure }],
      predicted: [],
    };
    this.scheduleDraw();
  }

  move(e: PointerEvent): void {
    const s = this.stroke;
    if (!s || e.pointerId !== s.pointerId) return;

    const samples =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    const list = samples.length > 0 ? samples : [e];

    for (const ev of list) {
      const x = (ev.clientX - s.rectLeft) / s.zoom - s.scrollX;
      const y = (ev.clientY - s.rectTop) / s.zoom - s.scrollY;
      const pressure = ev.pressure > 0 ? ev.pressure : 0.5;
      if (pressure !== 0.5 && ev.pressure > 0) s.simulatePressure = false;

      const prev = s.points[s.points.length - 1];
      // Evita puntos duplicados idénticos sin comerse micro-movimientos de letra.
      if (!prev || Math.hypot(x - prev.x, y - prev.y) >= 0.15) {
        s.points.push({ x, y, pressure });
      }
    }

    s.predicted = [];
    if (typeof e.getPredictedEvents === "function") {
      for (const pev of e.getPredictedEvents()) {
        s.predicted.push({
          x: (pev.clientX - s.rectLeft) / s.zoom - s.scrollX,
          y: (pev.clientY - s.rectTop) / s.zoom - s.scrollY,
          pressure: pev.pressure > 0 ? pev.pressure : 0.5,
        });
      }
    }

    this.scheduleDraw();
  }

  finish(e: PointerEvent, api: ExcalidrawAPI): void {
    const s = this.stroke;
    if (!s || e.pointerId !== s.pointerId) return;
    this.stroke = null;
    this.clear();

    const pts = [...s.points];
    // Un toque corto (punto de la "i", tilde, punto final) necesita 2 puntos
    // mínimos para que Excalidraw lo renderice y no lo descarte.
    if (pts.length === 1) {
      pts.push({
        x: pts[0].x + 0.05,
        y: pts[0].y + 0.05,
        pressure: pts[0].pressure,
      });
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const relPoints = pts.map((p) => [p.x - minX, p.y - minY] as const);
    const pressures = s.simulatePressure ? [] : pts.map((p) => p.pressure);

    const el = {
      id: makeId(),
      type: "freedraw",
      x: minX,
      y: minY,
      width: Math.max(0.1, maxX - minX),
      height: Math.max(0.1, maxY - minY),
      angle: 0,
      strokeColor: s.color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: s.strokeWidth,
      strokeStyle: "solid",
      roughness: 0,
      opacity: s.opacity,
      groupIds: [],
      frameId: null,
      index: null,
      roundness: null,
      seed: Math.floor(Math.random() * 2 ** 31),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      points: relPoints,
      pressures,
      simulatePressure: s.simulatePressure,
      lastCommittedPoint: null,
    } as unknown as SceneElements[number];

    const current = api.getSceneElements();
    api.updateScene({
      elements: [...current, el] as SceneElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  cancel(): void {
    this.stroke = null;
    this.clear();
  }

  private scheduleDraw(): void {
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }

  private clear(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const s = this.stroke;
    if (!ctx || !s) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(dpr, dpr);

    const all = s.predicted.length > 0 ? [...s.points, ...s.predicted] : s.points;
    if (all.length === 0) return;

    const toScreenX = (sx: number) => (sx + s.scrollX) * s.zoom;
    const toScreenY = (sy: number) => (sy + s.scrollY) * s.zoom;
    const baseSize = Math.max(0.9, s.strokeWidth * 4.25) * s.zoom;

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, s.opacity / 100));
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (all.length === 1) {
      const p = all[0];
      ctx.beginPath();
      ctx.arc(toScreenX(p.x), toScreenY(p.y), baseSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Dibujo por segmentos con curva cuadrática media y respuesta real a la presión.
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1];
      const curr = all[i];
      const pFactor = s.simulatePressure ? 1 : 0.55 + curr.pressure * 0.9;
      ctx.lineWidth = Math.max(0.6, baseSize * pFactor);
      ctx.beginPath();
      if (i === 1) {
        ctx.moveTo(toScreenX(prev.x), toScreenY(prev.y));
        ctx.lineTo(toScreenX(curr.x), toScreenY(curr.y));
      } else {
        const prev2 = all[i - 2];
        const mx0 = toScreenX((prev2.x + prev.x) / 2);
        const my0 = toScreenY((prev2.y + prev.y) / 2);
        const cx = toScreenX(prev.x);
        const cy = toScreenY(prev.y);
        const mx1 = toScreenX((prev.x + curr.x) / 2);
        const my1 = toScreenY((prev.y + curr.y) / 2);
        ctx.moveTo(mx0, my0);
        ctx.quadraticCurveTo(cx, cy, mx1, my1);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function isPenLikeStroke(
  e: PointerEvent,
  appState: SceneAppState,
  cellMode: boolean,
): boolean {
  if (cellMode || appState.activeTool.type !== "freedraw") return false;
  return e.pointerType === "pen";
}
