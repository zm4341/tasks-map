import { CanvasData, GraphData } from "src/types/settings";

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
