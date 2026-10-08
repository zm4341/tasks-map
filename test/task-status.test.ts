import { App } from "./mocks/obsidian";
import { Task } from "../src/types/task";
import { createTaskStatusConfig } from "../src/lib/task-status";
import { TaskFactory } from "../src/lib/task-factory";
import { updateTaskStatusInVault } from "../src/lib/utils";

// TaskGenius settings with marks that differ from its defaults
const taskGeniusSettings = {
  taskStatuses: {
    completed: "x|X",
    inProgress: "/|d",
    abandoned: "-",
    planned: ">|?",
    notStarted: " |D|+|R",
    archived: "a",
  },
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

describe("Task status config", () => {
  it("uses the TaskGenius defaults without TaskGenius", () => {
    const config = createTaskStatusConfig();

    expect(config.getStatus(" ")).toBe("todo");
    expect(config.getStatus("/")).toBe("in_progress");
    expect(config.getStatus(">")).toBe("in_progress");
    expect(config.getStatus("x")).toBe("done");
    expect(config.getStatus("X")).toBe("done");
    expect(config.getStatus("-")).toBe("canceled");
    expect(config.getStatus("?")).toBe("planned");
    expect(config.getStatus("a")).toBe("archived");
    expect(config.getStatus("!")).toBe("todo");
  });

  it("reads the marks of each status from the TaskGenius settings", () => {
    const config = createTaskStatusConfig(taskGeniusSettings);

    expect(config.getStatus(">")).toBe("planned");
    expect(config.getStatus("?")).toBe("planned");
    expect(config.getStatus("d")).toBe("in_progress");
    expect(config.getStatus("D")).toBe("todo");
    expect(config.getStatus("a")).toBe("archived");
  });

  it("counts unlisted marks as countOtherStatusesAs", () => {
    const config = createTaskStatusConfig({
      ...taskGeniusSettings,
      countOtherStatusesAs: "completed",
    });

    expect(config.getStatus("!")).toBe("done");
  });

  it("writes the marks of the status cycle first", () => {
    const config = createTaskStatusConfig(taskGeniusSettings);

    expect(config.getMark("planned")).toBe("?");
    expect(config.getMark("in_progress")).toBe("/");
    expect(config.getMark("todo")).toBe(" ");
    expect(config.getMark("done")).toBe("x");
    expect(config.getMark("canceled")).toBe("-");
    // Not in the cycle, so the first archived mark
    expect(config.getMark("archived")).toBe("a");
  });

  it("ignores disabled status cycles", () => {
    const config = createTaskStatusConfig({
      ...taskGeniusSettings,
      statusCycles: [{ ...taskGeniusSettings.statusCycles[0], enabled: false }],
    });

    expect(config.getMark("planned")).toBe(">");
  });
});

describe("TaskFactory statuses", () => {
  it("parses statuses with the given config and keeps the mark", () => {
    const factory = new TaskFactory(createTaskStatusConfig(taskGeniusSettings));
    const task = factory.parse({
      status: "?",
      text: "改善统计图 #project/Development/Vernify/Enhance ⏫",
      link: { path: "Tasks/改善统计图.md" },
    });

    expect(task.status).toBe("planned");
    expect(task.statusMark).toBe("?");
    expect(task.summary).toBe("改善统计图");
  });

  it("still parses the status words of note-based tasks", () => {
    const factory = new TaskFactory();
    const parse = (status: string) =>
      factory.parse(
        { status, text: "Task", link: { path: "Task.md" } },
        "note"
      );

    expect(parse("in-progress").status).toBe("in_progress");
    expect(parse("done").status).toBe("done");
    expect(parse("canceled").status).toBe("canceled");
    expect(parse("open").status).toBe("todo");
    expect(parse("open").statusMark).toBeUndefined();
  });
});

describe("updateTaskStatusInVault", () => {
  const path = "Tasks/改善统计图.md";
  let app: App;

  const makeTask = (id: string, text: string): Task => ({
    id,
    type: "dataview",
    summary: text,
    text,
    tags: [],
    status: "planned",
    priority: "",
    link: path,
    incomingLinks: [],
    starred: false,
  });

  beforeEach(() => {
    app = new App();
    (app as unknown as { plugins: unknown }).plugins = {
      plugins: {
        "obsidian-task-progress-bar": { settings: taskGeniusSettings },
      },
    };
  });

  it("changes any mark, not only the default ones", async () => {
    app.vault.setFileContent(
      path,
      "---\nProject: A\n---\n- [?] 改善统计图 #a ⏫"
    );

    await updateTaskStatusInVault(
      makeTask(`${path}:3`, "改善统计图 #a ⏫"),
      "in_progress",
      app as never
    );

    expect(app.vault.getFileContent(path)).toBe(
      "---\nProject: A\n---\n- [/] 改善统计图 #a ⏫"
    );
  });

  it("writes the marks configured in TaskGenius", async () => {
    app.vault.setFileContent(path, "- [ ] Task");

    await updateTaskStatusInVault(
      makeTask(`${path}:0`, "Task"),
      "planned",
      app as never
    );
    expect(app.vault.getFileContent(path)).toBe("- [?] Task");

    await updateTaskStatusInVault(
      makeTask(`${path}:0`, "Task"),
      "archived",
      app as never
    );
    expect(app.vault.getFileContent(path)).toBe("- [a] Task");
  });

  it("only touches the checkbox of the task", async () => {
    app.vault.setFileContent(path, "  1. [a] Read [x] notes");

    await updateTaskStatusInVault(
      makeTask(`${path}:0`, "Read [x] notes"),
      "todo",
      app as never
    );

    expect(app.vault.getFileContent(path)).toBe("  1. [ ] Read [x] notes");
  });

  it("finds the task by the line in its path:line ID", async () => {
    app.vault.setFileContent(path, "- [ ] Same\n- [ ] Same");

    await updateTaskStatusInVault(
      makeTask(`${path}:1`, "Same"),
      "done",
      app as never
    );

    expect(app.vault.getFileContent(path)).toBe("- [ ] Same\n- [x] Same");
  });
});
