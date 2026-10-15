import {
  findDateRanges,
  formatDate,
  formatDateMetadata,
  getStatusCategory,
  getStatusDateChanges,
  hasDate,
  removeDate,
  setLineStatus,
  type DateKind,
  type StatusCategory,
  type StatusDateSettings,
} from "../src/lib/status-dates";
import {
  NOW,
  SCENARIOS,
  TODAY,
  userAutoDateManager,
  userTaskStatuses,
} from "./status-date-scenarios";

const taskStatuses = userTaskStatuses;

const allOn: StatusDateSettings = userAutoDateManager;

// One mark of each category
const MARK: Record<StatusCategory, string> = {
  completed: "x",
  inProgress: "/",
  abandoned: "-",
  planned: "?",
  notStarted: " ",
  archived: "a",
  unknown: "Z",
};

const CATEGORIES = Object.keys(MARK) as StatusCategory[];

// null stands for settings without autoDateManager
function changes(
  oldMark: string,
  newMark: string,
  lineText: string,
  settings: StatusDateSettings | null = allOn
) {
  return getStatusDateChanges({
    oldMark,
    newMark,
    taskStatuses,
    autoDateManager: settings ?? undefined,
    lineText,
  });
}

describe("getStatusCategory", () => {
  it("reads the category of each mark from the settings", () => {
    expect(getStatusCategory("x", taskStatuses)).toBe("completed");
    expect(getStatusCategory("X", taskStatuses)).toBe("completed");
    expect(getStatusCategory("/", taskStatuses)).toBe("inProgress");
    expect(getStatusCategory("d", taskStatuses)).toBe("inProgress");
    expect(getStatusCategory("-", taskStatuses)).toBe("abandoned");
    expect(getStatusCategory(">", taskStatuses)).toBe("planned");
    expect(getStatusCategory("?", taskStatuses)).toBe("planned");
    expect(getStatusCategory(" ", taskStatuses)).toBe("notStarted");
    expect(getStatusCategory("D", taskStatuses)).toBe("notStarted");
    expect(getStatusCategory("&", taskStatuses)).toBe("notStarted");
    expect(getStatusCategory("a", taskStatuses)).toBe("archived");
  });

  it("puts a mark in no category under unknown", () => {
    expect(getStatusCategory("Z", taskStatuses)).toBe("unknown");
    expect(getStatusCategory("", taskStatuses)).toBe("unknown");
    expect(getStatusCategory("xx", taskStatuses)).toBe("unknown");
  });

  it("gives a mark in several categories to the first of them", () => {
    const overlapping = { completed: "x", inProgress: "x|/", archived: "x" };
    expect(getStatusCategory("x", overlapping)).toBe("archived");
    const noArchive = { completed: "x", inProgress: "x|/" };
    expect(getStatusCategory("x", noArchive)).toBe("completed");
    expect(getStatusCategory("/", noArchive)).toBe("inProgress");
  });

  it("falls back to the TaskGenius marks for a category the settings lack", () => {
    const partial = { completed: "x" };
    expect(getStatusCategory(">", partial)).toBe("inProgress");
    expect(getStatusCategory("/", partial)).toBe("inProgress");
    expect(getStatusCategory("-", partial)).toBe("abandoned");
    expect(getStatusCategory("?", partial)).toBe("planned");
    expect(getStatusCategory(" ", partial)).toBe("notStarted");
    expect(getStatusCategory("x", undefined)).toBe("completed");
    // Archived has no default: older settings have none
    expect(getStatusCategory("a", partial)).toBe("unknown");
  });

  it("does not fall back for a category that is empty on purpose", () => {
    const noProgress = { ...taskStatuses, inProgress: "" };
    expect(getStatusCategory("/", noProgress)).toBe("unknown");
  });
});

// What a change from the row's status to the column's status does to a line
// that has the date of the row's status ("add" gives the line the date,
// "remove" takes it off)
type Outcome = { add: DateKind[]; remove: DateKind[] };
const none: Outcome = { add: [], remove: [] };
const to = (add: DateKind[], remove: DateKind[]): Outcome => ({ add, remove });

