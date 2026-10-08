import { Node, Edge } from "reactflow";
import { NodeColor } from "src/lib/node-colors";

// The statuses of TaskGenius: not started, in progress, completed, abandoned,
// planned and archived (see src/lib/task-status.ts)
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "canceled"
  | "done"
  | "planned"
  | "archived";
export type TaskType = "dataview" | "note";

export interface RawTask {
  status: string;
  text: string;
  link: { path: string };
}

export interface Task {
  id: string;
  type: TaskType; // How to identify this task for linking
  summary: string;
  text: string;
  tags: string[];
  status: TaskStatus;
  statusMark?: string; // The character between the brackets, e.g. "?" for [?]
  priority: string;
  link: string;
  incomingLinks: string[]; // References to other tasks (format depends on type)
  starred: boolean;
}

export interface TaskNodeData {
  task: Task;
  color?: NodeColor;
  layoutDirection?: "Horizontal" | "Vertical";
  showPriorities?: boolean;
  showTags?: boolean;
  debugVisualization?: boolean;
  tagColorMode?: "random" | "static";
  tagColorSeed?: number;
  tagStaticColor?: string;
}

export interface TaskEdgeData {
  hash: string;
  layoutDirection?: "Horizontal" | "Vertical";
  debugVisualization?: boolean;
}

export type TaskNode = Node<TaskNodeData, "task">;
export type TaskEdge = Edge<TaskEdgeData>;
