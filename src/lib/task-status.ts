import { App } from "obsidian";
import { TaskStatus } from "src/types/task";
import { localize, LocalizedText } from "./i18n";

/**
 * Task statuses follow the TaskGenius plugin: which status a checkbox mark
 * like `[?]` stands for is read from its "taskStatuses" setting, so tasks
 * show the same status here as in TaskGenius.
 */

const TASK_GENIUS_PLUGIN_ID = "obsidian-task-progress-bar";

type StatusCategory =
  | "archived"
  | "completed"
  | "inProgress"
  | "abandoned"
  | "planned"
  | "notStarted";

interface TaskGeniusSettings {
  taskStatuses?: Partial<Record<StatusCategory, string>>;
  countOtherStatusesAs?: string;
  statusCycles?: Array<{
    enabled?: boolean;
    cycle?: string[];
    marks?: Record<string, string>;
  }>;
}

// A mark listed under several categories gets the first one
const CATEGORY_STATUS: Array<[StatusCategory, TaskStatus]> = [
  ["archived", "archived"],
  ["completed", "done"],
  ["inProgress", "in_progress"],
  ["abandoned", "canceled"],
  ["planned", "planned"],
  ["notStarted", "todo"],
];

// The TaskGenius defaults, for when TaskGenius is not installed
const DEFAULT_TASK_STATUSES: Record<StatusCategory, string> = {
  completed: "x|X",
  inProgress: ">|/",
  abandoned: "-",
  planned: "?",
  notStarted: " ",
  archived: "a",
};

const DEFAULT_STATUS_MARKS: Record<TaskStatus, string> = {
  todo: " ",
  in_progress: "/",
  done: "x",
  canceled: "-",
  planned: "?",
  archived: "a",
};

// In the order of TaskGenius' default status cycle, archived last
export const ALL_TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "canceled",
  "planned",
  "archived",
];

// The names TaskGenius gives these statuses
const STATUS_LABELS: Record<TaskStatus, LocalizedText> = {
  todo: { en: "Not Started", zh: "未开始" },
  in_progress: { en: "In Progress", zh: "进行中" },
  done: { en: "Completed", zh: "已完成" },
  canceled: { en: "Abandoned", zh: "已放弃" },
  planned: { en: "Planned", zh: "计划" },
  archived: { en: "Archived", zh: "已归档" },
};

export function getStatusLabel(status: TaskStatus): string {
  return localize(STATUS_LABELS[status]);
}

export interface TaskStatusConfig {
  /** The status a checkbox mark stands for, e.g. "?" is planned */
  getStatus: (mark: string) => TaskStatus; // eslint-disable-line no-unused-vars
  /** The mark to write when a task is set to the status */
  getMark: (status: TaskStatus) => string; // eslint-disable-line no-unused-vars
}

function splitMarks(marks: string | undefined): string[] {
  return (marks ?? "").split("|").filter((mark) => mark !== "");
}

export function createTaskStatusConfig(
  settings?: TaskGeniusSettings
): TaskStatusConfig {
  const taskStatuses = settings?.taskStatuses ?? DEFAULT_TASK_STATUSES;

  const markStatus = new Map<string, TaskStatus>();
  for (const [category, status] of CATEGORY_STATUS) {
    for (const mark of splitMarks(taskStatuses[category])) {
      if (!markStatus.has(mark)) markStatus.set(mark, status);
    }
  }
  // Marks that are not listed count as "countOtherStatusesAs"
  const otherStatus =
    CATEGORY_STATUS.find(
      ([category]) => category === settings?.countOtherStatusesAs
    )?.[1] ?? "todo";
  const getStatus = (mark: string) => markStatus.get(mark) ?? otherStatus;

  // Prefer the marks of the status cycles, as those are what TaskGenius
  // writes when switching statuses, then the first mark of each category
  const statusMarks: Partial<Record<TaskStatus, string>> = {};
  for (const cycle of settings?.statusCycles ?? []) {
    if (cycle.enabled === false || !cycle.marks) continue;
    for (const name of cycle.cycle ?? Object.keys(cycle.marks)) {
      const mark = cycle.marks[name];
      if (mark === undefined) continue;
      const status = getStatus(mark);
      if (statusMarks[status] === undefined) statusMarks[status] = mark;
    }
  }
  for (const [category, status] of CATEGORY_STATUS) {
    const firstMark = splitMarks(taskStatuses[category])[0];
    if (statusMarks[status] === undefined && firstMark !== undefined) {
      statusMarks[status] = firstMark;
    }
  }
  const getMark = (status: TaskStatus) =>
    statusMarks[status] ?? DEFAULT_STATUS_MARKS[status];

  return { getStatus, getMark };
}

/** Reads the current TaskGenius settings, falling back to its defaults */
export function getTaskStatusConfig(app: App): TaskStatusConfig {
  const plugins = (
    app as unknown as {
      plugins?: { plugins?: Record<string, { settings?: TaskGeniusSettings }> };
    }
  ).plugins;
  return createTaskStatusConfig(
    plugins?.plugins?.[TASK_GENIUS_PLUGIN_ID]?.settings
  );
}