const RULES: Record<StatusCategory, Record<StatusCategory, Outcome>> = {
  completed: {
    completed: none,
    inProgress: to(["start"], ["completed"]),
    abandoned: to(["cancelled"], ["completed"]),
    planned: to([], ["completed"]),
    notStarted: to([], ["completed"]),
    archived: none,
    unknown: none,
  },
  inProgress: {
    completed: to(["completed"], ["start"]),
    inProgress: none,
    abandoned: to(["cancelled"], ["start"]),
    planned: to([], ["start"]),
    notStarted: to([], ["start"]),
    archived: none,
    unknown: none,
  },
  abandoned: {
    completed: to(["completed"], ["cancelled"]),
    inProgress: to(["start"], ["cancelled"]),
    abandoned: none,
    planned: to([], ["cancelled"]),
    notStarted: to([], ["cancelled"]),
    archived: none,
    unknown: none,
  },
  planned: {
    completed: to(["completed"], []),
    inProgress: to(["start"], []),
    abandoned: to(["cancelled"], []),
    planned: none,
    notStarted: none,
    archived: none,
    unknown: none,
  },
  notStarted: {
    completed: to(["completed"], []),
    inProgress: to(["start"], []),
    abandoned: to(["cancelled"], []),
    planned: none,
    notStarted: none,
    archived: none,
    unknown: none,
  },
  archived: {
    completed: to(["completed"], []),
    inProgress: to(["start"], []),
    abandoned: to(["cancelled"], []),
    planned: none,
    notStarted: none,
    archived: none,
    unknown: none,
  },
  unknown: {
    completed: to(["completed"], []),
    inProgress: to(["start"], []),
    abandoned: to(["cancelled"], []),
    planned: none,
    notStarted: none,
    archived: none,
    unknown: none,
  },
};

// The line of a task in the category: it has the date of its status
const LINE: Record<StatusCategory, string> = {
  completed: "- [x] 任务 ✅ 2026-10-01",
  inProgress: "- [/] 任务 🛫 2026-10-01",
  abandoned: "- [-] 任务 ❌ 2026-10-01",
  planned: "- [?] 任务",
  notStarted: "- [ ] 任务",
  archived: "- [a] 任务",
  unknown: "- [Z] 任务",
};

describe("getStatusDateChanges: every change of status", () => {
  const pairs = CATEGORIES.flatMap((from) =>
    CATEGORIES.map((target) => [from, target] as const)
  );

  it.each(pairs)("%s to %s", (from, target) => {
    const result = changes(MARK[from], MARK[target], LINE[from]);
    expect(result).toEqual(RULES[from][target]);
  });
});

// The dates a status takes off a line that has all three
const FULL_LINE = "- [ ] 任务 🛫 2026-10-01 ✅ 2026-10-02 ❌ 2026-10-03";
const TAKEN_OFF: Record<StatusCategory, DateKind[]> = {
  inProgress: ["completed", "cancelled"],
  completed: ["cancelled", "start"],
  abandoned: ["completed", "start"],
  planned: ["completed", "cancelled", "start"],
  notStarted: ["completed", "cancelled", "start"],
  archived: [],
  unknown: [],
};

describe("getStatusDateChanges: planned and not started", () => {
  // A start date written on a task that has not begun is the user's own plan
  it("leaves the dates when the task changes from one to the other", () => {
    expect(changes(" ", "?", "- [ ] 任务 🛫 2026-10-20")).toEqual(none);
    expect(changes("?", " ", "- [?] 任务 🛫 2026-10-20")).toEqual(none);
    expect(changes(">", "D", FULL_LINE)).toEqual(none);
    expect(changes("D", ">", FULL_LINE)).toEqual(none);
  });

  it("still clears the dates when the task comes back from another status", () => {
    expect(changes("/", "?", "- [/] 任务 🛫 2026-10-01")).toEqual(
      to([], ["start"])
    );
    expect(changes("x", " ", "- [x] 任务 ✅ 2026-10-01")).toEqual(
      to([], ["completed"])
    );
    expect(changes("-", ">", "- [-] 任务 ❌ 2026-10-01")).toEqual(
      to([], ["cancelled"])
    );
  });
});

