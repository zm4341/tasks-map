import {
  contextLinkTarget,
  contextLinkText,
  parseContext,
  removeContexts,
} from "../src/lib/task-context";
import { TaskFactory } from "../src/lib/task-factory";

describe("parseContext", () => {
  it("reads a name after an @", () => {
    expect(parseContext("撰写 GDD #project/Development/AKG @GDD")).toBe("GDD");
    expect(parseContext("Call Bob @home-office later")).toBe("home-office");
  });

  it("reads names in any script, up to punctuation", () => {
    expect(parseContext("练习 @钢琴练习，每天")).toBe("钢琴练习");
  });

  it("reads a note as the context", () => {
    expect(parseContext("AI 教师可以看图 #AI教师 @[[实现多角色]]")).toBe(
      "[[实现多角色]]"
    );
    expect(parseContext("Read @[[Books#Fiction|novels]] first")).toBe(
      "[[Books#Fiction|novels]]"
    );
  });

  it("takes the last context, like TaskGenius", () => {
    expect(parseContext("@home call @office")).toBe("office");
  });

  it("ignores an @ inside a word, a link, code or a URL", () => {
    expect(parseContext("Mail me@example.com")).toBeUndefined();
    expect(parseContext("See [[@mentions]] and `@decorator`")).toBeUndefined();
    expect(parseContext("Open https://x.com/@user")).toBeUndefined();
    expect(parseContext("Nothing @ here")).toBeUndefined();
  });
});

describe("removeContexts", () => {
  it("removes contexts with the space before them", () => {
    expect(removeContexts("Call @Bob tomorrow")).toBe("Call tomorrow");
    expect(removeContexts("A #tag @[[实现多角色]]")).toBe("A #tag");
    expect(removeContexts("Mail me@example.com")).toBe("Mail me@example.com");
  });
});

describe("context links", () => {
  it("tells the note a context links to", () => {
    expect(contextLinkTarget("[[实现多角色]]")).toBe("实现多角色");
    expect(contextLinkTarget("[[Books#Fiction|novels]]")).toBe("Books#Fiction");
    expect(contextLinkTarget("Dev")).toBeNull();
  });

  it("shows a link the way Obsidian does", () => {
    expect(contextLinkText("[[实现多角色]]")).toBe("实现多角色");
    expect(contextLinkText("[[Books#Fiction|novels]]")).toBe("novels");
    expect(contextLinkText("[[Books#Fiction]]")).toBe("Books > Fiction");
  });
});

describe("TaskFactory contexts", () => {
  it("keeps the context out of the summary", () => {
    const task = new TaskFactory().parse({
      status: " ",
      text: "AI 教师生成 Manim 动态图 #AI教师 #project/Development/Vernify/Add @[[实现多角色]]",
      link: { path: "Tasks/AI.md" },
    });

    expect(task.summary).toBe("AI 教师生成 Manim 动态图");
    expect(task.context).toBe("[[实现多角色]]");
    expect(task.tags).toEqual(["AI教师", "project/Development/Vernify/Add"]);
  });
});
