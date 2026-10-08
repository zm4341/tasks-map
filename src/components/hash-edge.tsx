import { EdgeProps, getBezierPath, Position } from "reactflow";

const ARROW_LENGTH = 9;
const ARROW_HALF_WIDTH = 4.5;

// Edges are given the outer edge of a handle, which sticks out this far over
// the border of the node (see .tasks-map-handle in global.css)
const HANDLE_OVERHANG = 5;

// The direction into a node through that side of it
const INWARD_DIRECTIONS: Record<Position, [number, number]> = {
  [Position.Left]: [1, 0],
  [Position.Right]: [-1, 0],
  [Position.Top]: [0, 1],
  [Position.Bottom]: [0, -1],
};

export default function HashEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  // Start at the border of the source node
  const [sourceDirX, sourceDirY] = INWARD_DIRECTIONS[sourcePosition];
  const startX = sourceX + sourceDirX * HANDLE_OVERHANG;
  const startY = sourceY + sourceDirY * HANDLE_OVERHANG;

  // The arrowhead ends at the border of the target node, the line ends
  // where the arrowhead starts
  const [dirX, dirY] = INWARD_DIRECTIONS[targetPosition];
  const tipX = targetX + dirX * HANDLE_OVERHANG;
  const tipY = targetY + dirY * HANDLE_OVERHANG;
  const arrowBaseX = tipX - dirX * ARROW_LENGTH;
  const arrowBaseY = tipY - dirY * ARROW_LENGTH;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: startX,
    sourceY: startY,
    sourcePosition,
    targetX: arrowBaseX,
    targetY: arrowBaseY,
    targetPosition,
  });

  const arrowPath = [
    `M${tipX},${tipY}`,
    `L${arrowBaseX - dirY * ARROW_HALF_WIDTH},${arrowBaseY + dirX * ARROW_HALF_WIDTH}`,
    `L${arrowBaseX + dirY * ARROW_HALF_WIDTH},${arrowBaseY - dirX * ARROW_HALF_WIDTH}`,
    "Z",
  ].join(" ");

  return (
    <g>
      {/* Invisible thick path for easier selection */}
      <path
        className="react-flow__edge-interaction tasks-map-hash-edge-interaction"
        d={edgePath}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
      />
      <path id={id} className="react-flow__edge-path" d={edgePath} />
      <path className="tasks-map-edge-arrow" d={arrowPath} />
      {data?.debugVisualization && (
        <text
          x={labelX}
          y={labelY - 8}
          textAnchor="middle"
          fontSize={12}
          fill="#888"
          className="tasks-map-hash-edge-text"
        >
          {data?.hash}
        </text>
      )}
    </g>
  );
}
