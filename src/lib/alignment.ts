export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentGuide {
  // A vertical guide is at an x position and spans from start to end on the
  // y axis, a horizontal guide the other way round
  orientation: "vertical" | "horizontal";
  position: number;
  start: number;
  end: number;
}

export interface Alignment {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

type Axis = "x" | "y";

// How close a box has to be to a line to count as on it
const ON_LINE = 0.5;

// The lines a box aligns on along an axis. The center comes first, so boxes
// of the same size show the guide through their centers.
function alignmentLines(box: Box, axis: Axis): number[] {
  const start = axis === "x" ? box.x : box.y;
  const size = axis === "x" ? box.width : box.height;
  return [start + size / 2, start, start + size];
}

// The closest line of another box within the distance of a line of the box
function findSnap(box: Box, others: Box[], axis: Axis, distance: number) {
  let snap: { offset: number; line: number } | undefined;
  for (const line of alignmentLines(box, axis)) {
    for (const other of others) {
      for (const otherLine of alignmentLines(other, axis)) {
        const offset = otherLine - line;
        if (
          Math.abs(offset) <= distance &&
          (!snap || Math.abs(offset) < Math.abs(snap.offset))
        ) {
          snap = { offset, line: otherLine };
        }
      }
    }
  }
  return snap;
}

// A guide along the line, spanning the box and the other boxes on it
function createGuide(
  box: Box,
  others: Box[],
  axis: Axis,
  line: number
): AlignmentGuide {
  const onLine = others.filter((other) =>
    alignmentLines(other, axis).some((l) => Math.abs(l - line) < ON_LINE)
  );
  const boxes = [box, ...onLine];
  const starts = boxes.map((b) => (axis === "x" ? b.y : b.x));
  const ends = boxes.map((b) =>
    axis === "x" ? b.y + b.height : b.x + b.width
  );
  return {
    orientation: axis === "x" ? "vertical" : "horizontal",
    position: line,
    start: Math.min(...starts),
    end: Math.max(...ends),
  };
}

/**
 * Moves a box by up to `distance` on each axis, so that its center or an edge
 * lines up with the center or an edge of another box. Returns the position
 * of the box and guides showing what it lines up with.
 */
export function alignBox(box: Box, others: Box[], distance: number): Alignment {
  const snapX = findSnap(box, others, "x", distance);
  const snapY = findSnap(box, others, "y", distance);
  const aligned = {
    ...box,
    x: box.x + (snapX?.offset ?? 0),
    y: box.y + (snapY?.offset ?? 0),
  };

  const guides: AlignmentGuide[] = [];
  if (snapX) guides.push(createGuide(aligned, others, "x", snapX.line));
  if (snapY) guides.push(createGuide(aligned, others, "y", snapY.line));
  return { x: aligned.x, y: aligned.y, guides };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}
