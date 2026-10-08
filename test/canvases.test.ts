import {
  createCanvas,
  getFreeNodeId,
  getNextCanvasName,
} from "../src/lib/canvases";

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

  it("gives new nodes the ID of their task, unless a node has it", () => {
    expect(getFreeNodeId("a.md:8", ["b.md:8"])).toBe("a.md:8");
    expect(getFreeNodeId("a.md:8", ["a.md:8"])).toBe("a.md:8~2");
    expect(getFreeNodeId("a.md:8", ["a.md:8", "a.md:8~2"])).toBe("a.md:8~3");
  });
});
