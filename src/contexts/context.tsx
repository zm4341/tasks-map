import { createContext } from "react";
import { App } from "obsidian";
import TasksMapPlugin from "../main";

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<TasksMapPlugin | undefined>(undefined);

interface TagsContextValue {
  allTags: string[];
  updateTaskTags: (taskId: string, newTags: string[]) => void; // eslint-disable-line no-unused-vars
}

export const TagsContext = createContext<TagsContextValue>({
  allTags: [],
  updateTaskTags: () => {},
});

// Canvas operations context for sidebar integration
export interface CanvasOperations {
  addTaskToCanvas: (taskId: string, position: { x: number; y: number }) => void;
  getCanvasTaskIds: () => string[];
}

export const CanvasContext = createContext<CanvasOperations | null>(null);
