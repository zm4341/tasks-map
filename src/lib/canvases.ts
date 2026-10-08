import { CanvasData, GraphData, SavedTaskData } from "src/types/settings";
import { Task } from "src/types/task";

export function createCanvasId(): string {
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

/**
 * A new node takes the ID of its task. Nodes keep their IDs when their tasks
 * move, so another node may have it already.
 */
export function getFreeNodeId(taskId: string, nodeIds: string[]): string {
  const taken = new Set(nodeIds);
  let id = taskId;
  for (let number = 2; taken.has(id); number++) id = `${taskId}~${number}`;
  return id;
}

export function toSavedTask(task: Task): SavedTaskData {
  return {
    id: task.id,
    type: task.type,
    summary: task.summary,
    text: task.text,
    tags: task.tags,
    status: task.status,
    statusMark: task.statusMark,
    priority: task.priority,
    link: task.link,
    incomingLinks: task.incomingLinks,
    starred: task.starred,
    // Tasks scanned by the sidebar know their line
    line: (task as Task & { line?: number }).line,
  };
}