describe("getStatusDateChanges: a line that has all three dates", () => {
  // "Z" is in no category, so each of these changes the category
  it.each(CATEGORIES.filter((category) => category !== "unknown"))(
    "a change to %s leaves only the date of that status",
    (target) => {
      const result = changes("Z", MARK[target], FULL_LINE);
      expect(result).toEqual({ add: [], remove: TAKEN_OFF[target] });
    }
  );

  it.each([
    ["completed", "x", "X"],
    ["inProgress", "/", "d"],
    ["abandoned", "-", "-"],
    ["planned", ">", "?"],
    ["notStarted", " ", "D"],
    ["archived", "a", "a"],
    ["unknown", "Z", "Y"],
  ])("a change inside %s touches nothing", (_category, oldMark, newMark) => {
    expect(changes(oldMark, newMark, FULL_LINE)).toEqual(none);
    expect(changes(oldMark, newMark, "- [ ] 任务")).toEqual(none);
  });
});

describe("getStatusDateChanges: the manage switches", () => {
  // All eight combinations of the three switches
  const combinations = Array.from({ length: 8 }, (_, bits) => ({
    start: Boolean(bits & 1),
    completed: Boolean(bits & 2),
    cancelled: Boolean(bits & 4),
  }));
  const settingsOf = (on: Record<DateKind, boolean>): StatusDateSettings => ({
    ...allOn,
    manageStartDate: on.start,
    manageCompletedDate: on.completed,
    manageCancelledDate: on.cancelled,
  });

  it.each(combinations)(
    "with the switches %j, every change touches only the dates switched on",
    (on) => {
      const keep = (list: DateKind[]) => list.filter((kind) => on[kind]);
      for (const from of CATEGORIES) {
        for (const target of CATEGORIES) {
          const result = changes(
            MARK[from],
            MARK[target],
            LINE[from],
            settingsOf(on)
          );
          expect(result).toEqual({
            add: keep(RULES[from][target].add),
            remove: keep(RULES[from][target].remove),
          });
        }
      }
    }
  );

  it.each(combinations)(
    "with the switches %j, a line with all three dates keeps those switched off",
    (on) => {
      const keep = (list: DateKind[]) => list.filter((kind) => on[kind]);
      for (const target of CATEGORIES) {
        const result = changes("Z", MARK[target], FULL_LINE, settingsOf(on));
        expect(result.remove).toEqual(keep(TAKEN_OFF[target]));
      }
    }
  );

  it("does nothing without autoDateManager in the settings", () => {
    expect(changes(" ", "x", "- [ ] 任务", null)).toEqual(none);
    expect(changes("x", " ", "- [x] 任务 ✅ 2026-10-01", null)).toEqual(none);
  });

  it("manages nothing for switches that are missing", () => {
    expect(changes(" ", "x", "- [ ] 任务", { startDateMarker: "🛫" })).toEqual(
      none
    );
  });
});

