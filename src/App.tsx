import { useCallback, useRef, useState } from "react";

import { Canvas, type Viewport } from "./canvas/Canvas";
import { CellFields } from "./canvas/CellFields";
import { SheetHotspots } from "./canvas/SheetHotspots";
import { loadActiveSection, saveActiveSection } from "./canvas/persistence";
import type { ExcalidrawAPI } from "./canvas/types";
import { Toolbar } from "./tools/Toolbar";
import {
  DEFAULT_SECTION_ID,
  SECTIONS,
  resolveSection,
} from "./sections/registry";

export function App() {
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

  // Anclamos hoja y zonas interactivas al viewport de Excalidraw con el mismo
  // transform, sin re-render en cada frame. Al mover o hacer zoom cerramos el
  // popover para que no quede descolgado.
  const handleViewport = useCallback((v: Viewport) => {
    const t = `translate(${v.scrollX * v.zoom}px, ${v.scrollY * v.zoom}px) scale(${v.zoom})`;
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
      </header>

      <div className="workspace">
        <div className="page-frame">
          <div className="sheet-layer">
            <div className="sheet-anchor" ref={anchorRef}>
              <Template />
            </div>
          </div>

          <Canvas
            key={sectionId}
            sectionId={sectionId}
            onViewport={handleViewport}
            onApiReady={setApi}
            onToolChange={setToolType}
          />

          {active.cells && active.cells.length > 0 && (
            <div className="cells-layer">
              <div className="cells-anchor" ref={cellsAnchorRef}>
                <CellFields
                  key={sectionId}
                  sectionId={sectionId}
                  cells={active.cells}
                  activeToolType={toolType}
                />
              </div>
            </div>
          )}

          <div className="hotspot-layer">
            <div className="hotspot-anchor" ref={hotspotsAnchorRef}>
              <SheetHotspots
                key={sectionId}
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
