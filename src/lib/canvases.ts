import {
  CanvasData,
  DEFAULT_SETTINGS,
  GraphData,
  PluginData,
  TasksMapSettings,
} from "src/types/settings";

// What data.json held in the versions before
interface SavedPluginData {
  settings?: Partial<TasksMapSettings>;
  // Before the map had several canvases
  graphData?: Partial<GraphData>;
  canvases?: Partial<CanvasData>[];
  activeCanvasId?: string;
}

function createCanvasId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createCanvas(
  name: string,
  graph: Partial<GraphData> = {}
): CanvasData {
  return {
    id: createCanvasId(),
    name,
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
    viewport: graph.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

/** New canvases are numbered by their position, skipping taken names */
export function getNextCanvasName(canvases: { name: string }[]): string {
  const names = new Set(canvases.map((canvas) => canvas.name));
  let number = canvases.length + 1;
  while (names.has(String(number))) number++;
  return String(number);
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

  return { settings, canvases, activeCanvasId: activeCanvas.id };
}
