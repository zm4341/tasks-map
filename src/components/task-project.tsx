import React from "react";
import { Folder } from "lucide-react";

/** The project a task belongs to, e.g. "Development › Vernify › Enhance" */
export function TaskProject({ path }: { path: string }) {
  const segments = path.split("/").filter(Boolean);

  return (
    <div className="tasks-map-task-project">
      <span className="tasks-map-task-project-icon">
        <Folder size={13} />
      </span>
      <span className="tasks-map-task-project-path">
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="tasks-map-task-project-separator">›</span>
            )}
            <span className="tasks-map-task-project-segment">{segment}</span>
          </React.Fragment>
        ))}
      </span>
    </div>
  );
}
