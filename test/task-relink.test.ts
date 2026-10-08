import { relinkTasks, renameTask } from "../src/lib/task-relink";
import { Task } from "../src/types/task";

const NOTE = "Tasks/Projects/AI/Agent.md";

// A task scanned from a note, on a line counted from 0
const task = (text: string, line = 8, note = NOTE): Task => ({
  id: `${note}:${line}`,
  type: "dataview",
  summary: text,
  text,
  tags: [],
  status: "todo",
  priority: "",
  link: note,
  incomingLinks: [],
  starred: false,
});

// The IDs of the tasks found for the nodes
const relink = (nodeTasks: Task[], scannedTasks: Task[]) =>
  relinkTasks(nodeTasks, scannedTasks).map((found) => found?.id);

describe("relinkTasks", () => {
  it("keeps the tasks that didn't move", () => {
    expect(relink([task("A")], [task("B", 3), task("A")])).toEqual([
      `${NOTE}:8`,
    ]);
  });

  it("follows a task when lines are added above it", () => {
    expect(relink([task("A")], [task("A", 9)])).toEqual([`${NOTE}:9`]);
  });

  it("follows tasks that moved onto each other's lines", () => {
    const nodes = [task("A", 8), task("B", 9)];

    // A line was added above both
    expect(relink(nodes, [task("A", 9), task("B", 10)])).toEqual([
      `${NOTE}:9`,
      `${NOTE}:10`,
    ]);
    // The lines were swapped
    expect(relink(nodes, [task("B", 8), task("A", 9)])).toEqual([
      `${NOTE}:9`,
      `${NOTE}:8`,
    ]);
  });

  it("doesn't give a deleted task's line to its node", () => {
    // A was deleted, B moved up onto its line
    expect(relink([task("A", 8), task("B", 9)], [task("B", 8)])).toEqual([
      undefined,
      `${NOTE}:8`,
    ]);
  });

  it("picks the closest of the tasks with the same text", () => {
    expect(relink([task("A", 8)], [task("A", 3), task("A", 10)])).toEqual([
      `${NOTE}:10`,
    ]);
  });

  it("keeps a task whose text was edited", () => {
    expect(relink([task("A")], [task("A, edited")])).toEqual([`${NOTE}:8`]);
  });

  it("follows the only task of a note, even edited", () => {
    expect(relink([task("A", 8)], [task("A, edited", 9)])).toEqual([
      `${NOTE}:9`,
    ]);
    // With several tasks in the note, it can't tell
    expect(relink([task("A", 8)], [task("B", 9), task("C", 10)])).toEqual([
      undefined,
    ]);
  });

  it("follows a task to another note by its text", () => {
    const other = "Tasks/Projects/AI/Other.md";

    expect(relink([task("A")], [task("A", 3, other)])).toEqual([`${other}:3`]);
    // With the text in several notes, it can't tell
    expect(
      relink([task("A")], [task("A", 3, other), task("A", 3, "Tasks/Third.md")])
    ).toEqual([undefined]);
  });

  it("gives a task to one node only", () => {
    // Two nodes show the same task, from before nodes followed their tasks
    expect(relink([task("A", 8), task("A", 9)], [task("A", 9)])).toEqual([
      undefined,
      `${NOTE}:9`,
    ]);
  });

  it("ignores tasks from Dataview, their IDs don't say where they are", () => {
    expect(relink([task("A")], [{ ...task("A"), id: "abc123" }])).toEqual([
      undefined,
    ]);
  });

  it("leaves note tasks and nodes without tasks alone", () => {
    const noteTask = { ...task("A"), type: "note" as const };

    expect(relinkTasks([noteTask, undefined], [task("A")])).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe("renameTask", () => {
  it("moves a task with its note", () => {
    expect(renameTask(task("A"), NOTE, "Tasks/Agent.md")).toMatchObject({
      id: "Tasks/Agent.md:8",
      link: "Tasks/Agent.md",
      text: "A",
    });
  });

  it("moves a task with a folder its note is in", () => {
    expect(
      renameTask(task("A"), "Tasks/Projects/AI", "Tasks/Projects/ML")
    ).toMatchObject({
      id: "Tasks/Projects/ML/Agent.md:8",
      link: "Tasks/Projects/ML/Agent.md",
    });
  });

  it("leaves tasks in other notes and folders alone", () => {
    expect(renameTask(task("A"), "Tasks/Projects/A", "Tasks/B")).toBeNull();
    expect(renameTask(task("A"), "Tasks/Other.md", "Tasks/B.md")).toBeNull();
  });

  it("keeps IDs that don't say where the task is", () => {
    expect(
      renameTask({ ...task("A"), id: "abc123" }, NOTE, "Tasks/Agent.md")
    ).toMatchObject({ id: "abc123", link: "Tasks/Agent.md" });
  });
});
