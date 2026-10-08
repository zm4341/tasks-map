import { Task } from "src/types/task";

// What a node knows of its task, shown or saved
interface NodeTask {
  id: string;
  type?: string;
  text: string;
  link: string;
}

/** Tasks scanned from the notes have "path:line" IDs */
export function parseTaskId(id: string): { path: string; line: number } | null {
  const match = /^(.+):(\d+)$/.exec(id);
  return match ? { path: match[1], line: Number(match[2]) } : null;
}

// The path of a note or folder once oldPath is renamed to newPath, null when
// the rename doesn't concern it
function renamePath(path: string, oldPath: string, newPath: string) {
  if (path === oldPath) return newPath;
  if (path.startsWith(`${oldPath}/`)) {
    return newPath + path.slice(oldPath.length);
  }
  return null;
}

/**
 * The task with the new path of its note, once the note or a folder it is in
 * was renamed or moved. Null when the task isn't in it.
 */
export function renameTask<T extends NodeTask>(
  task: T,
  oldPath: string,
  newPath: string
): T | null {
  const link = renamePath(task.link, oldPath, newPath);
  if (link === null) return null;
  const location = parseTaskId(task.id);
  const id =
    location?.path === task.link ? `${link}:${location.line}` : task.id;
  return { ...task, id, link };
}

// Note tasks are whole notes, not lines in them
const isLine = (task: NodeTask | undefined): task is NodeTask =>
  task !== undefined && task.type !== "note";

/**
 * Finds the task each node shows among the tasks scanned from the notes. The
 * ID of a task says where it is, so it changes when lines are added or
 * removed above the task. The task is then found by its text, in its note
 * first. A task goes to one node at most.
 */
export function relinkTasks(
  nodeTasks: Array<NodeTask | undefined>,
  scannedTasks: Task[]
): Array<Task | undefined> {
  // Tasks from Dataview have IDs that don't say where they are
  const candidates = scannedTasks.filter(
    (task) => parseTaskId(task.id)?.path === task.link
  );
  const found: Array<Task | undefined> = nodeTasks.map(() => undefined);
  const taken = new Set<Task>();

  // Each pass looks for the tasks the passes before didn't find
  const pass = (
    pick: (task: NodeTask, free: Task[]) => Task | undefined // eslint-disable-line no-unused-vars
  ) => {
    nodeTasks.forEach((task, i) => {
      if (!isLine(task) || found[i]) return;
      const match = pick(
        task,
        candidates.filter((c) => !taken.has(c))
      );
      if (!match) return;
      found[i] = match;
      taken.add(match);
    });
  };

  // Nothing changed
  pass((task, free) =>
    free.find((c) => c.id === task.id && c.text === task.text)
  );
  // Lines were added or removed above it
  pass((task, free) =>
    closest(
      task,
      free.filter((c) => c.link === task.link && c.text === task.text)
    )
  );
  // Its text was edited
  pass((task, free) => free.find((c) => c.id === task.id));
  // Its note holds one task, and no other node looks for a task in the note
  pass((task, free) => {
    const inNote = free.filter((c) => c.link === task.link);
    const looking = nodeTasks.filter(
      (t, j) => isLine(t) && t.link === task.link && !found[j]
    );
    return inNote.length === 1 && looking.length === 1 ? inNote[0] : undefined;
  });
  // It was cut and pasted into another note, or its note was moved while
  // Obsidian was closed
  pass((task, free) => {
    const sameText = free.filter((c) => c.text === task.text);
    return sameText.length === 1 ? sameText[0] : undefined;
  });

  return found;
}

// The task closest to the line the node's task was on
function closest(task: NodeTask, tasks: Task[]): Task | undefined {
  const line = parseTaskId(task.id)?.line ?? 0;
  const distance = (t: Task) => Math.abs((parseTaskId(t.id)?.line ?? 0) - line);
  return tasks.reduce<Task | undefined>(
    (best, t) => (!best || distance(t) < distance(best) ? t : best),
    undefined
  );
}
