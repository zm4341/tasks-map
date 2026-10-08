import { alignBox, boxesOverlap } from "../src/lib/alignment";

// Nodes are 250 wide, their height depends on the title and the tags
const node = (x: number, y: number, height = 80) => ({
  x,
  y,
  width: 250,
  height,
});

describe("alignBox", () => {
  it("leaves a box alone that is not close to a line", () => {
    const alignment = alignBox(node(20, 300), [node(0, 0)], 8);

    expect(alignment).toEqual({ x: 20, y: 300, guides: [] });
  });

  it("snaps a box below another onto its center line", () => {
    const alignment = alignBox(node(6, 300), [node(0, 0)], 8);

    expect(alignment.x).toBe(0);
    expect(alignment.y).toBe(300);
    // The guide runs through both boxes
    expect(alignment.guides).toEqual([
      { orientation: "vertical", position: 125, start: 0, end: 380 },
    ]);
  });

  it("snaps a box beside another onto its middle line", () => {
    // The middles are 3 apart, the tops 13 and the bottoms 7
    const alignment = alignBox(node(400, -13, 100), [node(0, 0, 80)], 8);

    expect(alignment.y).toBe(-10);
    expect(alignment.guides).toEqual([
      { orientation: "horizontal", position: 40, start: 0, end: 650 },
    ]);
  });

  it("lines edges up with edges", () => {
    // The tops are 5 apart, the middles 20
    const alignment = alignBox(node(400, 5, 110), [node(0, 0, 80)], 8);

    expect(alignment.y).toBe(0);
    expect(alignment.guides[0]).toMatchObject({
      orientation: "horizontal",
      position: 0,
    });
  });

  it("snaps to the closest line", () => {
    const alignment = alignBox(
      node(400, 6, 80),
      [node(0, 0, 80), node(0, 300, 80), node(800, 4, 80)],
      8
    );

    expect(alignment.y).toBe(4);
    expect(alignment.guides[0]).toMatchObject({ position: 44 });
  });

  it("snaps on both axes", () => {
    const alignment = alignBox(node(3, 297), [node(0, 0), node(400, 300)], 8);

    expect(alignment).toMatchObject({ x: 0, y: 300 });
    expect(alignment.guides.map((guide) => guide.orientation)).toEqual([
      "vertical",
      "horizontal",
    ]);
  });

  it("spans the guide over every box on the line", () => {
    const alignment = alignBox(
      node(2, 500),
      [node(0, 0), node(0, 200), node(400, 900)],
      8
    );

    expect(alignment.guides).toEqual([
      { orientation: "vertical", position: 125, start: 0, end: 580 },
    ]);
  });
});

describe("boxesOverlap", () => {
  it("tells whether boxes overlap", () => {
    expect(boxesOverlap(node(0, 0), node(200, 50))).toBe(true);
    expect(boxesOverlap(node(0, 0), node(250, 0))).toBe(false);
    expect(boxesOverlap(node(0, 0), node(0, 90))).toBe(false);
  });
});
