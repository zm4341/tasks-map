import React from "react";
import { ReactFlowState, useStore } from "reactflow";
import { AlignmentGuide } from "src/lib/alignment";

const selectTransform = (state: ReactFlowState) => state.transform;

/** Draws the alignment guides of a dragged node, above the nodes */
export function AlignmentGuides({ guides }: { guides: AlignmentGuide[] }) {
  const [x, y, zoom] = useStore(selectTransform);
  if (guides.length === 0) return null;

  // Guides are in flow coordinates, lines in screen coordinates
  const toScreenX = (flowX: number) => flowX * zoom + x;
  const toScreenY = (flowY: number) => flowY * zoom + y;

  return (
    <svg className="tasks-map-alignment-guides">
      {guides.map(({ orientation, position, start, end }) =>
        orientation === "vertical" ? (
          <line
            key={orientation}
            x1={toScreenX(position)}
            x2={toScreenX(position)}
            y1={toScreenY(start)}
            y2={toScreenY(end)}
          />
        ) : (
          <line
            key={orientation}
            x1={toScreenX(start)}
            x2={toScreenX(end)}
            y1={toScreenY(position)}
            y2={toScreenY(position)}
          />
        )
      )}
    </svg>
  );
}
