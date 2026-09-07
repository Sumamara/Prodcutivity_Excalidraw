import { useCallback, useEffect, useRef, useState } from "react";

import { Canvas, type Viewport } from "./canvas/Canvas";
import { CellFields } from "./canvas/CellFields";
import { SheetHotspots } from "./canvas/SheetHotspots";
import {
  cleanupLegacyStorage,
  loadActiveSection,
  saveActiveSection,
} from "./canvas/persistence";
import type { ExcalidrawAPI } from "./canvas/types";
import { DateBar } from "./DateBar";
import { SaveIndicator } from "./SaveIndicator";
import { todayISO } from "./dates";
import { Toolbar } from "./tools/Toolbar";
import {
  DEFAULT_SECTION_ID,
  SECTIONS,
  resolveSection,
} from "./sections/registry";

export function App() {
  // Fecha global para las 3 pestañas. Al abrir, siempre hoy (no se restaura).
  const [date, setDate] = useState(() => todayISO());
  const [sectionId, setSectionId] = useState(
    () => loadActiveSection() ?? DEFAULT_SECTION_ID,
  );
  const active = resolveSection(sectionId);

  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [toolType, setToolType] = useState<string>("selection");

  const anchorRef = useRef<HTMLDivElement>(null);
  const hotspotsAnchorRef = useRef<HTMLDivElement>(null);
  const cellsAnchorRef = useRef<HTMLDivElement>(null);
  const hotspotsClose = useRef<(() => void) | null>(null);
  const lastVp = useRef<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const lastTransform = useRef("");

  useEffect(() => {
    cleanupLegacyStorage();
  }, []);

  // Al cambiar de fecha/sección los anchors son nodos nuevos (sin transform):
  // olvidamos el último transform para que el siguiente encaje sí lo aplique.
  useEffect(() => {
    lastTransform.current = "";
  }, [sectionId, date]);

  // Anclamos hoja y zonas interactivas al viewport de Excalidraw con el mismo
  // transform, sin re-render en cada frame. Si el transform no cambió (p. ej.
  // durante un trazo), salimos sin tocar el DOM: 3 capas menos que recomponer.
  const handleViewport = useCallback((v: Viewport) => {
    const t = `translate(${v.scrollX * v.zoom}px, ${v.scrollY * v.zoom}px) scale(${v.zoom})`;
    if (t === lastTransform.current) return;
    lastTransform.current = t;

    if (anchorRef.current) anchorRef.current.style.transform = t;
    if (hotspotsAnchorRef.current) hotspotsAnchorRef.current.style.transform = t;
    if (cellsAnchorRef.current) cellsAnchorRef.current.style.transform = t;

    const p = lastVp.current;
    if (p.scrollX !== v.scrollX || p.scrollY !== v.scrollY || p.zoom !== v.zoom) {
      hotspotsClose.current?.();
      lastVp.current = v;
    }
  }, []);

  const switchSection = useCallback((id: string) => {
    setSectionId(id);
    saveActiveSection(id);
  }, []);

  const Template = active.Template;
  const sheetStyle = { width: active.width, height: active.height };
  // Descansos activos no cambia con el día: se guarda bajo una clave fija.
  const effDate = active.dateScoped ? date : "global";
  const key = `${effDate}:${sectionId}`;

  return (
    <div className="app-shell">
      <header className="app-tabs" role="tablist" aria-label="Secciones">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === sectionId}
            className="app-tab"
            onClick={() => switchSection(s.id)}
          >
            {s.label}
          </button>
        ))}
        {active.dateScoped ? (
          <DateBar date={date} onChange={setDate} />
        ) : (
          <span className="date-static" title="Esta hoja es fija, no cambia con el día">
            Sin fecha · referencia
          </span>
        )}
        <SaveIndicator />
      </header>

      <div className="workspace">
        <div className="page-frame">
          <div className="sheet-layer">
            <div className="sheet-anchor" ref={anchorRef} style={sheetStyle}>
              <Template />
            </div>
          </div>

          <Canvas
            key={key}
            date={effDate}
            sectionId={sectionId}
            sheetW={active.width}
            sheetH={active.height}
            onViewport={handleViewport}
            onApiReady={setApi}
            onToolChange={setToolType}
          />

          {active.cells && active.cells.length > 0 && (
            <div className="cells-layer">
              <div
                className="cells-anchor"
                ref={cellsAnchorRef}
                style={sheetStyle}
              >
                <CellFields
                  key={key}
                  date={effDate}
                  sectionId={sectionId}
                  cells={active.cells}
                  activeToolType={toolType}
                />
              </div>
            </div>
          )}

          <div className="hotspot-layer">
            <div
              className="hotspot-anchor"
              ref={hotspotsAnchorRef}
              style={sheetStyle}
            >
              <SheetHotspots
                key={key}
                hotspots={active.hotspots}
                closeRef={hotspotsClose}
              />
            </div>
          </div>

          <Toolbar api={api} activeToolType={toolType} />
        </div>
      </div>
    </div>
  );
}
