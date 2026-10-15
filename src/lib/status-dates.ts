/**
 * Which dates a task line gets or loses when its status changes, the same
 * rules TaskGenius uses in its editor and its views (it keeps them in
 * utils/status-date-rules), read from its "autoDateManager" setting. They go
 * by the category of the new status, not by the mark:
 * - in progress: gets a start date; the completed and cancelled dates go
 * - completed: gets a completed date; the start and cancelled dates go
 * - abandoned: gets a cancelled date; the start and completed dates go
 * - planned, not started: all three dates go, unless the task already was one
 *   of the two: a start date written on such a task is a plan, so a change
 *   between planned and not started leaves it
 * - archived, or a mark in no category: the dates stay
 * A date that is already there is not added again, and nothing happens when
 * the old and the new status are in the same category. Each date is only
 * touched when its manage* setting is on. The "enabled" setting is not read:
 * TaskGenius uses it for its editor only, its views never looked at it.
 */

import { TASK_CHECKBOX_PATTERN } from "./task-regex";

export type DateKind = "start" | "completed" | "cancelled";

export type StatusCategory =
  | "completed"
  | "inProgress"
  | "abandoned"
  | "planned"
  | "notStarted"
  | "archived"
  | "unknown";

/** The "taskStatuses" setting: the marks of each category, joined with "|" */
export type StatusMarks = Partial<Record<string, string>>;

/** The "autoDateManager" setting of TaskGenius */
export interface StatusDateSettings {
  manageStartDate?: boolean;
  manageCompletedDate?: boolean;
  manageCancelledDate?: boolean;
  startDateMarker?: string;
  completedDateMarker?: string;
  cancelledDateMarker?: string;
  startDateFormat?: string;
  completedDateFormat?: string;
  cancelledDateFormat?: string;
}

/** The parts of the TaskGenius settings the dates depend on */
export interface StatusDateSource {
  taskStatuses?: StatusMarks;
  autoDateManager?: StatusDateSettings;
  preferMetadataFormat?: string;
}

export interface StatusDateChanges {
  /** The dates to give the line, none of them on it yet */
  add: DateKind[];
  /** The dates to take off the line, all of them on it */
  remove: DateKind[];
}

export interface StatusDateInput {
  oldMark: string;
  newMark: string;
  taskStatuses?: StatusMarks;
  autoDateManager?: StatusDateSettings;
  /** The whole task line, to see which dates it has */
  lineText: string;
}

// The marks TaskGenius starts with, for a category missing from the settings
const DEFAULT_MARKS: Partial<Record<StatusCategory, string>> = {
  completed: "x|X",
  inProgress: ">|/",
  abandoned: "-",
  planned: "?",
  notStarted: " ",
};

// A mark in several categories counts for the first of them
const CATEGORIES: Array<Exclude<StatusCategory, "unknown">> = [
  "archived",
  "completed",
  "inProgress",
  "abandoned",
  "planned",
  "notStarted",
];

// What the new category does to each date: "set" gives the line the date,
// "clear" takes it off. Archived and unknown marks are not here: no change.
const DATE_EFFECTS: Partial<
  Record<StatusCategory, Record<DateKind, "set" | "clear">>
> = {
  inProgress: { start: "set", completed: "clear", cancelled: "clear" },
  completed: { start: "clear", completed: "set", cancelled: "clear" },
  abandoned: { start: "clear", completed: "clear", cancelled: "set" },
  planned: { start: "clear", completed: "clear", cancelled: "clear" },
  notStarted: { start: "clear", completed: "clear", cancelled: "clear" },
};

// Neither of these has begun: a date on such a task was written by hand, not
// put there by its status
const NOT_BEGUN: StatusCategory[] = ["planned", "notStarted"];

const REMOVE_ORDER: DateKind[] = ["completed", "cancelled", "start"];
const ADD_ORDER: DateKind[] = ["completed", "start", "cancelled"];

// Markers a line can carry besides the configured ones; 🚀 started a task
// before 🛫 took its place
const KNOWN_MARKERS: Record<DateKind, string[]> = {
  start: ["🛫", "🚀"],
  completed: ["✅"],
  cancelled: ["❌"],
};

const DATAVIEW_KEYS: Record<DateKind, string> = {
  start: "start",
  completed: "completion",
  cancelled: "cancelled",
};

const MARKER_SETTINGS = {
  start: "startDateMarker",
  completed: "completedDateMarker",
  cancelled: "cancelledDateMarker",
} as const;

const FORMAT_SETTINGS = {
  start: "startDateFormat",
  completed: "completedDateFormat",
  cancelled: "cancelledDateFormat",
} as const;

const MANAGE_SETTINGS = {
  start: "manageStartDate",
  completed: "manageCompletedDate",
  cancelled: "manageCancelledDate",
} as const;

// 2026-10-15, with a time after it at times: 2026-10-15 12:30
const DATE_PATTERN =
  "\\d{4}-\\d{2}-\\d{2}(?:[ \\t]+\\d{1,2}:\\d{2}(?::\\d{2})?)?";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function marksOf(category: StatusCategory, taskStatuses?: StatusMarks) {
  const marks = taskStatuses?.[category] ?? DEFAULT_MARKS[category] ?? "";
  return marks.split("|").filter((mark) => mark !== "");
}

/** The category of a checkbox mark, "unknown" for a mark in none */
export function getStatusCategory(
  mark: string,
  taskStatuses?: StatusMarks
): StatusCategory {
  for (const category of CATEGORIES) {
    if (marksOf(category, taskStatuses).includes(mark)) return category;
  }
  return "unknown";
}

