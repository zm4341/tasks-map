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
    priority: string;
    link: string;
    incomingLinks: string[];
    starred: boolean;
  };
}

export interface SavedEdgeData {
  id: string;
  source: string;
  target: string;
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

export const DEFAULT_GRAPH_DATA: GraphData = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

// Combined plugin data (settings + graph data)
export interface PluginData {
  settings: TasksMapSettings;
  graphData: GraphData;
}

export const DEFAULT_PLUGIN_DATA: PluginData = {
  settings: DEFAULT_SETTINGS,
  graphData: DEFAULT_GRAPH_DATA,
};
