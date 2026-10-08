import React, { useRef } from "react";
import { App, getLinkpath, HoverParent, Keymap } from "obsidian";
import { contextLinkTarget, contextLinkText } from "src/lib/task-context";

// Page previews of the links in the map, "Tasks Map" in the settings of the
// Page preview core plugin
export const HOVER_LINK_SOURCE = "tasks-map";

interface TaskContextProps {
  app: App;
  context: string;
  // The note of the task, links resolve from it
  sourcePath: string;
}

/**
 * The context of a task, the way TaskGenius shows it: a name as it is, a note
 * as a link to it. Clicking the link opens the note, Mod+hover previews it.
 */
export function TaskContext({ app, context, sourcePath }: TaskContextProps) {
  // Obsidian keeps the page preview of the link here
  const hoverParent = useRef<HoverParent>({ hoverPopover: null }).current;

  const target = contextLinkTarget(context);
  if (!target) return <span className="tasks-map-context-name">{context}</span>;

  const resolved = app.metadataCache.getFirstLinkpathDest(
    getLinkpath(target),
    sourcePath
  );
  return (
    <a
      className={`internal-link tasks-map-context-link nodrag ${resolved ? "" : "is-unresolved"}`}
      href={target}
      data-href={target}
      draggable={false}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void app.workspace.openLinkText(
          target,
          sourcePath,
          Keymap.isModEvent(e.nativeEvent)
        );
      }}
      onMouseOver={(e) =>
        app.workspace.trigger("hover-link", {
          event: e.nativeEvent,
          source: HOVER_LINK_SOURCE,
          hoverParent,
          targetEl: e.currentTarget,
          linktext: target,
          sourcePath,
        })
      }
    >
      {contextLinkText(context)}
    </a>
  );
}
