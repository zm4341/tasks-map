import { isNodeColor, NODE_COLORS } from "../src/lib/node-colors";

describe("Node colors", () => {
  it("offers the six colors of Obsidian canvas cards", () => {
    expect(NODE_COLORS.map((color) => color.id)).toEqual([
      "red",
      "orange",
      "yellow",
      "green",
      "cyan",
      "purple",
    ]);
  });

  it("only accepts colors of the palette from saved data", () => {
    expect(isNodeColor("green")).toBe(true);
    expect(isNodeColor("magenta")).toBe(false);
    expect(isNodeColor(undefined)).toBe(false);
  });
});
