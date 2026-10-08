import { LocalizedText } from "./i18n";

// The colors of Obsidian canvas cards
export type NodeColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "purple";

export const NODE_COLORS: Array<{ id: NodeColor; label: LocalizedText }> = [
  { id: "red", label: { en: "Red", zh: "红色" } },
  { id: "orange", label: { en: "Orange", zh: "橙色" } },
  { id: "yellow", label: { en: "Yellow", zh: "黄色" } },
  { id: "green", label: { en: "Green", zh: "绿色" } },
  { id: "cyan", label: { en: "Cyan", zh: "青色" } },
  { id: "purple", label: { en: "Purple", zh: "紫色" } },
];

export function isNodeColor(value: unknown): value is NodeColor {
  return NODE_COLORS.some((color) => color.id === value);
}
