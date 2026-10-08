import { App } from "obsidian";
import { TASK_GENIUS_PLUGIN_ID } from "./task-status";

const DEFAULT_PROJECT_TAG_PREFIX = "project";

/** The prefix of project tags in TaskGenius, "project" for #project/A/B */
export function getProjectTagPrefix(app: App): string {
  const plugins = (
    app as unknown as {
      plugins?: {
        plugins?: Record<
          string,
          { settings?: { projectTagPrefix?: { tasks?: string } } }
        >;
      };
    }
  ).plugins;
  return (
    plugins?.plugins?.[TASK_GENIUS_PLUGIN_ID]?.settings?.projectTagPrefix
      ?.tasks || DEFAULT_PROJECT_TAG_PREFIX
  );
}

/**
 * Separates the project tags of a task from its other tags. Projects are
 * returned without the prefix, e.g. "A/B" for the tag project/A/B.
 */
export function splitProjectTags(
  tags: string[],
  prefix: string
): { projects: string[]; tags: string[] } {
  const projectStart = `${prefix.toLowerCase()}/`;
  const projects: string[] = [];
  const otherTags: string[] = [];
  for (const tag of tags) {
    const name = tag.replace(/^#/, "");
    // Obsidian tags ignore case
    if (name.toLowerCase().startsWith(projectStart)) {
      const project = name.slice(projectStart.length);
      if (project) projects.push(project);
    } else {
      otherTags.push(tag);
    }
  }
  return { projects, tags: otherTags };
}