describe("getStatusDateChanges: dates already on the line", () => {
  it("does not add a date that is there, in any form", () => {
    expect(changes(" ", "/", "- [ ] 任务 🛫 2026-10-01").add).toEqual([]);
    expect(changes(" ", "/", "- [ ] 任务 🚀 2026-10-01").add).toEqual([]);
    expect(changes(" ", "/", "- [ ] 任务 [start:: 2026-10-01]").add).toEqual(
      []
    );
    expect(changes(" ", "x", "- [ ] 任务 ✅ 2026-10-01 12:30").add).toEqual([]);
    expect(
      changes(" ", "x", "- [ ] 任务 [completion:: 2026-10-01]").add
    ).toEqual([]);
    expect(changes(" ", "-", "- [ ] 任务 ❌ 2026-10-01").add).toEqual([]);
    expect(
      changes(" ", "-", "- [ ] 任务 [cancelled:: 2026-10-01]").add
    ).toEqual([]);
  });

  it("adds a date when the line has only the marker, without a date", () => {
    expect(changes(" ", "x", "- [ ] 任务 ✅ 做完了").add).toEqual([
      "completed",
    ]);
  });

  it("takes off a date in any form", () => {
    expect(changes("/", " ", "- [/] 任务 🚀 2026-10-01").remove).toEqual([
      "start",
    ]);
    expect(changes("/", " ", "- [/] 任务 [start:: 2026-10-01]").remove).toEqual(
      ["start"]
    );
    expect(
      changes("x", " ", "- [x] 任务 [completion:: 2026-10-01 12:30]").remove
    ).toEqual(["completed"]);
  });

  it("goes by the markers of the settings, and still knows the default ones", () => {
    const custom: StatusDateSettings = {
      ...allOn,
      startDateMarker: "▶️",
      completedDateMarker: "☑️",
      cancelledDateMarker: "🚫",
    };
    expect(changes(" ", "/", "- [ ] 任务 ▶️ 2026-10-01", custom).add).toEqual(
      []
    );
    expect(changes("/", "x", "- [/] 任务 ▶️ 2026-10-01", custom)).toEqual(
      to(["completed"], ["start"])
    );
    expect(changes("/", "x", "- [/] 任务 🛫 2026-10-01", custom)).toEqual(
      to(["completed"], ["start"])
    );
    expect(changes("x", "-", "- [x] 任务 ☑️ 2026-10-01", custom)).toEqual(
      to(["cancelled"], ["completed"])
    );
  });
});

describe("removeDate", () => {
  it("takes the whitespace before the date with it", () => {
    expect(removeDate("- [x] 任务 ✅ 2026-10-01", "completed", allOn)).toBe(
      "- [x] 任务"
    );
    expect(
      removeDate("- [x] 任务 ✅ 2026-10-01 #标签", "completed", allOn)
    ).toBe("- [x] 任务 #标签");
    expect(
      removeDate("- [x] 任务   ✅ 2026-10-01 ^block", "completed", allOn)
    ).toBe("- [x] 任务 ^block");
    expect(removeDate("- [x] ✅ 2026-10-01 任务", "completed", allOn)).toBe(
      "- [x] 任务"
    );
  });

  it("takes off a time with the date", () => {
    expect(
      removeDate("- [x] 任务 ✅ 2026-10-01 12:30 #a", "completed", allOn)
    ).toBe("- [x] 任务 #a");
    expect(
      removeDate("- [x] 任务 ✅ 2026-10-01 9:05:30", "completed", allOn)
    ).toBe("- [x] 任务");
  });

  it("takes off the Dataview form", () => {
    expect(
      removeDate("- [x] 任务 [completion:: 2026-10-01] #a", "completed", allOn)
    ).toBe("- [x] 任务 #a");
    expect(removeDate("- [/] 任务 [start::2026-10-01]", "start", allOn)).toBe(
      "- [/] 任务"
    );
    expect(
      removeDate(
        "- [-] 任务 [cancelled:: 2026-10-01 08:00]",
        "cancelled",
        allOn
      )
    ).toBe("- [-] 任务");
  });

  it("takes off the legacy start marker and every copy of a date", () => {
    expect(removeDate("- [/] 任务 🚀 2026-10-01", "start", allOn)).toBe(
      "- [/] 任务"
    );
    expect(
      removeDate(
        "- [/] 任务 🛫 2026-10-01 #a 🚀 2026-09-01 [start:: 2026-08-01]",
        "start",
        allOn
      )
    ).toBe("- [/] 任务 #a");
  });

  it("leaves the other dates and the rest of the line alone", () => {
    const line =
      "  - [ ] 任务 📅 2026-10-20 🛫 2026-10-01 ⏳ 2026-10-10 ✅ 2026-10-02 ^id";
    expect(removeDate(line, "start", allOn)).toBe(
      "  - [ ] 任务 📅 2026-10-20 ⏳ 2026-10-10 ✅ 2026-10-02 ^id"
    );
    expect(removeDate(line, "completed", allOn)).toBe(
      "  - [ ] 任务 📅 2026-10-20 🛫 2026-10-01 ⏳ 2026-10-10 ^id"
    );
    expect(removeDate(line, "cancelled", allOn)).toBe(line);
  });

  it("leaves a marker without a date", () => {
    expect(removeDate("- [x] ✅ 做完了", "completed", allOn)).toBe(
      "- [x] ✅ 做完了"
    );
    expect(removeDate("- [x] 任务 ✅ 2026-1-1", "completed", allOn)).toBe(
      "- [x] 任务 ✅ 2026-1-1"
    );
  });

  it("goes by the markers of the settings", () => {
    const custom: StatusDateSettings = { ...allOn, completedDateMarker: "☑️" };
    expect(removeDate("- [x] 任务 ☑️ 2026-10-01", "completed", custom)).toBe(
      "- [x] 任务"
    );
    // A marker with characters that mean something in a pattern
    const odd: StatusDateSettings = { ...allOn, completedDateMarker: "[done]" };
    expect(removeDate("- [x] 任务 [done] 2026-10-01", "completed", odd)).toBe(
      "- [x] 任务"
    );
  });
});

