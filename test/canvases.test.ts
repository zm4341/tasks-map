import {
  createCanvas,
  getNextCanvasName,
  parsePluginData,
} from "../src/lib/canvases";
import { DEFAULT_SETTINGS, GraphData } from "../src/types/settings";

const graph: GraphData = {
  nodes: [
    {
      id: "Tasks/A.md:3",
      position: { x: 10, y: 20 },
      taskId: "Tasks/A.md:3",
    },
  ],
  edges: [
    {
      id: "Tasks/A.md:3-Tasks/B.md:0",
      source: "Tasks/A.md:3",
      target: "Tasks/B.md:0",
      sourceHandle: "bottom",
      targetHandle: "top",
    },
  ],
  viewport: { x: 375, y: 438, zoom: 1.05 },
};

describe("parsePluginData", () => {
  it("starts with one empty canvas named 1", () => {
    const data = parsePluginData(null);

    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(data.canvases).toHaveLength(1);
    expect(data.canvases[0]).toMatchObject({
      name: "1",
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    expect(data.activeCanvasId).toBe(data.canvases[0].id);
  });

  it("reads the oldest format, which held only the settings", () => {
    const data = parsePluginData({ showTags: false });

    expect(data.settings.showTags).toBe(false);
    expect(data.canvases).toHaveLength(1);
  });

  it("turns the single graph of older versions into canvas 1", () => {
    const data = parsePluginData({
      settings: { ...DEFAULT_SETTINGS, showPriorities: false },
      graphData: graph,
    });

    expect(data.settings.showPriorities).toBe(false);
    expect(data.canvases).toHaveLength(1);
    expect(data.canvases[0]).toMatchObject({ name: "1", ...graph });
    expect(data.activeCanvasId).toBe(data.canvases[0].id);
  });

  it("keeps the canvases and the active canvas", () => {
    const first = { ...createCanvas("1", graph), id: "first" };
    const second = { ...createCanvas("Design"), id: "second" };
    const data = parsePluginData({
      settings: DEFAULT_SETTINGS,
      canvases: [first, second],
      activeCanvasId: "second",
    });

    expect(data.canvases).toEqual([first, second]);
    expect(data.activeCanvasId).toBe("second");
  });

  it("falls back to the first canvas for an unknown active canvas", () => {
    const data = parsePluginData({
      settings: DEFAULT_SETTINGS,
      canvases: [{ ...createCanvas("1"), id: "first" }],
      activeCanvasId: "deleted",
    });

    expect(data.activeCanvasId).toBe("first");
  });
});

describe("Canvases", () => {
  it("gives new canvases unique IDs", () => {
    expect(createCanvas("1").id).not.toBe(createCanvas("1").id);
  });

  it("names new canvases by their position", () => {
    expect(getNextCanvasName([])).toBe("1");
    expect(getNextCanvasName([{ name: "1" }])).toBe("2");
    expect(getNextCanvasName([{ name: "1" }, { name: "Design" }])).toBe("3");
  });

  it("skips names that are taken", () => {
    expect(getNextCanvasName([{ name: "2" }, { name: "3" }])).toBe("4");
  });
});