/** The marker the settings give a date, then the ones a line may carry */
function markersOf(kind: DateKind, settings?: StatusDateSettings): string[] {
  const configured = settings?.[MARKER_SETTINGS[kind]];
  const markers = configured ? [configured] : [];
  for (const marker of KNOWN_MARKERS[kind]) {
    if (!markers.includes(marker)) markers.push(marker);
  }
  return markers;
}

/** Finds a date as `✅ 2026-10-15` or `[completion:: 2026-10-15]`, with the whitespace before it */
function datePattern(kind: DateKind, settings?: StatusDateSettings): RegExp {
  const markers = markersOf(kind, settings).map(escapeRegExp).join("|");
  const key = DATAVIEW_KEYS[kind];
  return new RegExp(
    `\\s*(?:(?:${markers})\\s*${DATE_PATTERN}` +
      `|\\[(?:${key}|${markers})::\\s*${DATE_PATTERN}\\s*\\])`,
    "gi"
  );
}

/** Where the date is on the line, whatever its format; the whitespace before it counts */
export function findDateRanges(
  lineText: string,
  kind: DateKind,
  settings?: StatusDateSettings
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of lineText.matchAll(datePattern(kind, settings))) {
    const start = match.index ?? 0;
    ranges.push({ start, end: start + match[0].length });
  }
  return ranges;
}

export function hasDate(
  lineText: string,
  kind: DateKind,
  settings?: StatusDateSettings
): boolean {
  return findDateRanges(lineText, kind, settings).length > 0;
}

/** Takes every date of the kind off the line, with the whitespace before it */
export function removeDate(
  lineText: string,
  kind: DateKind,
  settings?: StatusDateSettings
): string {
  return lineText.replace(datePattern(kind, settings), "");
}

/** The text of a date to put on a line: `✅ 2026-10-15`, or `[completion:: 2026-10-15]` for Dataview */
export function formatDateMetadata(
  kind: DateKind,
  date: string,
  settings: StatusDateSettings | undefined,
  useDataviewFormat: boolean
): string {
  if (useDataviewFormat) return `[${DATAVIEW_KEYS[kind]}:: ${date}]`;
  return `${markersOf(kind, settings)[0]} ${date}`;
}

/** The dates a status change adds to and takes off the line */
export function getStatusDateChanges(
  input: StatusDateInput
): StatusDateChanges {
  const changes: StatusDateChanges = { add: [], remove: [] };
  const settings = input.autoDateManager;
  if (!settings) return changes;

  const oldCategory = getStatusCategory(input.oldMark, input.taskStatuses);
  const newCategory = getStatusCategory(input.newMark, input.taskStatuses);
  if (oldCategory === newCategory) return changes;
  // Between planned and not started nothing was started, done or cancelled:
  // the dates on the line are the user's own plan, so they stay
  if (NOT_BEGUN.includes(oldCategory) && NOT_BEGUN.includes(newCategory)) {
    return changes;
  }

  const effects = DATE_EFFECTS[newCategory];
  if (!effects) return changes;

  for (const kind of REMOVE_ORDER) {
    if (
      effects[kind] === "clear" &&
      settings[MANAGE_SETTINGS[kind]] &&
      hasDate(input.lineText, kind, settings)
    ) {
      changes.remove.push(kind);
    }
  }
  for (const kind of ADD_ORDER) {
    if (
      effects[kind] === "set" &&
      settings[MANAGE_SETTINGS[kind]] &&
      !hasDate(input.lineText, kind, settings)
    ) {
      changes.add.push(kind);
    }
  }
  return changes;
}

/** A date in the format of TaskGenius, e.g. YYYY-MM-DD or YYYY-MM-DD HH:mm */
export function formatDate(date: Date, format: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const parts: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => parts[token]);
}

// Puts a date at the end of the line, before a block reference
function appendDate(line: string, date: string): string {
  const blockReference = line.match(/\s+\^[A-Za-z0-9_-]+\s*$/);
  if (blockReference?.index !== undefined) {
    const before = line.slice(0, blockReference.index).trimEnd();
    return `${before} ${date} ${blockReference[0].trimStart()}`;
  }
  return `${line.trimEnd()} ${date}`;
}

/**
 * Sets the checkbox mark of a task line, and moves its dates with the new
 * status as TaskGenius does. Without TaskGenius settings only the mark changes.
 */
export function setLineStatus(
  line: string,
  newMark: string,
  source?: StatusDateSource,
  now: Date = new Date()
): string {
  const checkbox = line.match(TASK_CHECKBOX_PATTERN);
  if (!checkbox) return line;

  let result = line.replace(
    TASK_CHECKBOX_PATTERN,
    (_match, listMarker: string) => `${listMarker}[${newMark}]`
  );

  const settings = source?.autoDateManager;
  const changes = getStatusDateChanges({
    oldMark: checkbox[2],
    newMark,
    taskStatuses: source?.taskStatuses,
    autoDateManager: settings,
    lineText: result,
  });
  const useDataviewFormat = source?.preferMetadataFormat === "dataview";

  for (const kind of changes.remove) {
    result = removeDate(result, kind, settings);
  }
  for (const kind of changes.add) {
    const date = formatDate(
      now,
      settings?.[FORMAT_SETTINGS[kind]] || "YYYY-MM-DD"
    );
    result = appendDate(
      result,
      formatDateMetadata(kind, date, settings, useDataviewFormat)
    );
  }
  return result;
}