describe("findDateRanges and hasDate", () => {
  it("find where the date is, with the whitespace before it", () => {
    const line = "- [x] 任务 ✅ 2026-10-01 #a";
    const ranges = findDateRanges(line, "completed", allOn);
    expect(ranges).toHaveLength(1);
    expect(line.slice(ranges[0].start, ranges[0].end)).toBe(" ✅ 2026-10-01");
    expect(findDateRanges(line, "start", allOn)).toEqual([]);
  });

  it("tell if a date is there", () => {
    expect(hasDate("- [ ] 任务 🛫 2026-10-01", "start", allOn)).toBe(true);
    expect(hasDate("- [ ] 任务 🛫 2026-10-01", "completed", allOn)).toBe(false);
    expect(hasDate("- [ ] 任务", "start", allOn)).toBe(false);
    expect(hasDate("- [ ] 任务 🛫 2026-10-01", "start", undefined)).toBe(true);
  });
});

describe("formatDateMetadata", () => {
  it("writes the marker of the settings", () => {
    expect(formatDateMetadata("start", "2026-10-15", allOn, false)).toBe(
      "🛫 2026-10-15"
    );
    expect(
      formatDateMetadata("completed", "2026-10-15 12:30", allOn, false)
    ).toBe("✅ 2026-10-15 12:30");
    const custom = { ...allOn, cancelledDateMarker: "🚫" };
    expect(formatDateMetadata("cancelled", "2026-10-15", custom, false)).toBe(
      "🚫 2026-10-15"
    );
  });

  it("falls back to the default markers", () => {
    expect(formatDateMetadata("start", "2026-10-15", undefined, false)).toBe(
      "🛫 2026-10-15"
    );
    expect(formatDateMetadata("completed", "2026-10-15", {}, false)).toBe(
      "✅ 2026-10-15"
    );
    expect(formatDateMetadata("cancelled", "2026-10-15", {}, false)).toBe(
      "❌ 2026-10-15"
    );
  });

  it("writes Dataview fields", () => {
    expect(formatDateMetadata("start", "2026-10-15", allOn, true)).toBe(
      "[start:: 2026-10-15]"
    );
    expect(formatDateMetadata("completed", "2026-10-15", allOn, true)).toBe(
      "[completion:: 2026-10-15]"
    );
    expect(formatDateMetadata("cancelled", "2026-10-15", allOn, true)).toBe(
      "[cancelled:: 2026-10-15]"
    );
  });
});

describe("formatDate", () => {
  const date = new Date(2026, 0, 5, 9, 7, 3);

  it("writes the parts of the date the format asks for", () => {
    expect(formatDate(date, "YYYY-MM-DD")).toBe("2026-01-05");
    expect(formatDate(date, "YYYY-MM-DD HH:mm")).toBe("2026-01-05 09:07");
    expect(formatDate(date, "YYYY/MM/DD HH:mm:ss")).toBe("2026/01/05 09:07:03");
  });
});

