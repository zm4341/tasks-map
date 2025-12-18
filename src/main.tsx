import { WorkspaceLeaf, Plugin } from "obsidian";

import TaskMapGraphItemView, { VIEW_TYPE } from "./views/TaskMapGraphItemView";
import TaskSidebarView, { SIDEBAR_VIEW_TYPE } from "./views/TaskSidebarView";
import {
  TasksMapSettings,
  DEFAULT_SETTINGS,
  GraphData,
  DEFAULT_GRAPH_DATA,
  PluginData,
  DEFAULT_PLUGIN_DATA,
} from "./types/settings";
import { TasksMapSettingTab } from "./settings/settings-tab";
import { Task } from "./types/task";

export default class TasksMapPlugin extends Plugin {
  settings: TasksMapSettings = DEFAULT_SETTINGS;
  graphData: GraphData = DEFAULT_GRAPH_DATA;
  
  // Callbacks for canvas operations (set by TaskMapGraphView)
  private _addTaskToCanvas: ((taskId: string, position: { x: number; y: number }, taskData?: unknown) => void) | null = null;
  private _getCanvasTaskIds: (() => string[]) | null = null;
  
  // Sidebar tasks storage (shared with canvas for updates)
  private _sidebarTasks: Task[] = [];

  async onload() {
    // Load all data (settings + graph data)
    await this.loadAllData();

    // Always register the view - it will handle the Dataview check internally
    this.registerView(
      VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new TaskMapGraphItemView(leaf)
    );

    // Register sidebar view
    this.registerView(
      SIDEBAR_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new TaskSidebarView(leaf, this)
    );

    this.addSettingTab(new TasksMapSettingTab(this.app, this));

    this.addCommand({
      id: "open-tasks-map-view",
      name: "Open map view",
      callback: () => {
        this.activateViewInMainArea();
      },
    });

    this.addCommand({
      id: "open-tasks-sidebar",
      name: "Open tasks sidebar",
      callback: () => {
        this.activateSidebar();
      },
    });

    this.addRibbonIcon("map", "Open tasks map view", () => {
      this.activateViewInMainArea();
    });
  }

  async loadAllData() {
    const data = await this.loadData();
    if (data) {
      // Handle legacy format (just settings) or new format (settings + graphData)
      if (data.settings) {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
        this.graphData = Object.assign({}, DEFAULT_GRAPH_DATA, data.graphData || {});
      } else {
        // Legacy format: data is just settings
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        this.graphData = DEFAULT_GRAPH_DATA;
      }
    } else {
      this.settings = DEFAULT_SETTINGS;
      this.graphData = DEFAULT_GRAPH_DATA;
    }
  }

  async saveAllData() {
    const data: PluginData = {
      settings: this.settings,
      graphData: this.graphData,
    };
    await this.saveData(data);
  }

  async loadSettings() {
    await this.loadAllData();
  }

  async saveSettings() {
    await this.saveAllData();
  }

  // Graph data specific methods
  getGraphData(): GraphData {
    return this.graphData;
  }

  async saveGraphData(data: GraphData) {
    this.graphData = data;
    await this.saveAllData();
  }

  async activateViewInMainArea() {
    const leaf = this.app.workspace.getLeaf(true); // true = main area
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async activateSidebar() {
    const existing = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  // Canvas operation registration (called by TaskMapGraphView)
  registerCanvasOperations(
    addTask: (taskId: string, position: { x: number; y: number }, taskData?: unknown) => void,
    getTaskIds: () => string[]
  ) {
    this._addTaskToCanvas = addTask;
    this._getCanvasTaskIds = getTaskIds;
  }

  unregisterCanvasOperations() {
    this._addTaskToCanvas = null;
    this._getCanvasTaskIds = null;
  }

  // Called by sidebar to add task to canvas
  addTaskToCanvas(taskId: string, position: { x: number; y: number }, taskData?: unknown) {
    if (this._addTaskToCanvas) {
      this._addTaskToCanvas(taskId, position, taskData);
    }
  }

  // Called by sidebar to get list of tasks on canvas
  getCanvasTaskIds(): string[] {
    if (this._getCanvasTaskIds) {
      return this._getCanvasTaskIds();
    }
    return this.graphData.nodes.map((n) => n.taskId);
  }

  // Called by sidebar to register its tasks (for canvas updates)
  setSidebarTasks(tasks: Task[]) {
    this._sidebarTasks = tasks;
  }

  // Called by canvas to get sidebar tasks for updates
  getSidebarTasks(): Task[] {
    return this._sidebarTasks;
  }

  async onunload() {
    // Release any resources configured by the plugin.
  }
}
