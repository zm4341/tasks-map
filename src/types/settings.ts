export interface TasksMapSettings {
  showPriorities: boolean;
  showTags: boolean;

  layoutDirection: "Horizontal" | "Vertical";
  linkingStyle: "individual" | "csv" | "dataview";

  debugVisualization: boolean;

  // Tag color settings
  tagColorMode: "random" | "static";
  tagColorSeed: number;
  tagStaticColor: string;
}

export const DEFAULT_SETTINGS: TasksMapSettings = {
  showPriorities: true,
  showTags: true,

  layoutDirection: "Horizontal",
  linkingStyle: "csv",

  debugVisualization: false,

  // Tag color defaults
  tagColorMode: "random",
  tagColorSeed: 42,
  tagStaticColor: "#3b82f6",
};

// ========== Graph Data Persistence ==========

export interface SavedNodeData {
  id: string;
  position: { x: number; y: number };
  taskId: string;
  // Store complete task data for restoration
  taskData?: {
    id: string;
    type: string;
    summary: string;
    text: string;
    tags: string[];
    status: string;
    statusMark?: string;
    priority: string;
    link: string;
    incomingLinks: string[];
    starred: boolean;
    line?: number;
  };
}

export interface SavedEdgeData {
  id: string;
  source: string;
  target: string;
  // The node sides the edge connects ("top", "right", "bottom", "left"),
  // missing on edges saved before nodes had a handle on every side
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface SavedViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface GraphData {
  nodes: SavedNodeData[];
  edges: SavedEdgeData[];
  viewport: SavedViewport;
}

// A canvas of the map. The map has several, the user switches between them.
export interface CanvasData extends GraphData {
  id: string;
  name: string;
}

export type CanvasInfo = Pick<CanvasData, "id" | "name">;

// Combined plugin data (settings + canvases)
export interface PluginData {
  settings: TasksMapSettings;
  canvases: CanvasData[];
  // The canvas the map shows when it opens
  activeCanvasId: string;
}
