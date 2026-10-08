import React, { useLayoutEffect, useRef } from "react";
import { addIcon, setIcon } from "obsidian";
import { TaskStatus } from "src/types/task";
import { ALL_TASK_STATUSES } from "src/lib/task-status";

// The status icons of TaskGenius (on a 24×24 grid), plus one for archived in
// the same style, as TaskGenius has none for it
const GREY = "#A1A1A1";
const AMBER = "#BD8E37";
const PURPLE = "#8E68F5";

const SQUARE =
  "M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z";
const FILLED_SQUARE =
  "M19 2C20.6569 2 22 3.34315 22 5V19C22 20.6569 20.6569 22 19 22H5C3.34315 22 2 20.6569 2 19V5C2 3.34315 3.34315 2 5 2H19Z";

const outlinedSquare = (color: string, dashed = false) =>
  `<path d="${SQUARE}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="4 4"' : ""}/>`;

const filledPath = (d: string, color: string, evenOdd = false) =>
  `<path d="${d}" fill="${color}" stroke="none"${evenOdd ? ' fill-rule="evenodd"' : ""}/>`;

const STATUS_ICONS: Record<TaskStatus, string> = {
  todo: outlinedSquare(GREY, true),
  in_progress:
    outlinedSquare(AMBER) +
    filledPath(
      "M12 6H17C17.5523 6 18 6.44772 18 7V17C18 17.5523 17.5523 18 17 18H12V6Z",
      AMBER
    ),
  planned: outlinedSquare(GREY),
  done: filledPath(
    FILLED_SQUARE +
      "M15.707 9.29297C15.3409 8.92685 14.7619 8.90426 14.3691 9.22461L14.293 9.29297L11 12.5859L9.70703 11.293L9.63086 11.2246C9.23809 10.9043 8.65908 10.9269 8.29297 11.293C7.92685 11.6591 7.90426 12.2381 8.22461 12.6309L8.29297 12.707L10.293 14.707L10.3691 14.7754C10.7619 15.0957 11.3409 15.0731 11.707 14.707L15.707 10.707L15.7754 10.6309C16.0957 10.2381 16.0731 9.65908 15.707 9.29297Z",
    PURPLE
  ),
  canceled: filledPath(
    FILLED_SQUARE +
      "M15.707 8.29297C15.3165 7.90244 14.6835 7.90244 14.293 8.29297L12 10.5859L9.70703 8.29297L9.63086 8.22461C9.23809 7.90426 8.65908 7.92685 8.29297 8.29297C7.92685 8.65908 7.90426 9.23809 8.22461 9.63086L8.29297 9.70703L10.5859 12L8.29297 14.293C7.90244 14.6835 7.90244 15.3165 8.29297 15.707C8.68349 16.0976 9.31651 16.0976 9.70703 15.707L12 13.4141L14.293 15.707L14.3691 15.7754C14.7619 16.0957 15.3409 16.0731 15.707 15.707C16.0731 15.3409 16.0957 14.7619 15.7754 14.3691L15.707 14.293L13.4141 12L15.707 9.70703C16.0976 9.31651 16.0976 8.68349 15.707 8.29297Z",
    GREY
  ),
  // A box with a lid cut out of the square
  archived: filledPath(
    FILLED_SQUARE +
      "M6.5 5.5H17.5C18.0523 5.5 18.5 5.94772 18.5 6.5V7.5C18.5 8.05228 18.0523 8.5 17.5 8.5H6.5C5.94772 8.5 5.5 8.05228 5.5 7.5V6.5C5.5 5.94772 5.94772 5.5 6.5 5.5Z" +
      "M6.5 10H17.5V17C17.5 17.8284 16.8284 18.5 16 18.5H8C7.17157 18.5 6.5 17.8284 6.5 17V10Z" +
      "M10.25 12.25H13.75C14.1642 12.25 14.5 12.5858 14.5 13C14.5 13.4142 14.1642 13.75 13.75 13.75H10.25C9.83579 13.75 9.5 13.4142 9.5 13C9.5 12.5858 9.83579 12.25 10.25 12.25Z",
    GREY,
    true
  ),
};

export function getStatusIconId(status: TaskStatus): string {
  return `tasks-map-status-${status}`;
}

/** Registers the status icons with Obsidian, so menus can show them too */
export function registerTaskStatusIcons() {
  for (const status of ALL_TASK_STATUSES) {
    // Obsidian icons are drawn on a 100×100 grid
    addIcon(
      getStatusIconId(status),
      `<g transform="scale(${100 / 24})">${STATUS_ICONS[status]}</g>`
    );
  }
}

export function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const iconRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (iconRef.current) setIcon(iconRef.current, getStatusIconId(status));
  }, [status]);

  return <span ref={iconRef} className="tasks-map-status-icon" />;
}
