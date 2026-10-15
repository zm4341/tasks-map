/**
 * Changes of status with the line they must leave. The same table is in the
 * tests of TaskGenius (src/__tests__/status-date-scenarios.ts), where its
 * editor and its views run it: all of them must agree with TaskMap on it.
 * Settings as in the user's vault (emoji format, all dates managed), today is
 * TODAY.
 */

export const TODAY = "2026-10-15";

// Noon of TODAY, local time
export const NOW = new Date(2026, 9, 15, 12, 0, 0);

export const userTaskStatuses = {
  completed: "x|X",
  inProgress: "/|d",
  abandoned: "-",
  planned: ">|?",
  notStarted: " |D|+|R|!|i|B|P|C|Q|N|b|I|p|L|E|A|r|c|T|@|t|O|~|W|f|F|H|&|s",
  archived: "a",
};

export const userAutoDateManager = {
  enabled: true,
  manageCompletedDate: true,
  manageStartDate: true,
  manageCancelledDate: true,
  completedDateFormat: "YYYY-MM-DD",
  startDateFormat: "YYYY-MM-DD",
  cancelledDateFormat: "YYYY-MM-DD",
  completedDateMarker: "✅",
  startDateMarker: "🛫",
  cancelledDateMarker: "❌",
};

export interface StatusDateScenario {
  name: string;
  before: string;
  /** The mark the task gets */
  mark: string;
  after: string;
}

export const SCENARIOS: StatusDateScenario[] = [
  {
    name: "starting a task gives it a start date",
    before: "- [ ] 任务",
    mark: "/",
    after: `- [/] 任务 🛫 ${TODAY}`,
  },
  {
    name: "any mark of in progress gives a start date",
    before: "- [ ] 任务",
    mark: "d",
    after: `- [d] 任务 🛫 ${TODAY}`,
  },
  {
    name: "a mark of planned is not in progress",
    before: "- [ ] 任务",
    mark: ">",
    after: "- [>] 任务",
  },
  {
    name: "planned to in progress gives a start date",
    before: "- [?] 任务",
    mark: "/",
    after: `- [/] 任务 🛫 ${TODAY}`,
  },
  {
    name: "completing swaps the start date for a completed date",
    before: "- [/] 任务 🛫 2026-10-01",
    mark: "x",
    after: `- [x] 任务 ✅ ${TODAY}`,
  },
  {
    name: "completing a task that was not started",
    before: "- [ ] 任务",
    mark: "x",
    after: `- [x] 任务 ✅ ${TODAY}`,
  },
  {
    name: "reopening a completed task drops the completed date",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: "/",
    after: `- [/] 任务 🛫 ${TODAY}`,
  },
  {
    name: "a completed date with a time goes too",
    before: "- [x] 任务 ✅ 2026-10-01 12:30",
    mark: "/",
    after: `- [/] 任务 🛫 ${TODAY}`,
  },
  {
    name: "completed to not started drops the completed date",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: " ",
    after: "- [ ] 任务",
  },
  {
    name: "in progress to not started drops the start date",
    before: "- [/] 任务 🛫 2026-10-01",
    mark: " ",
    after: "- [ ] 任务",
  },
  {
    name: "in progress to planned drops the start date",
    before: "- [/] 任务 🛫 2026-10-01",
    mark: ">",
    after: "- [>] 任务",
  },
  {
    name: "abandoning swaps the start date for a cancelled date",
    before: "- [/] 任务 🛫 2026-10-01",
    mark: "-",
    after: `- [-] 任务 ❌ ${TODAY}`,
  },
  {
    name: "completed to abandoned",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: "-",
    after: `- [-] 任务 ❌ ${TODAY}`,
  },
  {
    name: "abandoned to in progress drops the cancelled date",
    before: "- [-] 任务 ❌ 2026-10-01",
    mark: "/",
    after: `- [/] 任务 🛫 ${TODAY}`,
  },
  {
    name: "abandoned to completed",
    before: "- [-] 任务 ❌ 2026-10-01",
    mark: "x",
    after: `- [x] 任务 ✅ ${TODAY}`,
  },
  {
    name: "abandoned to not started drops the cancelled date",
    before: "- [-] 任务 ❌ 2026-10-01",
    mark: " ",
    after: "- [ ] 任务",
  },
  {
    name: "archiving leaves the dates",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: "a",
    after: "- [a] 任务 ✅ 2026-10-01",
  },
  {
    name: "restoring an archived task keeps the date it has",
    before: "- [a] 任务 ✅ 2026-10-01",
    mark: "x",
    after: "- [x] 任务 ✅ 2026-10-01",
  },
  {
    name: "a mark in no category leaves the dates",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: "Z",
    after: "- [Z] 任务 ✅ 2026-10-01",
  },
  {
    name: "completed to another completed mark leaves the dates",
    before: "- [x] 任务 ✅ 2026-10-01",
    mark: "X",
    after: "- [X] 任务 ✅ 2026-10-01",
  },
  {
    name: "in progress to another in progress mark leaves the dates",
    before: "- [/] 任务 🛫 2026-10-01",
    mark: "d",
    after: "- [d] 任务 🛫 2026-10-01",
  },
  {
    name: "a start date that is there stays",
    before: "- [ ] 任务 🛫 2026-10-01",
    mark: "/",
    after: "- [/] 任务 🛫 2026-10-01",
  },
  {
    name: "a completed date that is there stays",
    before: "- [ ] 任务 ✅ 2026-10-01",
    mark: "x",
    after: "- [x] 任务 ✅ 2026-10-01",
  },
  {
    name: "a line with a stale completed date is put right",
    before: "- [/] 任务 🛫 2026-10-01 ✅ 2026-10-02",
    mark: " ",
    after: "- [ ] 任务",
  },
  {
    name: "a line with every date keeps the date of the new status",
    before: "- [x] 任务 🛫 2026-10-01 ✅ 2026-10-02 ❌ 2026-10-03",
    mark: "/",
    after: "- [/] 任务 🛫 2026-10-01",
  },
  {
    name: "a block reference stays last when a date is added",
    before: "- [ ] 任务 ^abc",
    mark: "x",
    after: `- [x] 任务 ✅ ${TODAY} ^abc`,
  },
  {
    name: "a block reference stays when a date is taken off",
    before: "- [x] 任务 ✅ 2026-10-01 ^abc",
    mark: " ",
    after: "- [ ] 任务 ^abc",
  },
  {
    name: "the other metadata and the indent stay",
    before: "    - [ ] 子任务 #标签 📅 2026-10-20 ⏫",
    mark: "/",
    after: `    - [/] 子任务 #标签 📅 2026-10-20 ⏫ 🛫 ${TODAY}`,
  },
  {
    name: "a date in the middle of the line is taken off without a double space",
    before: "- [x] 任务 ✅ 2026-10-01 #标签 📅 2026-10-20",
    mark: " ",
    after: "- [ ] 任务 #标签 📅 2026-10-20",
  },
  {
    name: "the new date goes last, also when the old one was in the middle",
    before: "- [x] 任务 ✅ 2026-10-01 #标签 ^abc",
    mark: "/",
    after: `- [/] 任务 #标签 🛫 ${TODAY} ^abc`,
  },
  {
    name: "not started to planned leaves a start date written on the task",
    before: "- [ ] 任务 🛫 2026-10-20",
    mark: "?",
    after: "- [?] 任务 🛫 2026-10-20",
  },
  {
    name: "planned to not started leaves a start date written on the task",
    before: "- [?] 任务 🛫 2026-10-20",
    mark: " ",
    after: "- [ ] 任务 🛫 2026-10-20",
  },
];
