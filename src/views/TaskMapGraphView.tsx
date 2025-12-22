import React, { useEffect, useCallback, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  NodeChange,
  Position,
} from "reactflow";
import { Notice, TFile, TFolder } from "obsidian";
import { useApp } from "src/hooks/hooks";
import { getAllTasks } from "src/lib/utils";
import { TaskFactory } from "src/lib/task-factory";
import { Task, TaskNode as TaskNodeType } from "src/types/task";
import GuiOverlay from "src/components/gui-overlay";
import TaskNode from "src/components/task-node";
import { NO_TAGS_VALUE } from "src/components/tag-select";
import { TaskMinimap } from "src/components/task-minimap";
import HashEdge from "src/components/hash-edge";
import { DeleteEdgeButton } from "src/components/delete-edge-button";
import { TagsContext } from "src/contexts/context";

import { TaskStatus } from "src/types/task";
import { TasksMapSettings, GraphData } from "src/types/settings";
import TasksMapPlugin from "src/main";

const ALL_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "canceled"];

interface TaskMapGraphViewProps {
  settings: TasksMapSettings;
  plugin: TasksMapPlugin;
}

export default function TaskMapGraphView({ settings, plugin }: TaskMapGraphViewProps) {
  const app = useApp();
  const vault = app.vault;
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = React.useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = React.useState<TaskStatus[]>([
    ...ALL_STATUSES,
  ]);
  const selectedEdgeRef = React.useRef<string | null>(null);
  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  const tasksRef = React.useRef(tasks);
  const vaultRef = React.useRef(vault);
  const reactFlowInstance = useReactFlow();
  
  // Persistence: track if this is initial load
  const isInitialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    selectedEdgeRef.current = selectedEdge;
  }, [selectedEdge]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    vaultRef.current = vault;
  }, [vault]);

  // Immediate save function - uses refs to get latest values
  const saveGraphDataImmediate = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    // Don't save if no nodes
    if (currentNodes.length === 0) return;
    
    const viewport = reactFlowInstance.getViewport();
    const graphData: GraphData = {
      nodes: currentNodes.map((n) => ({
        id: n.id,
        position: n.position,
        taskId: n.id,
        // Save complete task data for restoration
        taskData: n.data?.task ? {
          id: n.data.task.id,
          type: n.data.task.type,
          summary: n.data.task.summary,
          text: n.data.task.text,
          tags: n.data.task.tags,
          status: n.data.task.status,
          priority: n.data.task.priority,
          link: n.data.task.link,
          incomingLinks: n.data.task.incomingLinks,
          starred: n.data.task.starred,
          line: n.data.task.line,
        } : undefined,
      })),
      edges: currentEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    };
    console.log("[TasksMap] Saving graph data:", graphData.nodes.length, "nodes,", graphData.edges.length, "edges");
    plugin.saveGraphData(graphData);
  }, [plugin, reactFlowInstance]);

  // Debounced save function
  const saveGraphData = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveGraphDataImmediate();
    }, 200); // Reduced from 500ms to 200ms
  }, [saveGraphDataImmediate]);

  // Custom onNodesChange that also saves
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Save after position changes
      const hasPositionChange = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (hasPositionChange) {
        saveGraphData();
      }
    },
    [onNodesChange, saveGraphData]
  );

  useEffect(() => {
    isMountedRef.current = true;
    
    // Wait for a short moment to ensure vault is ready
    // Tasks may not be immediately available on vault open through the Dataview plugin
    const timeoutId = window.setTimeout(() => {
      loadInitialData();
    }, 1000);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(timeoutId);
      
      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Immediately save data when component unmounts (view switched/closed)
      console.log("[TasksMap] Component unmounting, saving data...");
      saveGraphDataImmediate();
    };
  }, [saveGraphDataImmediate]);

  // Maintain a live registry of tags per task for efficient allTags computation
  const [taskTagsRegistry, setTaskTagsRegistry] = React.useState<
    Map<string, string[]>
  >(new Map());

  const allTags = useMemo(() => {
    const tagFrequency = new Map<string, number>();
    taskTagsRegistry.forEach((tags) => {
      tags.forEach((tag) => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    });
    // Sort by frequency (descending), then alphabetically
    return Array.from(tagFrequency.keys()).sort((a, b) => {
      const freqDiff = (tagFrequency.get(b) || 0) - (tagFrequency.get(a) || 0);
      if (freqDiff !== 0) return freqDiff;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [taskTagsRegistry]);

  const getFilteredNodeIds = (
    tasks: Task[],
    selectedTags: string[],
    selectedStatuses: TaskStatus[]
  ) => {
    let filtered = tasks;
    if (selectedTags.length > 0) {
      filtered = filtered.filter((task) => {
        // Check if "No tags" is selected
        const noTagsSelected = selectedTags.includes(NO_TAGS_VALUE);
        // Check if regular tags are selected
        const regularTagsSelected = selectedTags.filter(
          (tag) => tag !== NO_TAGS_VALUE
        );

        // If "No tags" is selected and task has no tags
        const matchesNoTags = noTagsSelected && task.tags.length === 0;

        // If regular tags are selected and task has matching tags
        const matchesRegularTags =
          regularTagsSelected.length > 0 &&
          regularTagsSelected.some((tag) => task.tags.includes(tag));

        // Return true if either condition is met
        return matchesNoTags || matchesRegularTags;
      });
    }
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((task) =>
        selectedStatuses.includes(task.status)
      );
    }
    return filtered.map((task) => task.id);
  };

  // Load saved graph data
  const loadSavedData = useCallback(() => {
    const savedData = plugin.getGraphData();
    
    console.log("[TasksMap] Loading saved data:", savedData.nodes.length, "nodes,", savedData.edges.length, "edges");
    
    if (savedData.nodes.length === 0) {
      // No saved data - this is normal for first use
      return;
    }
    
    const isVertical = settings.layoutDirection === "Vertical";
    
    // Restore nodes from saved data
    const restoredNodes: TaskNodeType[] = savedData.nodes
      .filter((n) => n.taskData) // Only restore nodes with task data
      .map((savedNode) => ({
        id: savedNode.id,
        position: savedNode.position,
        data: {
          task: savedNode.taskData as Task,
          layoutDirection: settings.layoutDirection,
          showPriorities: settings.showPriorities,
          showTags: settings.showTags,
          debugVisualization: settings.debugVisualization,
          tagColorMode: settings.tagColorMode,
          tagColorSeed: settings.tagColorSeed,
          tagStaticColor: settings.tagStaticColor,
        },
        type: "task" as const,
        sourcePosition: isVertical ? Position.Bottom : Position.Right,
        targetPosition: isVertical ? Position.Top : Position.Left,
        draggable: true,
      }));
    
    // Restore edges
    const restoredEdges = savedData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "hash" as const,
      data: {
        hash: e.id,
        layoutDirection: settings.layoutDirection,
        debugVisualization: settings.debugVisualization,
      },
    }));
    
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    
    // Restore viewport
    if (savedData.viewport) {
      setTimeout(() => {
        reactFlowInstance.setViewport(savedData.viewport, { duration: 400 });
      }, 100);
    }
    
    new Notice(`Loaded ${restoredNodes.length} nodes`);
  }, [plugin, settings, reactFlowInstance, setNodes, setEdges]);

  // Load initial data from saved graph
  const loadInitialData = () => {
    const newTasks = getAllTasks(app);
    
    // Rebuild the tag registry
    const newRegistry = new Map<string, string[]>();
    newTasks.forEach((task) => {
      newRegistry.set(task.id, task.tags);
    });
    setTaskTagsRegistry(newRegistry);
    setTasks(newTasks);
    
    // Try to load saved data
    loadSavedData();
    
    isInitialLoadRef.current = false;
  };

  // Scan tasks directly from files (using path:line as ID)
  const scanTasksFromFiles = async (): Promise<Task[]> => {
    const tasksFolder = app.vault.getAbstractFileByPath("Spaces/2.Area/Tasks");
    if (!tasksFolder || !(tasksFolder instanceof TFolder)) {
      console.log("Tasks folder not found or not a folder");
      return [];
    }

    const allTasks: Task[] = [];
    const factory = new TaskFactory();

    const scanFolder = async (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
          const content = await app.vault.read(child);
          const lines = content.split("\n");

          // Parse tasks from content
          lines.forEach((line, index) => {
            const taskMatch = line.match(/^[\s]*- \[(.)\]/);
            if (taskMatch) {
              const rawTask = {
                status: taskMatch[1],
                text: line.replace(/^[\s]*- \[.\]\s*/, ""),
                link: { path: child.path },
              };
              const task = factory.parse(rawTask);
              // Use path:line as stable ID
              task.id = `${child.path}:${index}`;
              allTasks.push(task);
            }
          });
        } else if (child instanceof TFolder) {
          await scanFolder(child);
        }
      }
    };

    await scanFolder(tasksFolder);
    console.log("Scanned tasks:", allTasks.length, allTasks.map(t => t.id));
    return allTasks;
  };

  // Update nodes - only updates content, doesn't change positions or add new nodes
  const updateNodes = async () => {
    // Scan tasks directly from files (path:line ID format)
    const scannedTasks = await scanTasksFromFiles();
    
    console.log("Update nodes - scanned tasks:", scannedTasks.length);
    console.log("Update nodes - current nodes:", nodes.length, nodes.map(n => n.id));
    
    // Rebuild the tag registry
    const newRegistry = new Map<string, string[]>();
    scannedTasks.forEach((task) => {
      newRegistry.set(task.id, task.tags);
    });
    setTaskTagsRegistry(newRegistry);
    
    // Update tasks state
    setTasks(scannedTasks);
    
    // Update existing nodes with new task data, preserving positions
    // Matching by node.id (which is path:line format)
    setNodes((currentNodes) => {
      console.log("setNodes - currentNodes:", currentNodes.length);
      return currentNodes.map((node) => {
        const nodeTask = node.data?.task;
        if (!nodeTask) return node;
        
        // Direct match by node ID (path:line format)
        const updatedTask = scannedTasks.find((t) => t.id === node.id);
        
        console.log("Matching node:", node.id, "found:", !!updatedTask);
        
        if (updatedTask) {
          return {
            ...node,
            data: {
              ...node.data,
              task: updatedTask,
            },
          };
        }
        
        // Keep node unchanged if no match found
        return node;
      });
    });
    
    // Save after update
    setTimeout(() => saveGraphData(), 100);
    
    new Notice("Nodes updated");
  };

  // Add a task to canvas (called from sidebar drag-drop)
  const addTaskToCanvas = useCallback(
    (taskId: string, position: { x: number; y: number }, taskData?: unknown) => {
      // Try to find task from tasks array first, fall back to provided taskData
      const task = tasks.find((t) => t.id === taskId) || (taskData as Task | undefined);
      if (!task) {
        new Notice("Task not found");
        return;
      }
      
      // Check if already on canvas
      if (nodes.some((n) => n.id === task.id)) {
        new Notice("Task already on canvas");
        return;
      }
      
      const isVertical = settings.layoutDirection === "Vertical";
      const newNode: TaskNodeType = {
        id: task.id,
        position,
        data: {
          task,
          layoutDirection: settings.layoutDirection,
          showPriorities: settings.showPriorities,
          showTags: settings.showTags,
          debugVisualization: settings.debugVisualization,
          tagColorMode: settings.tagColorMode,
          tagColorSeed: settings.tagColorSeed,
          tagStaticColor: settings.tagStaticColor,
        },
        type: "task" as const,
        sourcePosition: isVertical ? Position.Bottom : Position.Right,
        targetPosition: isVertical ? Position.Top : Position.Left,
        draggable: true,
      };
      
      setNodes((nds) => [...nds, newNode]);
      
      // Save after adding
      setTimeout(() => saveGraphData(), 100);
      new Notice("Task added to canvas");
    },
    [tasks, nodes, settings, saveGraphData]
  );

  // Get IDs of tasks currently on canvas (use ref to avoid stale closure)
  const getCanvasTaskIds = useCallback(() => {
    return nodesRef.current.map((n) => n.id);
  }, []);

  // Register canvas operations with plugin for sidebar access
  useEffect(() => {
    plugin.registerCanvasOperations(addTaskToCanvas, getCanvasTaskIds);
    
    // Register auto-refresh callback
    plugin.registerCanvasRefresh(() => {
      console.log("[TasksMap Canvas] Auto-refresh triggered");
      updateNodes();
    });
    
    return () => {
      plugin.unregisterCanvasOperations();
      plugin.unregisterCanvasRefresh();
    };
  }, [plugin, addTaskToCanvas, getCanvasTaskIds]);

  // Drag and drop from sidebar
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/tasks-map-task")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const data = e.dataTransfer.getData("application/tasks-map-task");
      if (!data) return;
      
      try {
        const { task } = JSON.parse(data);
        // Convert screen position to flow position
        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        addTaskToCanvas(task.id, position, task);
      } catch (err) {
        console.error("Failed to parse task drop data:", err);
      }
    },
    [reactFlowInstance, addTaskToCanvas]
  );

  const updateTaskTags = useCallback((taskId: string, newTags: string[]) => {
    setTaskTagsRegistry((prevRegistry) => {
      const newRegistry = new Map(prevRegistry);
      newRegistry.set(taskId, newTags);
      return newRegistry;
    });
  }, []);

  useEffect(() => {
    // Skip if no tasks or no nodes
    if (tasks.length === 0 || nodes.length === 0) return;
    
    // Only apply filters if there are active tag/status filters
    const hasTagFilter = selectedTags.length > 0;
    const hasStatusFilter = selectedStatuses.length < 4; // less than all statuses
    
    if (!hasTagFilter && !hasStatusFilter) {
      // No filters active, ensure all nodes are visible
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          hidden: false,
        }))
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          hidden: false,
        }))
      );
      return;
    }
    
    // Apply filters - but only to nodes whose tasks are in the tasks array
    // Nodes added from sidebar (with different ID format) should stay visible
    const filteredNodeIds = getFilteredNodeIds(
      tasks,
      selectedTags,
      selectedStatuses
    );
    const taskIds = new Set(tasks.map((t) => t.id));
    
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        // If node's task is not in tasks array (sidebar-added), keep visible
        if (!taskIds.has(node.id)) {
          // Check if node's task data passes filters
          const nodeTask = node.data?.task;
          if (nodeTask) {
            const passesStatusFilter = !hasStatusFilter || selectedStatuses.includes(nodeTask.status);
            const passesTagFilter = !hasTagFilter || 
              (selectedTags.includes(NO_TAGS_VALUE) && nodeTask.tags.length === 0) ||
              selectedTags.some((tag) => tag !== NO_TAGS_VALUE && nodeTask.tags.includes(tag));
            return { ...node, hidden: !(passesStatusFilter && passesTagFilter) };
          }
          return { ...node, hidden: false };
        }
        return { ...node, hidden: !filteredNodeIds.includes(node.id) };
      })
    );
    
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        hidden:
          !filteredNodeIds.includes(edge.source) ||
          !filteredNodeIds.includes(edge.target),
      }))
    );
  }, [tasks, selectedTags, selectedStatuses, nodes.length]);

  const nodeTypes = useMemo(() => ({ task: TaskNode }), []);
  const edgeTypes = useMemo(() => ({ hash: HashEdge }), []);

  const onEdgeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any, edge: any) => {
      event.stopPropagation();
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge]
  );

  const onNodeClick = useCallback(() => {
    setSelectedEdge(null);
  }, [setSelectedEdge]);

  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setContextMenu(null);
  }, [setSelectedEdge]);

  // Context menu state for right-click delete
  const [contextMenu, setContextMenu] = React.useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setContextMenu(null);
      setTimeout(() => saveGraphData(), 100);
      new Notice("Node deleted");
    },
    [setNodes, setEdges, saveGraphData]
  );

  const onDeleteSelectedEdge = useCallback(async () => {
    if (!selectedEdge) return;

    // Simply delete the edge from canvas and save to data.json
    // No need to modify source files
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge));
    setSelectedEdge(null);
    setTimeout(() => saveGraphData(), 100);
    new Notice("Edge deleted");
  }, [selectedEdge, setEdges, saveGraphData]);

  const onConnect = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      // Get tasks from nodes instead of tasks array (works for sidebar-added nodes)
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      
      const sourceTask = sourceNode?.data?.task || tasks.find((t) => t.id === params.source);
      const targetTask = targetNode?.data?.task || tasks.find((t) => t.id === params.target);

      if (!sourceTask || !targetTask) {
        new Notice("Cannot connect: task data not found");
        return;
      }

      // Create edge without modifying source files
      // Connection is only stored in data.json
      const edgeId = `${params.source}-${params.target}`;
      
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: edgeId,
            type: "hash",
            data: {
              hash: edgeId,
              layoutDirection: settings.layoutDirection,
              debugVisualization: settings.debugVisualization,
            },
          },
          eds
        )
      );
      
      // Save edges after connecting
      setTimeout(() => saveGraphData(), 100);
      new Notice("Connected (saved to data.json only)");
    },
    [
      nodes,
      tasks,
      setEdges,
      settings.layoutDirection,
      settings.debugVisualization,
      saveGraphData,
    ]
  );

  const tagsContextValue = useMemo(
    () => ({
      allTags,
      updateTaskTags,
    }),
    [allTags, updateTaskTags]
  );

  return (
    <TagsContext.Provider value={tagsContextValue}>
      <div
        className={`tasks-map-graph-container ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          fitView
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
        >
          <GuiOverlay
            allTags={allTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            reloadTasks={updateNodes}
            loadSavedData={loadSavedData}
            allStatuses={ALL_STATUSES}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
          />
          <TaskMinimap />
          <Background />
        </ReactFlow>
        {selectedEdge && <DeleteEdgeButton onDelete={onDeleteSelectedEdge} />}
        {contextMenu && ReactDOM.createPortal(
          <div
            className="tasks-map-context-menu"
            ref={(el) => {
              if (el) {
                el.style.left = `${contextMenu.x}px`;
                el.style.top = `${contextMenu.y}px`;
              }
            }}
          >
            <button
              className="tasks-map-context-menu-item"
              onClick={() => deleteNode(contextMenu.nodeId)}
            >
              🗑️ Delete Node
            </button>
          </div>,
          document.body
        )}
      </div>
    </TagsContext.Provider>
  );
}
