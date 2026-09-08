import { useCallback, useEffect, useMemo, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";

import { markError, markPending, markSaved } from "../saveStatus";
import {
  cloneElements,
  debounce,
  loadScene,
  loadTemplateFor,
  saveScene,
  saveTemplateVersion,
} from "./persistence";
import {
  FIT_PAD_LEFT,
  FIT_PAD_RIGHT,
  FIT_PAD_Y,
  FIT_SCALE,
} from "./fitConfig";
import type {
  ExcalidrawAPI,
  ExcalidrawInitialData,
  SceneAppState,
  SceneElements,
  SceneFiles,
} from "./types";

// Al editar fitConfig.ts, recarga la página entera: el encaje de la hoja solo
// se aplica al montar el lienzo, no en un hot-reload.
if (import.meta.hot) {
  import.meta.hot.accept("./fitConfig", () => {
    window.location.reload();
  });
}

const AUTOSAVE_MS = 800;

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

interface CanvasProps {
  /** Fecha activa (ISO local YYYY-MM-DD): la escena se guarda por (fecha, sección). */
  date: string;
  /** Sección activa: define qué escena se carga y se guarda. */
  sectionId: string;
  /** Tamaño de la hoja de la sección (unidades de escena = px a zoom 100%). */
  sheetW: number;
  sheetH: number;
  /** Se llama (en rAF) cada vez que cambia scroll o zoom del lienzo. */
  onViewport: (v: Viewport) => void;
  /** Entrega la API de Excalidraw a App (para la barra propia). */
  onApiReady?: (api: ExcalidrawAPI) => void;
  /** Avisa cuando Excalidraw cambia de herramienta activa. */
  onToolChange?: (toolType: string) => void;
  /** Modo edición de celdas: un toque abre el editor de la celda tocada. */
  cellMode?: boolean;
  /** Toque (no arrastre) en el lienzo estando en cellMode; coords de escena. */
  onCellTap?: (x: number, y: number) => void;
  /** La sección admite plantilla: un día sin tinta propia se siembra con ella. */
  supportsTemplate?: boolean;
  /**
   * Modo plantilla activo: se edita la VERSIÓN de plantilla aplicable a `date`,
   * y al guardar se escribe la versión con `effectiveFrom = date`.
   */
  templateMode?: boolean;
}

type SceneSnapshot = {
  els: SceneElements;
  state: SceneAppState;
  files: SceneFiles;
};

/**
 * El fondo es la plantilla de la sección. Excalidraw va transparente encima y
 * la hoja se ancla a su viewport, así el zoom y el desplazamiento mueven hoja
 * y tinta juntas. Se monta con `key={sectionId}` desde App, de modo que
 * cambiar de pestaña reinicia el lienzo con la escena de esa sección.
 */
export function Canvas({
  date,
  sectionId,
  sheetW,
  sheetH,
  onViewport,
  onApiReady,
  onToolChange,
  cellMode,
  onCellTap,
  supportsTemplate,
  templateMode,
}: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastViewport = useRef<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const lastTool = useRef<string>("");
  const cellModeRef = useRef(false);
  cellModeRef.current = !!cellMode;
  const latestScene = useRef<SceneSnapshot | null>(null);
  const lastEls = useRef<SceneElements | null>(null);
  const lastFiles = useRef<SceneFiles | null>(null);
  const firstChange = useRef(true);
  // Solo se guarda si hubo un cambio real (trazo, borrado, texto). Abrir un día
  // y salir sin tocar nada NO debe crear una escena: si no, ese día dejaría de
  // sembrarse desde la plantilla (pasaría a tener "escena propia" vacía).
  const dirty = useRef(false);

  // Excalidraw acepta una promesa como initialData y muestra su propio
  // "cargando" mientras resuelve. Canvas se monta con key={fecha:sección}, así
  // que este useMemo corre una vez por (fecha, sección).
  const initialData = useMemo<ExcalidrawInitialData>(
    () =>
      (async () => {
        // Modo plantilla: se edita la VERSIÓN aplicable al día `date`.
        if (templateMode) {
          const tpl = await loadTemplateFor(sectionId, date);
          return {
            elements: tpl?.scene.elements ?? [],
            appState: {
              collaborators: undefined,
              viewBackgroundColor: "transparent",
              gridModeEnabled: false,
            },
            files: tpl?.scene.files,
          };
        }

        const restored = await loadScene(date, sectionId);

        // Día sin tinta propia (sin escena, o con una escena vacía): se siembra
        // con una COPIA (ids nuevos) de la versión de plantilla aplicable a ese
        // día. En cuanto dibujas/borras algo, se guarda y ese día pasa a ser
        // independiente de la plantilla.
        let elements = restored?.elements ?? [];
        const empty = !restored || restored.elements.length === 0;
        if (empty && supportsTemplate) {
          const tpl = await loadTemplateFor(sectionId, date);
          if (tpl && tpl.scene.elements.length) {
            elements = cloneElements(tpl.scene.elements);
          }
        }

        const appState = { ...restored?.appState };
        // Nunca restauramos el viewport guardado: el encaje (fitSheet) manda.
        delete appState.scrollX;
        delete appState.scrollY;
        delete appState.zoom;
        return {
          elements,
          appState: {
            ...appState,
            collaborators: undefined,
            viewBackgroundColor: "transparent",
            gridModeEnabled: false,
          },
          files: restored?.files,
        };
      })(),
    [date, sectionId, templateMode, supportsTemplate],
  );

  const saveNow = useCallback(
    (snap: SceneSnapshot, done: (ok: boolean) => void) => {
      if (templateMode) {
        void saveTemplateVersion(
          sectionId,
          date,
          snap.els,
          snap.state,
          snap.files,
        ).then(done);
      } else {
        void saveScene(date, sectionId, snap.els, snap.state, snap.files).then(
          done,
        );
      }
    },
    [date, sectionId, templateMode],
  );

  const persist = useMemo(
    () =>
      debounce((snap: SceneSnapshot) => {
        saveNow(snap, (ok) => (ok ? markSaved() : markError()));
      }, AUTOSAVE_MS),
    [saveNow],
  );

  const flushViewport = useCallback(() => {
    rafRef.current = null;
    onViewport(lastViewport.current);
  }, [onViewport]);

  const handleChange = useCallback(
    (elements: SceneElements, appState: SceneAppState, files: SceneFiles) => {
      const snap: SceneSnapshot = { els: elements, state: appState, files };
      latestScene.current = snap;

      // Guardar solo cuando cambian elementos o archivos, no al hacer pan/zoom.
      // El primer onChange (tras montar) es solo la escena cargada: baseline.
      if (firstChange.current) {
        firstChange.current = false;
        lastEls.current = elements;
        lastFiles.current = files;
      } else if (elements !== lastEls.current || files !== lastFiles.current) {
        lastEls.current = elements;
        lastFiles.current = files;
        dirty.current = true;
        markPending();
        persist(snap);
      }

      const tool = appState.activeTool.type;
      if (tool !== lastTool.current) {
        lastTool.current = tool;
        onToolChange?.(tool);
      }

      // Solo tocar el viewport cuando scroll o zoom CAMBIAN de verdad. Durante
      // un trazo no cambian: así no programamos rAF ni reescribimos el
      // transform de 3 capas en cada frame del lápiz (libera el hilo principal).
      const vp = lastViewport.current;
      if (
        appState.scrollX !== vp.scrollX ||
        appState.scrollY !== vp.scrollY ||
        appState.zoom.value !== vp.zoom
      ) {
        lastViewport.current = {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        };
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(flushViewport);
        }
      }
    },
    [persist, flushViewport, onToolChange],
  );

  // Centra la hoja en el área útil del marco, dejando libre la franja
  // izquierda (FIT_PAD_LEFT) que ocupa la barra de herramientas.
  const fitSheet = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;

    const box = wrapperRef.current?.getBoundingClientRect();
    const w = box?.width || window.innerWidth;
    const h = box?.height || window.innerHeight;

    const usableW = Math.max(1, w - FIT_PAD_LEFT - FIT_PAD_RIGHT);
    const usableH = Math.max(1, h - FIT_PAD_Y * 2);

    const fit = Math.min(usableW / sheetW, usableH / sheetH) * FIT_SCALE;
    const zoom = Math.max(0.1, Math.min(fit, 30));
    const scrollX = Math.round((FIT_PAD_LEFT + usableW / 2) / zoom - sheetW / 2);
    const scrollY = Math.round((FIT_PAD_Y + usableH / 2) / zoom - sheetH / 2);

    api.updateScene({
      appState: {
        scrollX,
        scrollY,
        zoom: { value: zoom as SceneAppState["zoom"]["value"] },
      },
    });
    lastViewport.current = { scrollX, scrollY, zoom };
    onViewport(lastViewport.current);
  }, [onViewport, sheetW, sheetH]);

  const onApi = useCallback(
    (api: ExcalidrawAPI) => {
      apiRef.current = api;
      onApiReady?.(api);
      // Ahora y de nuevo en los siguientes frames, por si Excalidraw reajusta
      // su propio viewport justo después de montar.
      fitSheet();
      requestAnimationFrame(fitSheet);
      setTimeout(fitSheet, 80);
    },
    [onApiReady, fitSheet],
  );

  // Guardado inmediato al salir de la fecha/sección/modo (por si el debounce no
  // disparó). Solo si hubo un cambio real: abrir y salir sin tocar no guarda.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const s = latestScene.current;
      if (!s || !dirty.current) return;
      saveNow(s, (ok) => (ok ? markSaved() : markError()));
    };
  }, [saveNow]);

  return (
    <div className="excalidraw-wrapper" ref={wrapperRef}>
      <Excalidraw
        excalidrawAPI={onApi}
        initialData={initialData}
        onChange={handleChange}
        onPointerUp={(_tool, st) => {
          if (!cellModeRef.current) return;
          // Solo un toque (sin arrastre) abre el editor de la celda.
          const dx = Math.abs(st.lastCoords.x - st.origin.x);
          const dy = Math.abs(st.lastCoords.y - st.origin.y);
          if (dx < 6 && dy < 6) onCellTap?.(st.origin.x, st.origin.y);
        }}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
    </div>
  );
}
