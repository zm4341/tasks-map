import React from "react";
import {
  ChevronDown,
  ChevronsDown,
  LucideIcon,
  Minus,
  Triangle,
  TriangleAlert,
} from "lucide-react";
import { localize, LocalizedText } from "src/lib/i18n";

interface TaskPriorityProps {
  priority: string;
}

// The priority emoji of the Tasks plugin, shown the way TaskGenius' table
// view shows priorities
const PRIORITIES: Record<
  string,
  { level: string; Icon: LucideIcon; label: LocalizedText }
> = {
  "\u{1F53A}": {
    level: "highest",
    Icon: Triangle,
    label: { en: "Highest", zh: "最高" },
  },
  "\u{23EB}": {
    level: "high",
    Icon: TriangleAlert,
    label: { en: "High", zh: "高" },
  },
  "\u{1F53C}": {
    level: "medium",
    Icon: Minus,
    label: { en: "Medium", zh: "中等" },
  },
  "\u{1F53D}": {
    level: "low",
    Icon: ChevronDown,
    label: { en: "Low", zh: "低" },
  },
  "\u{23EC}": {
    level: "lowest",
    Icon: ChevronsDown,
    label: { en: "Lowest", zh: "最低" },
  },
};

export function TaskPriority({ priority }: TaskPriorityProps) {
  const config = PRIORITIES[priority];
  if (!config) return null;
  const { level, Icon, label } = config;

  return (
    <span
      className={`tasks-map-task-priority tasks-map-task-priority--${level}`}
    >
      <Icon size={12} />
      {localize(label)}
    </span>
  );
}
