import { groupByProject, NO_PROJECT } from "../src/lib/project-groups";

const task = (summary: string, project: string) => ({ summary, project });
const getProject = (t: { project: string }) => t.project;

describe("groupByProject", () => {
  it("groups tasks by project, keeping their order", () => {
    const groups = groupByProject(
      [
        task("A", "AI/Agent"),
        task("B", "Writing/Story"),
        task("C", "AI/Agent"),
      ],
      getProject
    );

    expect(groups).toEqual([
      {
        project: "AI/Agent",
        tasks: [task("A", "AI/Agent"), task("C", "AI/Agent")],
      },
      { project: "Writing/Story", tasks: [task("B", "Writing/Story")] },
    ]);
  });

  it("sorts projects like the project filter", () => {
    const groups = groupByProject(
      [
        task("A", "Development/ob-plugins/Hearth"),
        task("B", "Development/Vernify/Add"),
        task("C", "Audio/Music"),
      ],
      getProject
    );

    expect(groups.map((group) => group.project)).toEqual([
      "Audio/Music",
      "Development/Vernify/Add",
      "Development/ob-plugins/Hearth",
    ]);
  });

  it("puts tasks without a project last", () => {
    const groups = groupByProject(
      [task("A", NO_PROJECT), task("B", "Writing/Story")],
      getProject
    );

    expect(groups.map((group) => group.project)).toEqual([
      "Writing/Story",
      NO_PROJECT,
    ]);
  });
});
