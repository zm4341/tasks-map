import { App } from "./mocks/obsidian";
import { Task, TaskStatus } from "../src/types/task";
import { updateTaskStatusInVault } from "../src/lib/utils";
import {
  TODAY,
  NOW,
  userAutoDateManager,
  userTaskStatuses,
} from "./status-date-scenarios";

// TaskGenius settings as in the user's vault
const taskGeniusSettings = {
  taskStatuses: userTaskStatuses,
  autoDateManager: userAutoDateManager,
  preferMetadataFormat: "tasks",
  countOtherStatusesAs: "notStarted",
  statusCycles: [
    {
      enabled: true,
      cycle: [
        "Not Started",
        "In Progress",
        "Completed",
        "Abandoned",
        "Planned",
      ],
      marks: {
        "Not Started": " ",
        "In Progress": "/",
        Completed: "x",
        Abandoned: "-",
        Planned: "?",
      },
    },
  ],
};

describe("updateTaskStatusInVault moves the dates with the status", () => {
  const path = "Tasks/改善统计图.md";
  let app: App;

  const makeTask = (id: string, text: string): Task => ({
    id,
    type: "dataview",
    summary: text,
    text,
    tags: [],
    status: "todo",
    priority: "",
    link: path,
    incomingLinks: [],
    starred: false,
  });

  // Sets the status of the task on the first line of a note; null for a
  // vault without TaskGenius
  async function change(
    line: string,
    status: TaskStatus,
    settings: unknown = taskGeniusSettings
  ) {
    app = new App();
    (app as unknown as { plugins: unknown }).plugins = {
      plugins:
        settings === null ? {} : { "obsidian-task-progress-bar": { settings } },
    };
    app.vault.setFileContent(path, line);
    const text = line.replace(/^\s*[-*+]\s+\[.\]\s*/, "");
    await updateTaskStatusInVault(
      makeTask(`${path}:0`, text),
      status,
      app as never
    );
    return app.vault.getFileContent(path);
  }

  beforeAll(() => {
    // Only the date; the rest of the timers stay real
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        "nextTick",
        "setImmediate",
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "queueMicrotask",
        "performance",
      ],
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("gives a task that is started its start date", async () => {
    expect(await change("- [ ] 改善统计图 #a ⏫", "in_progress")).toBe(
      `- [/] 改善统计图 #a ⏫ 🛫 ${TODAY}`
    );
  });

  it("swaps the start date for the completed date when it is completed", async () => {
    expect(await change("- [/] 任务 🛫 2026-10-01", "done")).toBe(
      `- [x] 任务 ✅ ${TODAY}`
    );
  });

  it("drops the completed date when a completed task is reopened", async () => {
    expect(await change("- [x] 任务 ✅ 2026-10-01", "in_progress")).toBe(
      `- [/] 任务 🛫 ${TODAY}`
    );
    expect(await change("- [x] 任务 ✅ 2026-10-01 12:30", "todo")).toBe(
      "- [ ] 任务"
    );
  });

  it("swaps the dates when a task is abandoned and when it is taken back", async () => {
    expect(await change("- [/] 任务 🛫 2026-10-01", "canceled")).toBe(
      `- [-] 任务 ❌ ${TODAY}`
    );
    expect(await change("- [-] 任务 ❌ 2026-10-01", "in_progress")).toBe(
      `- [/] 任务 🛫 ${TODAY}`
    );
    expect(await change("- [-] 任务 ❌ 2026-10-01", "done")).toBe(
      `- [x] 任务 ✅ ${TODAY}`
    );
  });

  it("takes all the dates off a task that goes to planned or not started", async () => {
    expect(await change("- [/] 任务 🛫 2026-10-01", "planned")).toBe(
      "- [?] 任务"
    );
    expect(
      await change(
        "- [x] 任务 🛫 2026-10-01 ✅ 2026-10-02 ❌ 2026-10-03",
        "todo"
      )
    ).toBe("- [ ] 任务");
  });

  it("leaves the dates of an archived task", async () => {
    expect(await change("- [x] 任务 ✅ 2026-10-01", "archived")).toBe(
      "- [a] 任务 ✅ 2026-10-01"
    );
  });

  it("changes nothing but the mark inside a category", async () => {
    // TaskGenius writes "x" for done, which is in the category of "X"
    expect(await change("- [X] 任务 ✅ 2026-10-01", "done")).toBe(
      "- [x] 任务 ✅ 2026-10-01"
    );
    expect(await change("- [d] 任务 🛫 2026-10-01", "in_progress")).toBe(
      "- [/] 任务 🛫 2026-10-01"
    );
  });

  it("keeps the dates it has, the indent and the other metadata", async () => {
    expect(
      await change(
        "    - [ ] 子任务 #a 📅 2026-10-20 🛫 2026-10-01",
        "in_progress"
      )
    ).toBe("    - [/] 子任务 #a 📅 2026-10-20 🛫 2026-10-01");
    expect(
      await change("    - [x] 子任务 ✅ 2026-10-01 #a 📅 2026-10-20", "todo")
    ).toBe("    - [ ] 子任务 #a 📅 2026-10-20");
  });

  it("keeps a block reference last", async () => {
    expect(await change("- [ ] 任务 ^abc", "done")).toBe(
      `- [x] 任务 ✅ ${TODAY} ^abc`
    );
  });

  it("only touches the task line, not the rest of the note", async () => {
    app = new App();
    (app as unknown as { plugins: unknown }).plugins = {
      plugins: {
        "obsidian-task-progress-bar": { settings: taskGeniusSettings },
      },
    };
    app.vault.setFileContent(
      path,
      "---\nProject: A\n---\n# 标题\n- [ ] 其他\n- [/] 任务 🛫 2026-10-01\n- [x] 完成 ✅ 2026-09-01\n"
    );

    await updateTaskStatusInVault(
      makeTask(`${path}:5`, "任务 🛫 2026-10-01"),
      "done",
      app as never
    );

    expect(app.vault.getFileContent(path)).toBe(
      `---\nProject: A\n---\n# 标题\n- [ ] 其他\n- [x] 任务 ✅ ${TODAY}\n- [x] 完成 ✅ 2026-09-01\n`
    );
  });

  it("goes by the manage switches of TaskGenius", async () => {
    const noDates = {
      ...taskGeniusSettings,
      autoDateManager: {
        ...userAutoDateManager,
        manageStartDate: false,
        manageCompletedDate: false,
        manageCancelledDate: false,
      },
    };
    expect(await change("- [ ] 任务", "done", noDates)).toBe("- [x] 任务");
    expect(
      await change("- [x] 任务 ✅ 2026-10-01", "in_progress", noDates)
    ).toBe("- [/] 任务 ✅ 2026-10-01");
  });

  it("writes the markers and the Dataview format of TaskGenius", async () => {
    const dataview = {
      ...taskGeniusSettings,
      preferMetadataFormat: "dataview",
    };
    expect(await change("- [ ] 任务", "in_progress", dataview)).toBe(
      `- [/] 任务 [start:: ${TODAY}]`
    );
    expect(
      await change("- [x] 任务 [completion:: 2026-10-01]", "canceled", dataview)
    ).toBe(`- [-] 任务 [cancelled:: ${TODAY}]`);

    const custom = {
      ...taskGeniusSettings,
      autoDateManager: { ...userAutoDateManager, completedDateMarker: "🏁" },
    };
    expect(await change("- [ ] 任务", "done", custom)).toBe(
      `- [x] 任务 🏁 ${TODAY}`
    );
  });

  it("changes only the mark without a date setting in TaskGenius", async () => {
    const withoutDates = { ...taskGeniusSettings, autoDateManager: undefined };
    expect(await change("- [/] 任务 🛫 2026-10-01", "done", withoutDates)).toBe(
      "- [x] 任务 🛫 2026-10-01"
    );
  });

  it("changes only the mark without TaskGenius", async () => {
    // The mark TaskGenius starts with for in progress
    expect(await change("- [ ] 任务", "in_progress", null)).toBe("- [>] 任务");
    expect(await change("- [x] 任务 ✅ 2026-10-01", "todo", null)).toBe(
      "- [ ] 任务 ✅ 2026-10-01"
    );
  });

  it("leaves a note task to its frontmatter, with its dates", async () => {
    app = new App();
    (app as unknown as { plugins: unknown }).plugins = {
      plugins: {
        "obsidian-task-progress-bar": { settings: taskGeniusSettings },
      },
    };
    const notePath = "TaskNotes/Tasks/Task1.md";
    app.vault.setFileContent(
      notePath,
      "---\nstatus: open\n---\n- [ ] 子项 ✅ 2026-10-01\n"
    );
    const task: Task = {
      ...makeTask(notePath, "Task1"),
      type: "note",
      link: notePath,
    };

    await updateTaskStatusInVault(task, "in_progress", app as never);

    expect(app.vault.getFileContent(notePath)).toBe(
      "---\nstatus: in-progress\n---\n- [ ] 子项 ✅ 2026-10-01\n"
    );
  });
});
