import { addIcon } from "obsidian";
import { NODE_COLORS, NodeColor } from "src/lib/node-colors";

/** The icon of a color in menus, or of no color */
export function getNodeColorIconId(color?: NodeColor): string {
  return `tasks-map-node-color-${color ?? "none"}`;
}

/** Registers a dot in each node color with Obsidian, for the node menu */
export function registerNodeColorIcons() {
  // Obsidian icons are drawn on a 100×100 grid
  addIcon(
    getNodeColorIconId(),
    '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="8"/>'
  );
  for (const { id } of NODE_COLORS) {
    addIcon(
      getNodeColorIconId(id),
      `<circle cx="50" cy="50" r="34" style="fill: var(--color-${id}); stroke: none"/>`
    );
  }
}
