import { ItemView, WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import TasksMapPlugin from "../main";
import React, { useState, useEffect, useMemo } from "react";
import { Task } from "../types/task";
import { TaskFactory } from "../lib/task-factory";

export const SIDEBAR_VIEW_TYPE = "tasks-map-sidebar";

interface TaskCardProps {
  task: Task;
  isOnCanvas: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
}

function TaskCard({ task, isOnCanvas, onDragStart }: TaskCardProps) {
  const statusIcon = {
    todo: "○",
    in_progress: "◐",
    done: "●",
    canceled: "✕",
  }[task.status];

  const statusColor = {
    todo: "var(--text-muted)",
    in_progress: "var(--text-accent)",
    done: "var(--text-success)",
    canceled: "var(--text-error)",
  }[task.status];

  return (
    <div
      className={`tasks-map-sidebar-card ${isOnCanvas ? "on-canvas" : ""}`}
      draggable={!isOnCanvas}
      onDragStart={(e) => !isOnCanvas && onDragStart(e, task)}
    >
      <div className="tasks-map-sidebar-card-header">
        <span className="tasks-map-sidebar-card-status" style={{ color: statusColor }}>
          {statusIcon}
        </span>
        <span className="tasks-map-sidebar-card-title">{task.summary || task.text}</span>
        {isOnCanvas && <span className="tasks-map-sidebar-card-badge">✓</span>}
      </div>
      {task.tags.length > 0 && (
        <div className="tasks-map-sidebar-card-tags">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tasks-map-sidebar-card-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarContentProps {
  plugin: TasksMapPlugin;
}

function SidebarContent({ plugin }: SidebarContentProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [hideOnCanvas, setHideOnCanvas] = useState(false);
  const [canvasTaskIds, setCanvasTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Scan tasks from folder
  const scanTasks = async () => {
    setIsLoading(true);
      const tasksFolder = plugin.app.vault.getAbstractFileByPath("Spaces/2.Area/Tasks");
      if (!tasksFolder || !(tasksFolder instanceof TFolder)) {
        return;
      }

      const allTasks: Task[] = [];
      const projectSet = new Set<string>();
      const factory = new TaskFactory();

      const scanFolder = async (folder: TFolder) => {
        for (const child of folder.children) {
          if (child instanceof TFile && child.extension === "md") {
            const cache = plugin.app.metadataCache.getFileCache(child);
            const content = await plugin.app.vault.read(child);
            const lines = content.split("\n");
            
            // Get project from frontmatter
            const project = cache?.frontmatter?.Project || cache?.frontmatter?.project || "none";
            if (project !== "none") {
              projectSet.add(project);
            }

            // Parse dataview tasks from content
            lines.forEach((line, index) => {
              const taskMatch = line.match(/^[\s]*- \[(.)\]/);
              if (taskMatch) {
                const rawTask = {
                  status: taskMatch[1],
                  text: line.replace(/^[\s]*- \[.\]\s*/, ""),
                  link: { path: child.path },
                  line: index,
                };
                const task = factory.parse(rawTask);
                // Add project info and line number for stable ID
                (task as Task & { project?: string; line?: number }).project = project;
                (task as Task & { line?: number }).line = index;
                
                // Generate stable ID using file path and line number
                if (!task.id || task.id.length === 6) {
                  // If ID is random (6 chars), use path+line for stability
                  task.id = `${child.path}:${index}`;
                }
                
                allTasks.push(task);
              }
            });
          } else if (child instanceof TFolder) {
            await scanFolder(child);
          }
        }
      };

      await scanFolder(tasksFolder);
      setTasks(allTasks);
      setProjects(["all", ...Array.from(projectSet).sort()]);
      setIsLoading(false);
      
      // Register tasks with plugin so canvas can use them for updates
      plugin.setSidebarTasks(allTasks);
  };

  // Initial scan
  useEffect(() => {
    scanTasks();
    
    // Refresh canvas task IDs periodically
    const interval = setInterval(() => {
      setCanvasTaskIds(plugin.getCanvasTaskIds());
    }, 1000);

    return () => clearInterval(interval);
  }, [plugin]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (selectedProject !== "all") {
      filtered = filtered.filter((t) => (t as Task & { project?: string }).project === selectedProject);
    }
    
    if (hideOnCanvas) {
      filtered = filtered.filter((t) => !canvasTaskIds.includes(t.id));
    }
    
    return filtered;
  }, [tasks, selectedProject, hideOnCanvas, canvasTaskIds]);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData("application/tasks-map-task", JSON.stringify({
      task: task,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="tasks-map-sidebar">
      <div className="tasks-map-sidebar-header">
        <h4>Tasks</h4>
        <button
          className="tasks-map-sidebar-refresh-button"
          onClick={scanTasks}
          disabled={isLoading}
          title="Refresh tasks"
        >
          {isLoading ? "..." : "↻"}
        </button>
      </div>
      
      <div className="tasks-map-sidebar-filters">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="tasks-map-sidebar-select"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All Projects" : p}
            </option>
          ))}
        </select>
        
        <label className="tasks-map-sidebar-checkbox">
          <input
            type="checkbox"
            checked={hideOnCanvas}
            onChange={(e) => setHideOnCanvas(e.target.checked)}
          />
          <span>Hide on canvas</span>
        </label>
      </div>

      <div className="tasks-map-sidebar-list">
        {filteredTasks.length === 0 ? (
          <div className="tasks-map-sidebar-empty">No tasks found</div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isOnCanvas={canvasTaskIds.includes(task.id)}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default class TaskSidebarView extends ItemView {
  root: Root | null = null;
  plugin: TasksMapPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: TasksMapPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return SIDEBAR_VIEW_TYPE;
  }

  getDisplayText() {
    return "Tasks Sidebar";
  }

  getIcon() {
    return "list-todo";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.root.render(<SidebarContent plugin={this.plugin} />);
  }

  async onClose() {
    this.root?.unmount();
  }
}

