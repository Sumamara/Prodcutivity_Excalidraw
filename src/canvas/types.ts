import type { ComponentProps } from "react";
import type { Excalidraw } from "@excalidraw/excalidraw";

/**
 * Derivamos los tipos de las props del propio componente en lugar de
 * importarlos de subrutas internas (`@excalidraw/excalidraw/types`), que
 * cambian entre versiones. Con la versión fijada en package.json esto es
 * estable y sobrevive a los upgrades mejor.
 */
type ExcalidrawProps = ComponentProps<typeof Excalidraw>;

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;

export type SceneElements = Parameters<OnChange>[0];
export type SceneAppState = Parameters<OnChange>[1];
export type SceneFiles = Parameters<OnChange>[2];

export type ExcalidrawAPI = Parameters<
  NonNullable<ExcalidrawProps["excalidrawAPI"]>
>[0];

export type ExcalidrawInitialData = ExcalidrawProps["initialData"];
