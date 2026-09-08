import { useCallback, useEffect, useRef, useState } from "react";

import { Canvas, type Viewport } from "./canvas/Canvas";
import { CellFields, type CellFieldsHandle } from "./canvas/CellFields";
import { SheetHotspots } from "./canvas/SheetHotspots";
import {
  cleanupLegacyStorage,
  loadActiveSection,
  loadTemplate,
  saveActiveSection,
} from "./canvas/persistence";
import type { ExcalidrawAPI } from "./canvas/types";
import { DateBar } from "./DateBar";
import { SaveIndicator } from "./SaveIndicator";
import { formatShort, todayISO } from "./dates";
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
  // Excalidraw arranca en "selection"; el efecto de la barra lo lleva a la
  // herramienta base ("hand") en cuanto detecta la discrepancia.
  const [toolType, setToolType] = useState<string>("selection");
  // Modo edición de celdas: un toque en la hoja abre el editor de esa celda.
  const [cellMode, setCellMode] = useState(false);
  // Modo plantilla (secciones con `supportsTemplate`): se edita la plantilla,
  // que luego se copia como semilla en cada día nuevo desde `templateFrom`.
  const [templateMode, setTemplateMode] = useState(false);
  const [templateFrom, setTemplateFrom] = useState<string | null>(null);
  const prevTemplateMode = useRef(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const hotspotsAnchorRef = useRef<HTMLDivElement>(null);
  const cellsAnchorRef = useRef<HTMLDivElement>(null);
  const cellFieldsRef = useRef<CellFieldsHandle>(null);
  const hotspotsClose = useRef<(() => void) | null>(null);
  const lastVp = useRef<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const lastTransform = useRef("");

  useEffect(() => {
    cleanupLegacyStorage();
  }, []);

  // Al cambiar de fecha/sección/modo los anchors son nodos nuevos (sin
  // transform): olvidamos el último transform para que el siguiente encaje sí lo
  // aplique. La herramienta activa (lápiz, modo celdas…) NO se toca.
  useEffect(() => {
    lastTransform.current = "";
  }, [sectionId, date, templateMode]);

  // Carga la fecha "aplica desde" de la plantilla de la sección (si la admite).
  // Al cambiar de sección se sale del modo plantilla.
  useEffect(() => {
    setTemplateMode(false);
    if (!active.supportsTemplate) {
      setTemplateFrom(null);
      return;
    }
    let alive = true;
    void loadTemplate(sectionId).then((t) => {
      if (alive) setTemplateFrom(t?.appliesFrom ?? null);
    });
    return () => {
      alive = false;
    };
  }, [sectionId, active.supportsTemplate]);

  // Al SALIR del modo plantilla, relee la fecha por si la plantilla se acaba de
  // crear (o de vaciar) en esta sesión.
  useEffect(() => {
    if (prevTemplateMode.current && !templateMode && active.supportsTemplate) {
      void loadTemplate(sectionId).then((t) =>
        setTemplateFrom(t?.appliesFrom ?? null),
      );
    }
    prevTemplateMode.current = templateMode;
  }, [templateMode, sectionId, active.supportsTemplate]);

  const toggleTemplate = useCallback(() => {
    setTemplateMode((on) => {
      const next = !on;
      // Al entrar sin plantilla previa: aplica desde el día que estás viendo.
      if (next) setTemplateFrom((f) => f ?? date);
      return next;
    });
  }, [date]);

  // Al salir del modo celdas, cierra el editor. (Poner Excalidraw en "selección"
  // cuando el modo celdas está activo lo hace la barra, que es la que aplica la
  // herramienta.)
  useEffect(() => {
    if (!cellMode) cellFieldsRef.current?.close();
  }, [cellMode]);

  const onCellTap = useCallback((x: number, y: number) => {
    cellFieldsRef.current?.editAt(x, y);
  }, []);

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
  // El lienzo se remonta al entrar/salir del modo plantilla (escena distinta).
  const canvasKey = templateMode ? `tpl:${sectionId}` : key;

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
        {active.supportsTemplate && (
          <div className="tpl-wrap">
            {templateMode && templateFrom && (
              <span className="tpl-note">
                se copia en cada día a partir del{" "}
                <b>{formatShort(templateFrom)}</b>
              </span>
            )}
            <button
              type="button"
              className="tpl-btn"
              aria-pressed={templateMode}
              title={
                templateMode ? "Salir del modo plantilla" : "Modo plantilla"
              }
              aria-label="Modo plantilla"
              onClick={toggleTemplate}
            >
              P
            </button>
          </div>
        )}

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
        <div className="page-frame" data-template-mode={templateMode || undefined}>
          <div className="sheet-layer">
            <div className="sheet-anchor" ref={anchorRef} style={sheetStyle}>
              <Template />
            </div>
          </div>

          <Canvas
            key={canvasKey}
            date={effDate}
            sectionId={sectionId}
            sheetW={active.width}
            sheetH={active.height}
            onViewport={handleViewport}
            onApiReady={setApi}
            onToolChange={setToolType}
            cellMode={cellMode}
            onCellTap={onCellTap}
            supportsTemplate={active.supportsTemplate}
            templateMode={templateMode}
            templateFrom={templateFrom}
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
                  ref={cellFieldsRef}
                  date={effDate}
                  sectionId={sectionId}
                  cells={active.cells}
                  sheetW={active.width}
                  sheetH={active.height}
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

          <Toolbar
            api={api}
            activeToolType={toolType}
            cellMode={cellMode}
            onCellMode={setCellMode}
            hasCells={!!active.cells?.length}
          />
        </div>
      </div>
    </div>
  );
}
