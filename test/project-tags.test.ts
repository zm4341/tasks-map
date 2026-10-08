import { App } from "./mocks/obsidian";
import { getProjectTagPrefix, splitProjectTags } from "../src/lib/project-tags";

describe("splitProjectTags", () => {
  it("takes project tags apart from the other tags", () => {
    expect(
      splitProjectTags(
        ["AI教师", "project/Development/Vernify/Add", "学科功能"],
        "project"
      )
    ).toEqual({
      projects: ["Development/Vernify/Add"],
      tags: ["AI教师", "学科功能"],
    });
  });

  it("ignores the case and a leading # of tags", () => {
    expect(splitProjectTags(["#Project/AI/Agent"], "project").projects).toEqual(
      ["AI/Agent"]
    );
  });

  it("only counts tags below the prefix as projects", () => {
    expect(
      splitProjectTags(["project", "projects/A", "project/"], "project")
    ).toEqual({ projects: [], tags: ["project", "projects/A"] });
  });

  it("uses the given prefix", () => {
    expect(splitProjectTags(["proj/A", "project/B"], "proj")).toEqual({
      projects: ["A"],
      tags: ["project/B"],
    });
  });
});

describe("getProjectTagPrefix", () => {
  it("reads the prefix from the TaskGenius settings", () => {
    const app = new App();
    (app as unknown as { plugins: unknown }).plugins = {
      plugins: {
        "obsidian-task-progress-bar": {
          settings: { projectTagPrefix: { tasks: "proj", dataview: "proj" } },
        },
      },
    };

    expect(getProjectTagPrefix(app as never)).toBe("proj");
  });

  it("falls back to project without TaskGenius", () => {
    expect(getProjectTagPrefix(new App() as never)).toBe("project");
  });
});