describe("setLineStatus", () => {
  const source = {
    taskStatuses: userTaskStatuses,
    autoDateManager: userAutoDateManager,
    preferMetadataFormat: "tasks",
  };

  it.each(SCENARIOS)("$name", ({ before, mark, after }) => {
    expect(setLineStatus(before, mark, source, NOW)).toBe(after);
  });

  it("only sets the mark without TaskGenius", () => {
    expect(setLineStatus("- [ ] 任务", "x", undefined, NOW)).toBe("- [x] 任务");
    expect(setLineStatus("- [/] 任务 🛫 2026-10-01", "x", undefined, NOW)).toBe(
      "- [x] 任务 🛫 2026-10-01"
    );
    expect(
      setLineStatus("- [/] 任务 🛫 2026-10-01", "x", { taskStatuses }, NOW)
    ).toBe("- [x] 任务 🛫 2026-10-01");
  });

  it("leaves a line without a checkbox alone", () => {
    expect(setLineStatus("任务 [x] ✅ 2026-10-01", " ", source, NOW)).toBe(
      "任务 [x] ✅ 2026-10-01"
    );
    expect(setLineStatus("", "x", source, NOW)).toBe("");
  });

  it("works on every kind of list item", () => {
    expect(setLineStatus("* [ ] 任务", "x", source, NOW)).toBe(
      `* [x] 任务 ✅ ${TODAY}`
    );
    expect(setLineStatus("1. [x] 任务 ✅ 2026-10-01", "/", source, NOW)).toBe(
      `1. [/] 任务 🛫 ${TODAY}`
    );
    expect(setLineStatus("> - [ ] 任务", "/", source, NOW)).toBe(
      `> - [/] 任务 🛫 ${TODAY}`
    );
  });

  it("takes today from the clock", () => {
    jest.useFakeTimers({ now: NOW });
    try {
      expect(setLineStatus("- [ ] 任务", "x", source)).toBe(
        `- [x] 任务 ✅ ${TODAY}`
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("writes the marker and the format of the settings", () => {
    const custom = {
      ...source,
      autoDateManager: {
        ...userAutoDateManager,
        completedDateMarker: "🏁",
        completedDateFormat: "YYYY-MM-DD HH:mm",
      },
    };
    const done = setLineStatus("- [ ] 任务", "x", custom, NOW);
    expect(done).toBe(`- [x] 任务 🏁 ${TODAY} 12:00`);
    // The date and its time go, and ✅ counts as a completed date too
    expect(setLineStatus(`${done} #a ✅ 2026-10-01`, "/", custom, NOW)).toBe(
      `- [/] 任务 #a 🛫 ${TODAY}`
    );
  });

  it("only touches the dates that are managed", () => {
    const noComplete = {
      ...source,
      autoDateManager: { ...userAutoDateManager, manageCompletedDate: false },
    };
    expect(setLineStatus("- [ ] 任务", "x", noComplete, NOW)).toBe(
      "- [x] 任务"
    );
    expect(
      setLineStatus("- [x] 任务 ✅ 2026-10-01", "/", noComplete, NOW)
    ).toBe(`- [/] 任务 ✅ 2026-10-01 🛫 ${TODAY}`);
  });

  it("writes Dataview fields in the Dataview format", () => {
    const dataview = { ...source, preferMetadataFormat: "dataview" };
    expect(setLineStatus("- [ ] 任务", "/", dataview, NOW)).toBe(
      `- [/] 任务 [start:: ${TODAY}]`
    );
    expect(
      setLineStatus("- [/] 任务 [start:: 2026-10-01]", "x", dataview, NOW)
    ).toBe(`- [x] 任务 [completion:: ${TODAY}]`);
    expect(
      setLineStatus("- [x] 任务 [completion:: 2026-10-01]", "-", dataview, NOW)
    ).toBe(`- [-] 任务 [cancelled:: ${TODAY}]`);
    // Dates in the other format go too
    expect(setLineStatus("- [x] 任务 ✅ 2026-10-01", " ", dataview, NOW)).toBe(
      "- [ ] 任务"
    );
    expect(
      setLineStatus("- [x] 任务 [completion:: 2026-10-01]", "/", source, NOW)
    ).toBe(`- [/] 任务 🛫 ${TODAY}`);
  });

  it("puts a mark that means something in a replacement pattern on the line", () => {
    expect(setLineStatus("- [x] 任务 ✅ 2026-10-01", "$", source, NOW)).toBe(
      "- [$] 任务 ✅ 2026-10-01"
    );
  });
});
