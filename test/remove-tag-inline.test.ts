import { App } from "./mocks/obsidian";
import { Task } from "../src/types/task";
import { removeTagFromTaskInVault } from "../src/lib/utils";

describe("removeTagFromTaskInVault on a task line", () => {
  const path = "Tasks/任务.md";
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

  beforeEach(() => {
    app = new App();
  });

  // Removes the tag from the task on the line (the first of the note)
  async function remove(content: string, taskText: string, tag: string) {
    app.vault.setFileContent(path, content);
    await removeTagFromTaskInVault(
      makeTask(`${path}:0`, taskText),
      tag,
      app as never
    );
    return app.vault.getFileContent(path);
  }

  it("takes the tag and the whitespace before it off the line", async () => {
    expect(await remove("- [ ] 任务 #a #b", "任务 #a #b", "a")).toBe(
      "- [ ] 任务 #b"
    );
    expect(await remove("- [ ] 任务 #a 后面", "任务 #a 后面", "a")).toBe(
      "- [ ] 任务 后面"
    );
    expect(await remove("- [ ] #a 任务", "#a 任务", "a")).toBe("- [ ] 任务");
  });

  it("keeps the indent of a subtask", async () => {
    expect(await remove("    - [ ] 子任务 #a #b", "子任务 #a #b", "a")).toBe(
      "    - [ ] 子任务 #b"
    );
    expect(await remove("\t\t- [ ] 子任务 #a", "子任务 #a", "a")).toBe(
      "\t\t- [ ] 子任务"
    );
    expect(await remove("  1. [/] 子任务 #a", "子任务 #a", "a")).toBe(
      "  1. [/] 子任务"
    );
  });

  it("leaves the other whitespace of the line as it is", async () => {
    expect(
      await remove(
        "- [ ] 任务  有   几个  空格 #a",
        "任务  有   几个  空格 #a",
        "a"
      )
    ).toBe("- [ ] 任务  有   几个  空格");
    expect(await remove("- [ ] a\tb #a", "a\tb #a", "a")).toBe("- [ ] a\tb");
    // Not even a space at the end
    expect(await remove("- [ ] 任务 #a  ", "任务 #a  ", "a")).toBe(
      "- [ ] 任务  "
    );
  });

  it("takes sub-tags of the tag off with it, and no other tag", async () => {
    expect(
      await remove("- [ ] 任务 #a/b #ab #c", "任务 #a/b #ab #c", "a")
    ).toBe("- [ ] 任务 #ab #c");
  });

  it("takes every copy of the tag off", async () => {
    expect(await remove("- [ ] #a 任务 #a", "#a 任务 #a", "a")).toBe(
      "- [ ] 任务"
    );
  });

  it("leaves the other lines of the note", async () => {
    expect(
      await remove(
        "- [ ] 任务 #a\n    - [ ] 子任务  #a  #b\n其他  文字 #a\n",
        "任务 #a",
        "a"
      )
    ).toBe("- [ ] 任务\n    - [ ] 子任务  #a  #b\n其他  文字 #a\n");
  });

  it("finds the task by its text when the line moved", async () => {
    app.vault.setFileContent(path, "新增一行\n    - [ ] 子任务  #a  #b");
    await removeTagFromTaskInVault(
      makeTask(`${path}:0`, "子任务  #a  #b"),
      "a",
      app as never
    );
    expect(app.vault.getFileContent(path)).toBe(
      "新增一行\n    - [ ] 子任务  #b"
    );
  });
});
