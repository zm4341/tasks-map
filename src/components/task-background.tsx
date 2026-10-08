import React from "react";
import { TaskStatus } from "src/types/task";
import { NodeColor } from "src/lib/node-colors";

interface TaskBackgroundProps {
  status: TaskStatus;
  color?: NodeColor;
  starred?: boolean;
  expanded?: boolean;
  debugVisualization?: boolean;
  children: React.ReactNode;
}

const STATUS_CLASSES: Record<TaskStatus, string> = {
  todo: "tasks-map-task-background--todo",
  in_progress: "tasks-map-task-background--in-progress",
  done: "tasks-map-task-background--done",
  canceled: "tasks-map-task-background--canceled",
  planned: "tasks-map-task-background--planned",
  archived: "tasks-map-task-background--archived",
};

export function TaskBackground({
  status,
  color,
  starred = false,
  expanded,
  debugVisualization,
  children,
}: TaskBackgroundProps) {
  const className = [
    "tasks-map-task-background",
    STATUS_CLASSES[status],
    color && `has-color tasks-map-task-background--color-${color}`,
    starred && "tasks-map-task-background--starred",
    expanded && "tasks-map-task-background--expanded",
    debugVisualization && "tasks-map-task-background--debug",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={className}>{children}</div>;
}
