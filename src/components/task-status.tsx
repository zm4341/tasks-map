import React from "react";
import { Menu } from "obsidian";
import { Task, TaskStatus } from "src/types/task";
import { updateTaskStatusInVault } from "src/lib/utils";
import { ALL_TASK_STATUSES, getStatusLabel } from "src/lib/task-status";
import { useApp } from "src/hooks/hooks";
import { getStatusIconId, TaskStatusIcon } from "./task-status-icon";

interface TaskStatusProps {
  status: TaskStatus;
  task: Task;
  onStatusChange: (newStatus: TaskStatus) => void; // eslint-disable-line no-unused-vars
}

export function TaskStatusToggle({
  status,
  task,
  onStatusChange,
}: TaskStatusProps) {
  const app = useApp();

  const changeStatus = async (newStatus: TaskStatus) => {
    if (newStatus === status) return;
    await updateTaskStatusInVault(task, newStatus, app);
    onStatusChange(newStatus);
  };

  // Like the status column of TaskGenius' table view, pick from a menu
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const menu = new Menu();
    ALL_TASK_STATUSES.forEach((option) => {
      // Archived is not in the status cycle, TaskGenius lists it apart too
      if (option === "archived") menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle(getStatusLabel(option))
          .setIcon(getStatusIconId(option))
          .onClick(() => changeStatus(option));
        if (option === status) item.setChecked(true);
      });
    });
    menu.showAtMouseEvent(e.nativeEvent);
  };

  return (
    <button
      className="tasks-map-status-button nodrag"
      onClick={handleClick}
      aria-label={getStatusLabel(status)}
    >
      <TaskStatusIcon status={status} />
    </button>
  );
}
