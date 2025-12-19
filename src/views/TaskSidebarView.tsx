import { ItemView, WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import TasksMapPlugin from "../main";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Task } from "../types/task";
import { TaskFactory } from "../lib/task-factory";

export const SIDEBAR_VIEW_TYPE = "tasks-map-sidebar";

interface TaskCardProps {
  task: Task;
  isOnCanvas: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onOpenFile: (task: Task) => void;
}

function TaskCard({ task, isOnCanvas, onDragStart, onOpenFile }: TaskCardProps) {
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
        <button
          className="tasks-map-sidebar-card-open-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFile(task);
          }}
          title="Open file"
        >
          ↗
        </button>
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
  
  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Scan tasks from folder (useCallback for stable reference)
  const scanTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    const tasksFolder = plugin.app.vault.getAbstractFileByPath("Spaces/2.Area/Tasks");
    if (!tasksFolder || !(tasksFolder instanceof TFolder)) {
      if (showLoading) setIsLoading(false);
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
    
    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setTasks(allTasks);
      setProjects(["all", ...Array.from(projectSet).sort()]);
      if (showLoading) setIsLoading(false);
    }
    
    // Register tasks with plugin so canvas can use them for updates
    plugin.setSidebarTasks(allTasks);
  }, [plugin]);

  // Initial scan and register auto-refresh callback
  useEffect(() => {
    isMountedRef.current = true;
    scanTasks();
    
    // Register auto-refresh callback
    plugin.registerSidebarRefresh(() => {
      console.log("[TasksMap Sidebar] Auto-refresh triggered");
      scanTasks(false); // silent refresh (no loading indicator)
    });
    
    // Refresh canvas task IDs periodically
    const interval = setInterval(() => {
      setCanvasTaskIds(plugin.getCanvasTaskIds());
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      plugin.unregisterSidebarRefresh();
    };
  }, [plugin, scanTasks]);

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

  // Open task file in active leaf
  const handleOpenFile = useCallback(async (task: Task) => {
    // Extract file path from task ID (format: "path:line") or from task.link
    let filePath = "";
    let lineNumber = 0;
    
    if (task.id.includes(":")) {
      const parts = task.id.split(":");
      lineNumber = parseInt(parts.pop() || "0", 10);
      filePath = parts.join(":");
    } else if (task.link) {
      // task.link is a string (file path)
      filePath = task.link;
    }
    
    if (!filePath) return;
    
    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      // Open in active leaf (current window)
      const leaf = plugin.app.workspace.getLeaf(false);
      await leaf.openFile(file, { 
        eState: { line: lineNumber }
      });
    }
  }, [plugin]);

  return (
    <div className="tasks-map-sidebar">
      <div className="tasks-map-sidebar-header">
        <h4>Tasks</h4>
        <button
          className="tasks-map-sidebar-refresh-button"
          onClick={() => scanTasks(true)}
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
              onOpenFile={handleOpenFile}
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

