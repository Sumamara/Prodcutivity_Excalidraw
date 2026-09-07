import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawAPI } from "../canvas/types";
import { loadTools, saveTools, type Pencil, type ToolConfig } from "./toolPresets";
import "./Toolbar.css";

type Kind = "hand" | "selection" | "text" | "eraser";

const KINDS: { id: Kind; label: string }[] = [
  { id: "hand", label: "Mover" },
  { id: "selection", label: "Seleccionar" },
  { id: "text", label: "Texto" },
  { id: "eraser", label: "Borrador" },
];

const SWATCHES = [
  "#1e2a3a",
  "#000000",
  "#c0392b",
  "#2b6cb0",
  "#3f7a58",
  "#f2b705",
  "#8a8a8a",
  "#ffffff",
];

/**
 * Barra vertical propia. Sustituye a la de Excalidraw (oculta por CSS):
 * mover, seleccionar, texto, borrador y 4 lápices. Al tocar un lápiz queda
 * activo y se puede escribir de inmediato; tocarlo otra vez abre sus ajustes.
 */
export function Toolbar({
  api,
  activeToolType,
}: {
  api: ExcalidrawAPI | null;
  activeToolType: string;
}) {
  const [cfg, setCfg] = useState<ToolConfig>(() => loadTools());
  const [panelOpen, setPanelOpen] = useState(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const applyPencil = useCallback(
    (p: Pencil) => {
      if (!api) return;
      api.updateScene({
        appState: {
          currentItemStrokeColor: p.color,
          currentItemStrokeWidth: p.width,
          currentItemOpacity: p.opacity,
          currentItemRoughness: 0,
        },
      });
      api.setActiveTool({ type: "freedraw", locked: true });
    },
    [api],
  );

  const applyKind = useCallback(
    (k: Kind) => {
      if (!api) return;
      // Texto y borrador quedan fijos: se sigue escribiendo/borrando sin
      // volver a selección tras cada uso. Mover y seleccionar, no.
      api.setActiveTool({ type: k, locked: k === "eraser" || k === "text" });
    },
    [api],
  );

  const applyPenMode = useCallback(
    (on: boolean) => {
      if (!api) return;
      // Modo lápiz: Excalidraw ignora dedo/palma y solo dibuja el Pencil.
      api.updateScene({ appState: { penMode: on } });
    },
    [api],
  );

  // Reaplicar herramienta y modo lápiz cuando cambia el lienzo (sección nueva).
  useEffect(() => {
    if (!api) return;
    const c = cfgRef.current;
    const p = c.pencils.find((x) => x.id === c.activeId);
    if (p) applyPencil(p);
    else applyKind(c.activeId as Kind);
    applyPenMode(c.penMode);
  }, [api, applyPencil, applyKind, applyPenMode]);

  const selectPencil = (p: Pencil) => {
    if (cfg.activeId === p.id) {
      setPanelOpen((o) => !o);
      return;
    }
    const next = { ...cfg, activeId: p.id };
    setCfg(next);
    saveTools(next);
    applyPencil(p);
    setPanelOpen(false);
  };

  const selectKind = (k: Kind) => {
    const next = { ...cfg, activeId: k };
    setCfg(next);
    saveTools(next);
    applyKind(k);
    setPanelOpen(false);
  };

  const togglePenMode = () => {
    const next = { ...cfg, penMode: !cfg.penMode };
    setCfg(next);
    saveTools(next);
    applyPenMode(next.penMode);
  };

  const patchActivePencil = (patch: Partial<Pencil>) => {
    setCfg((c) => {
      const pencils = c.pencils.map((p) =>
        p.id === c.activeId ? { ...p, ...patch } : p,
      );
      const next = { ...c, pencils };
      saveTools(next);
      const ap = pencils.find((p) => p.id === c.activeId);
      if (ap) applyPencil(ap);
      return next;
    });
  };

  const activePencil = cfg.pencils.find((p) => p.id === cfg.activeId) ?? null;

  const isActive = (id: string) => {
    if (id === "hand" || id === "selection" || id === "text" || id === "eraser") {
      return cfg.activeId === id && activeToolType === id;
    }
    return cfg.activeId === id && activeToolType === "freedraw";
  };

  return (
    <div
      className="toolbar"
      role="toolbar"
      aria-label="Herramientas"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="tb-btn"
        title="Deshacer"
        aria-label="Deshacer"
        onClick={nativeHistory("undo")}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="tb-btn"
        title="Rehacer"
        aria-label="Rehacer"
        onClick={nativeHistory("redo")}
      >
        <RedoIcon />
      </button>

      <span className="tb-sep" />

      {KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          className="tb-btn"
          data-active={isActive(k.id)}
          title={k.label}
          aria-label={k.label}
          onClick={() => selectKind(k.id)}
        >
          <KindIcon kind={k.id} />
        </button>
      ))}

      <span className="tb-sep" />

      {cfg.pencils.map((p) => (
        <button
          key={p.id}
          type="button"
          className="tb-btn tb-pencil"
          data-active={isActive(p.id)}
          title={`${p.label} · toca de nuevo para ajustar`}
          aria-label={p.label}
          onClick={() => selectPencil(p)}
        >
          <span
            className="tb-swatch"
            style={{
              background: p.color,
              height: Math.max(2, Math.min(p.width, 12)),
              opacity: p.opacity / 100,
            }}
          />
        </button>
      ))}

      <span className="tb-sep" />

      <button
        type="button"
        className="tb-btn"
        data-active={cfg.penMode}
        aria-pressed={cfg.penMode}
        title={
          cfg.penMode
            ? "Modo lápiz: ON — ignora dedo y palma"
            : "Modo lápiz: OFF — dedo y Pencil dibujan"
        }
        aria-label="Modo lápiz"
        onClick={togglePenMode}
      >
        <PenModeIcon />
      </button>

      <button
        type="button"
        className="tb-btn"
        data-active={panelOpen}
        title="Ajustes del lápiz"
        aria-label="Ajustes del lápiz"
        onClick={() => setPanelOpen((o) => !o)}
      >
        <SlidersIcon />
      </button>

      {panelOpen && activePencil && (
        <ConfigPanel
          pencil={activePencil}
          onChange={patchActivePencil}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

function ConfigPanel({
  pencil,
  onChange,
  onClose,
}: {
  pencil: Pencil;
  onChange: (patch: Partial<Pencil>) => void;
  onClose: () => void;
}) {
  return (
    <div className="tb-panel" role="dialog" aria-label={`Ajustes · ${pencil.label}`}>
      <div className="tb-panel-head">
        <strong>{pencil.label}</strong>
        <button type="button" className="tb-x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="tb-field">
        <span>Color</span>
        <div className="tb-colors">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className="tb-color"
              data-active={c.toLowerCase() === pencil.color.toLowerCase()}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={pencil.color}
            onChange={(e) => onChange({ color: e.target.value })}
            aria-label="Color personalizado"
          />
        </div>
      </div>

      <label className="tb-field">
        <span>Grosor</span>
        <div className="tb-row">
          <input
            type="range"
            min={0.5}
            max={24}
            step={0.5}
            value={pencil.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
          />
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={pencil.width}
            onChange={(e) => onChange({ width: clamp(e.target.value, 0.5, 60) })}
          />
        </div>
      </label>

      <label className="tb-field">
        <span>Opacidad</span>
        <div className="tb-row">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pencil.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={pencil.opacity}
            onChange={(e) => onChange({ opacity: clamp(e.target.value, 0, 100) })}
          />
        </div>
      </label>
    </div>
  );
}

function clamp(v: string, min: number, max: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(n, max));
}

/**
 * Excalidraw no expone undo/redo en su API, así que pulsamos su botón nativo
 * (que ocultamos por CSS). `.click()` funciona aunque esté display:none.
 */
function nativeHistory(kind: "undo" | "redo") {
  return () => {
    const btn = document.querySelector<HTMLButtonElement>(
      `.excalidraw .${kind}-button-container button`,
    );
    if (btn) {
      btn.click();
      return;
    }
    // Fallback (layouts estrechos sin barra inferior): atajo de teclado.
    const target = document.querySelector(".excalidraw") ?? document;
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
        shiftKey: kind === "redo",
        bubbles: true,
        cancelable: true,
      }),
    );
  };
}

/* ---- iconos ---- */

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "hand") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l3.2 3.2h-2.1v4h4V7.1L20.3 10.3l-3.2 3.2v-2.1h-4v4h2.1L12 18.6l-3.2-3.2h2.1v-4h-4v2.1L3.7 10.3l3.2-3.2v2.1h4v-4H8.8L12 2z" />
      </svg>
    );
  }
  if (kind === "selection") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5 3l14 6.4-6 1.8-1.9 6.2L5 3z" />
      </svg>
    );
  }
  if (kind === "text") {
    return <span className="tb-glyph">T</span>;
  }
  // eraser
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 16.5L13.5 7a2 2 0 0 1 2.8 0l3.7 3.7a2 2 0 0 1 0 2.8L14 19H7.5z" />
      <path d="M9 21h11" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M20 17h0" />
      <circle cx="15" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PenModeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 4l5 5L9 20l-5 1 1-5z" />
      <path d="M13 6l5 5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h3" />
    </svg>
  );
}
