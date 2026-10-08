import { createCanvas } from "../src/lib/canvases";
import { parsePluginData } from "../src/lib/plugin-data";
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

describe("parsePluginData sidebar", () => {
  it("shows tasks on the canvas and expands all groups by default", () => {
    expect(parsePluginData(null).sidebar).toEqual({
      hideOnCanvas: false,
      collapsedProjects: [],
    });
  });

  it("keeps the sidebar state", () => {
    const sidebar = {
      hideOnCanvas: true,
      collapsedProjects: ["AI/Agent", "Writing/Story"],
    };

    expect(
      parsePluginData({ settings: DEFAULT_SETTINGS, sidebar }).sidebar
    ).toEqual(sidebar);
  });

  it("fills in what older sidebar states lack", () => {
    const data = parsePluginData({
      settings: DEFAULT_SETTINGS,
      sidebar: { hideOnCanvas: true },
    });

    expect(data.sidebar).toEqual({ hideOnCanvas: true, collapsedProjects: [] });
  });
});
