import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";

import { debounce, loadScene, saveScene } from "./persistence";
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
}: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastViewport = useRef<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const lastTool = useRef<string>("");
  const latestScene = useRef<SceneSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Excalidraw acepta una promesa como initialData y muestra su propio
  // "cargando" mientras resuelve. Canvas se monta con key={fecha:sección}, así
  // que este useMemo corre una vez por (fecha, sección).
  const initialData = useMemo<ExcalidrawInitialData>(
    () =>
      loadScene(date, sectionId).then((restored) => {
        const appState = { ...restored?.appState };
        // Nunca restauramos el viewport guardado: el encaje (fitSheet) manda.
        delete appState.scrollX;
        delete appState.scrollY;
        delete appState.zoom;
        return {
          elements: restored?.elements ?? [],
          appState: {
            ...appState,
            collaborators: undefined,
            viewBackgroundColor: "transparent",
            gridModeEnabled: false,
          },
          files: restored?.files,
        };
      }),
    [date, sectionId],
  );

  const persist = useMemo(
    () =>
      debounce((snap: SceneSnapshot) => {
        void saveScene(date, sectionId, snap.els, snap.state, snap.files).then(
          () => setSavedAt(new Date().toLocaleTimeString()),
        );
      }, AUTOSAVE_MS),
    [date, sectionId],
  );

  const flushViewport = useCallback(() => {
    rafRef.current = null;
    onViewport(lastViewport.current);
  }, [onViewport]);

  const handleChange = useCallback(
    (elements: SceneElements, appState: SceneAppState, files: SceneFiles) => {
      const snap: SceneSnapshot = { els: elements, state: appState, files };
      latestScene.current = snap;
      persist(snap);

      const tool = appState.activeTool.type;
      if (tool !== lastTool.current) {
        lastTool.current = tool;
        onToolChange?.(tool);
      }

      lastViewport.current = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom.value,
      };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushViewport);
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
      setReady(true);
      onApiReady?.(api);
      // Ahora y de nuevo en los siguientes frames, por si Excalidraw reajusta
      // su propio viewport justo después de montar.
      fitSheet();
      requestAnimationFrame(fitSheet);
      setTimeout(fitSheet, 80);
    },
    [onApiReady, fitSheet],
  );

  // Guardado inmediato al salir de la fecha/sección (por si el debounce no disparó).
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const s = latestScene.current;
      if (s) void saveScene(date, sectionId, s.els, s.state, s.files);
    };
  }, [date, sectionId]);

  return (
    <div className="excalidraw-wrapper" ref={wrapperRef}>
      <Excalidraw
        excalidrawAPI={onApi}
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
      <SaveBadge savedAt={savedAt} ready={ready} />
    </div>
  );
}

function SaveBadge({
  savedAt,
  ready,
}: {
  savedAt: string | null;
  ready: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        zIndex: 5,
        padding: "4px 10px",
        borderRadius: 999,
        font: "500 12px/1.4 system-ui, sans-serif",
        background: "#ffffff",
        color: "#555",
        boxShadow: "0 1px 4px rgba(0,0,0,.15)",
        pointerEvents: "none",
      }}
    >
      {!ready
        ? "Cargando…"
        : savedAt
          ? `Guardado local · ${savedAt}`
          : "Guardado local activo"}
    </div>
  );
}
