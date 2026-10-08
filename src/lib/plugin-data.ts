import {
  CanvasData,
  DEFAULT_SETTINGS,
  DEFAULT_SIDEBAR_STATE,
  GraphData,
  PluginData,
  SidebarState,
  TasksMapSettings,
} from "src/types/settings";
import { createCanvas, createCanvasId } from "./canvases";

// What data.json held in the versions before
interface SavedPluginData {
  settings?: Partial<TasksMapSettings>;
  // Before the map had several canvases
  graphData?: Partial<GraphData>;
  canvases?: Partial<CanvasData>[];
  activeCanvasId?: string;
  sidebar?: Partial<SidebarState>;
}

/** Reads data.json, including the formats of older versions */
export function parsePluginData(saved: unknown): PluginData {
  const data = (saved ?? {}) as SavedPluginData;

  // The oldest format held only the settings
  const settings: TasksMapSettings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings ?? (data as Partial<TasksMapSettings>)),
  };

  // The single graph of older versions becomes the first canvas
  const savedCanvases =
    data.canvases ?? (data.graphData ? [{ ...data.graphData, name: "1" }] : []);
  const canvases: CanvasData[] = savedCanvases.map((canvas, index) => ({
    ...createCanvas(canvas.name || String(index + 1), canvas),
    id: canvas.id || createCanvasId(),
  }));
  if (canvases.length === 0) canvases.push(createCanvas("1"));

  const activeCanvas =
    canvases.find((canvas) => canvas.id === data.activeCanvasId) ?? canvases[0];

  const sidebar: SidebarState = { ...DEFAULT_SIDEBAR_STATE, ...data.sidebar };

  return { settings, canvases, activeCanvasId: activeCanvas.id, sidebar };
}
