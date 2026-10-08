import { ItemView, WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import TasksMapPlugin from "../main";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Task } from "../types/task";
import { TaskFactory } from "../lib/task-factory";
import { getStatusLabel, getTaskStatusConfig } from "../lib/task-status";
import { TaskStatusIcon } from "../components/task-status-icon";
import { ChevronRight } from "lucide-react";
import { localize } from "../lib/i18n";
import { groupByProject, NO_PROJECT } from "../lib/project-groups";

export const SIDEBAR_VIEW_TYPE = "tasks-map-sidebar";

interface TaskCardProps {
  task: Task;
  isOnCanvas: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onOpenFile: (task: Task) => void;
}

function TaskCard({ task, isOnCanvas, onDragStart, onOpenFile }: TaskCardProps) {
  return (
    <div
      className={`tasks-map-sidebar-card tasks-map-sidebar-card--${task.status} ${isOnCanvas ? "on-canvas" : ""}`}
      draggable={!isOnCanvas}
      onDragStart={(e) => !isOnCanvas && onDragStart(e, task)}
    >
      <div className="tasks-map-sidebar-card-header">
        <span
          className="tasks-map-sidebar-card-status"
          aria-label={getStatusLabel(task.status)}
        >
          <TaskStatusIcon status={task.status} />
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

// The project of a task comes from the frontmatter of its note
const getProject = (task: Task) =>
  (task as Task & { project?: string }).project ?? NO_PROJECT;

function SidebarContent({ plugin }: SidebarContentProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  // Kept in data.json for the next time the sidebar opens
  const [hideOnCanvas, setHideOnCanvas] = useState(
    plugin.sidebarState.hideOnCanvas
  );
  const [collapsedProjects, setCollapsedProjects] = useState(
    () => new Set(plugin.sidebarState.collapsedProjects)
  );
  // Read right away, so hidden tasks don't show until the first refresh
  const [canvasTaskIds, setCanvasTaskIds] = useState<string[]>(() =>
    plugin.getCanvasTaskIds()
  );

  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Scan tasks from folder (useCallback for stable reference)
  const scanTasks = useCallback(async () => {
    const tasksFolder = plugin.app.vault.getAbstractFileByPath("Spaces/2.Area/Tasks");
    if (!tasksFolder || !(tasksFolder instanceof TFolder)) return;

    const allTasks: Task[] = [];
    const factory = new TaskFactory(getTaskStatusConfig(plugin.app));

    const scanFolder = async (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
          const cache = plugin.app.metadataCache.getFileCache(child);
          const content = await plugin.app.vault.read(child);
          const lines = content.split("\n");
          
          // Get project from frontmatter
          const project = String(
            cache?.frontmatter?.Project || cache?.frontmatter?.project || NO_PROJECT
          );

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
      scanTasks();
    });
    
    // Refresh canvas task IDs periodically, re-rendering only on changes
    const interval = setInterval(() => {
      const ids = plugin.getCanvasTaskIds();
      setCanvasTaskIds((prev) =>
        prev.length === ids.length && prev.every((id, i) => id === ids[i])
          ? prev
          : ids
      );
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      plugin.unregisterSidebarRefresh();
    };
  }, [plugin, scanTasks]);

  // Archived tasks are hidden, as TaskGenius hides them
  const visibleTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks]
  );

  // Like in TaskGenius, a project shows while it has tasks that show
  const projects = useMemo(
    () => [
      "all",
      ...Array.from(new Set(visibleTasks.map(getProject)))
        .filter((project) => project !== NO_PROJECT)
        .sort(),
    ],
    [visibleTasks]
  );

  // The project picked goes away once its last task is archived. Set while
  // rendering, so React renders again right away, before showing an empty list.
  if (!projects.includes(selectedProject)) setSelectedProject("all");

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = visibleTasks;

    if (selectedProject !== "all") {
      filtered = filtered.filter((t) => getProject(t) === selectedProject);
    }

    if (hideOnCanvas) {
      filtered = filtered.filter((t) => !canvasTaskIds.includes(t.id));
    }

    return filtered;
  }, [visibleTasks, selectedProject, hideOnCanvas, canvasTaskIds]);

  // With all projects shown, each project gets a group
  const projectGroups = useMemo(
    () =>
      selectedProject === "all"
        ? groupByProject(filteredTasks, getProject)
        : null,
    [filteredTasks, selectedProject]
  );

  const changeHideOnCanvas = (hide: boolean) => {
    setHideOnCanvas(hide);
    plugin.saveSidebarState({ hideOnCanvas: hide });
  };

  const toggleProject = (project: string) => {
    // The plugin holds the latest state, even before this re-renders
    const collapsed = new Set(plugin.sidebarState.collapsedProjects);
    if (collapsed.has(project)) collapsed.delete(project);
    else collapsed.add(project);
    setCollapsedProjects(collapsed);
    plugin.saveSidebarState({ collapsedProjects: Array.from(collapsed) });
  };

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

  const renderTaskCard = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      isOnCanvas={canvasTaskIds.includes(task.id)}
      onDragStart={handleDragStart}
      onOpenFile={handleOpenFile}
    />
  );

  return (
    <div className="tasks-map-sidebar">
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
            onChange={(e) => changeHideOnCanvas(e.target.checked)}
          />
          <span>Hide on canvas</span>
        </label>
      </div>

      <div className="tasks-map-sidebar-list">
        {filteredTasks.length === 0 ? (
          <div className="tasks-map-sidebar-empty">No tasks found</div>
        ) : projectGroups ? (
          projectGroups.map(({ project, tasks: groupTasks }) => {
            const collapsed = collapsedProjects.has(project);
            return (
              <div
                key={project}
                className={`tasks-map-sidebar-group ${collapsed ? "is-collapsed" : ""}`}
              >
                <button
                  className="tasks-map-sidebar-group-header"
                  onClick={() => toggleProject(project)}
                  aria-expanded={!collapsed}
                >
                  <ChevronRight size={14} className="tasks-map-sidebar-group-icon" />
                  <span className="tasks-map-sidebar-group-name">
                    {project === NO_PROJECT
                      ? localize({ en: "No project", zh: "无项目" })
                      : project}
                  </span>
                  <span className="tasks-map-sidebar-group-count">
                    {groupTasks.length}
                  </span>
                </button>
                {!collapsed && groupTasks.map(renderTaskCard)}
              </div>
            );
          })
        ) : (
          filteredTasks.map(renderTaskCard)
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

