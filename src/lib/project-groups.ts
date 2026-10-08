// The project of tasks in notes without one
export const NO_PROJECT = "none";

export interface ProjectGroup<T> {
  project: string;
  tasks: T[];
}

/**
 * Groups tasks by project, sorted like the project filter, with the tasks
 * without a project last. Tasks keep their order within a group.
 */
export function groupByProject<T>(
  tasks: T[],
  getProject: (task: T) => string // eslint-disable-line no-unused-vars
): ProjectGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const task of tasks) {
    const project = getProject(task);
    const group = groups.get(project);
    if (group) group.push(task);
    else groups.set(project, [task]);
  }

  const rank = (project: string) => (project === NO_PROJECT ? 1 : 0);
  return Array.from(groups, ([project, groupTasks]) => ({
    project,
    tasks: groupTasks,
  })).sort(
    (a, b) =>
      rank(a.project) - rank(b.project) ||
      (a.project < b.project ? -1 : a.project > b.project ? 1 : 0)
  );
}
