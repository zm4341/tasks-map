import React, { useEffect, useCallback, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  Node,
  NodeChange,
  Position,
  ConnectionMode,
  Connection,
  Panel,
} from "reactflow";
import { Maximize } from "lucide-react";
import { Notice, TFile, TFolder } from "obsidian";
import { useApp } from "src/hooks/hooks";
import { getAllTasks } from "src/lib/utils";
import { TaskFactory } from "src/lib/task-factory";
import { ALL_TASK_STATUSES, getTaskStatusConfig } from "src/lib/task-status";
import { localize } from "src/lib/i18n";
import { Task, TaskNode as TaskNodeType } from "src/types/task";
import GuiOverlay from "src/components/gui-overlay";
import TaskNode from "src/components/task-node";
import { NO_TAGS_VALUE } from "src/components/tag-select";
import HashEdge from "src/components/hash-edge";
import { DeleteEdgeButton } from "src/components/delete-edge-button";
import { CanvasTabs } from "src/components/canvas-tabs";
import { AlignmentGuides } from "src/components/alignment-guides";
import {
  alignBox,
  AlignmentGuide,
  Box,
  boxesOverlap,
} from "src/lib/alignment";
import { TagsContext } from "src/contexts/context";

import { TaskStatus } from "src/types/task";
import { TasksMapSettings, GraphData } from "src/types/settings";
import TasksMapPlugin from "src/main";

// How close, in screen pixels, a dragged node snaps into line
const SNAP_DISTANCE = 8;

// The box of a node, once React Flow has measured it
function getNodeBox(node: Node): Box | null {
  if (!node.width || !node.height) return null;
  return { ...node.position, width: node.width, height: node.height };
}

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
    ...ALL_TASK_STATUSES,
  ]);
  const selectedEdgeRef = React.useRef<string | null>(null);
  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  const tasksRef = React.useRef(tasks);
  const vaultRef = React.useRef(vault);
  const reactFlowInstance = useReactFlow();
  const store = useStoreApi();

  // The canvases of the map and the one shown
  const [canvasList, setCanvasList] = React.useState(() =>
    plugin.getCanvasList()
  );
  const [canvasId, setCanvasId] = React.useState(
    () => plugin.getActiveCanvas().id
  );
  const canvasIdRef = useRef(canvasId);
  
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
    // Skip if initial load hasn't completed yet (prevents saving empty state on mount)
    if (isInitialLoadRef.current) return;
    
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
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
          statusMark: n.data.task.statusMark,
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
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    };
    console.log("[TasksMap] Saving graph data:", graphData.nodes.length, "nodes,", graphData.edges.length, "edges");
    plugin.saveCanvasGraph(canvasIdRef.current, graphData);
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

  // Save right away what the debounced save would save later
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveGraphDataImmediate();
  }, [saveGraphDataImmediate]);

  // Where the node being dragged lines up with other nodes
  const [alignmentGuides, setAlignmentGuides] = React.useState<
    AlignmentGuide[]
  >([]);

  // Snap a dragged node into line with the nodes on screen
  const alignDraggedNode = useCallback(
    (changes: NodeChange[]): NodeChange[] => {
      const change = changes.length === 1 ? changes[0] : undefined;
      if (
        change?.type !== "position" ||
        !change.dragging ||
        !change.position
      ) {
        setAlignmentGuides((guides) => (guides.length > 0 ? [] : guides));
        return changes;
      }

      const node = nodesRef.current.find((n) => n.id === change.id);
      const box = node && getNodeBox({ ...node, position: change.position });
      if (!box) return changes;

      // Lining up with nodes out of sight would look random
      const { transform, width, height } = store.getState();
      const [x, y, zoom] = transform;
      const screen = {
        x: -x / zoom,
        y: -y / zoom,
        width: width / zoom,
        height: height / zoom,
      };
      const others = nodesRef.current
        .filter((n) => n.id !== change.id && !n.hidden)
        .map(getNodeBox)
        .filter((b): b is Box => b !== null && boxesOverlap(b, screen));

      const alignment = alignBox(box, others, SNAP_DISTANCE / zoom);
      setAlignmentGuides(alignment.guides);
      const offsetX = alignment.x - box.x;
      const offsetY = alignment.y - box.y;
      return [
        {
          ...change,
          position: { x: alignment.x, y: alignment.y },
          positionAbsolute: change.positionAbsolute && {
            x: change.positionAbsolute.x + offsetX,
            y: change.positionAbsolute.y + offsetY,
          },
        },
      ];
    },
    [store]
  );

  // Custom onNodesChange that also saves
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(alignDraggedNode(changes));
      // Save after position changes
      const hasPositionChange = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (hasPositionChange) {
        saveGraphData();
      }
    },
    [onNodesChange, alignDraggedNode, saveGraphData]
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

  // Load the saved graph of the canvas shown
  const loadSavedData = useCallback((silent = false) => {
    const savedData = plugin.getCanvas(canvasIdRef.current);
    if (!savedData) return;
    
    console.log("[TasksMap] Loading saved data:", savedData.nodes.length, "nodes,", savedData.edges.length, "edges");
    
    const isVertical = settings.layoutDirection === "Vertical";

    // Tasks scanned since the canvas was saved are more recent
    const scannedTasks = new Map(tasksRef.current.map((t) => [t.id, t]));
    
    // Restore nodes from saved data
    const restoredNodes: TaskNodeType[] = savedData.nodes
      .filter((n) => n.taskData) // Only restore nodes with task data
      .map((savedNode) => ({
        id: savedNode.id,
        position: savedNode.position,
        data: {
          task: scannedTasks.get(savedNode.id) ?? (savedNode.taskData as Task),
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
    
    // Restore edges. Edges saved before nodes had a handle on every side
    // connect the sides the layout direction used.
    const restoredEdges = savedData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle:
        e.sourceHandle ?? (isVertical ? Position.Bottom : Position.Right),
      targetHandle: e.targetHandle ?? (isVertical ? Position.Top : Position.Left),
      type: "hash" as const,
      data: {
        hash: e.id,
        layoutDirection: settings.layoutDirection,
        debugVisualization: settings.debugVisualization,
      },
    }));
    
    // Saves read the refs, which must not hold the previous canvas meanwhile
    nodesRef.current = restoredNodes;
    edgesRef.current = restoredEdges;
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    reactFlowInstance.setViewport(savedData.viewport);
    
    if (!silent && restoredNodes.length > 0) {
      new Notice(`Loaded ${restoredNodes.length} nodes`);
    }
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

    // The saved task data may be outdated, e.g. statuses changed since
    updateNodes(true);
  };

  // Scan tasks directly from files (using path:line as ID)
  const scanTasksFromFiles = async (): Promise<Task[]> => {
    const tasksFolder = app.vault.getAbstractFileByPath("Spaces/2.Area/Tasks");
    if (!tasksFolder || !(tasksFolder instanceof TFolder)) {
      console.log("Tasks folder not found or not a folder");
      return [];
    }

    const allTasks: Task[] = [];
    const factory = new TaskFactory(getTaskStatusConfig(app));

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
  const updateNodes = async (silent = false) => {
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

    if (!silent) new Notice("Nodes updated");
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

  // Clear all nodes from the canvas shown and save it
  const clearCanvasNodes = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    nodesRef.current = [];
    edgesRef.current = [];
    setNodes([]);
    setEdges([]);
    plugin.saveCanvasGraph(canvasIdRef.current, {
      nodes: [],
      edges: [],
      viewport: reactFlowInstance.getViewport(),
    });
    console.log("[TasksMap Canvas] Canvas cleared");
  }, [plugin, reactFlowInstance, setNodes, setEdges]);

  // Register canvas operations with plugin for sidebar access
  useEffect(() => {
    plugin.registerCanvasOperations(addTaskToCanvas, getCanvasTaskIds, clearCanvasNodes);
    
    // Register auto-refresh callback
    plugin.registerCanvasRefresh(() => {
      console.log("[TasksMap Canvas] Auto-refresh triggered");
      updateNodes();
    });
    
    return () => {
      plugin.unregisterCanvasOperations();
      plugin.unregisterCanvasRefresh();
    };
  }, [plugin, addTaskToCanvas, getCanvasTaskIds, clearCanvasNodes]);

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
    const hasStatusFilter = selectedStatuses.length < ALL_TASK_STATUSES.length;
    
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
    async (params: Connection) => {
      const { source, target } = params;
      if (!source || !target) return;

      // Get tasks from nodes instead of tasks array (works for sidebar-added nodes)
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      const sourceTask = sourceNode?.data?.task || tasks.find((t) => t.id === source);
      const targetTask = targetNode?.data?.task || tasks.find((t) => t.id === target);

      if (!sourceTask || !targetTask) {
        new Notice("Cannot connect: task data not found");
        return;
      }

      // Create edge without modifying source files
      // Connection is only stored in data.json
      const edgeId = `${source}-${target}`;
      const newEdge = {
        id: edgeId,
        source,
        target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: "hash",
        data: {
          hash: edgeId,
          layoutDirection: settings.layoutDirection,
          debugVisualization: settings.debugVisualization,
        },
      };

      // Connecting the same two tasks again moves the edge to the new sides
      setEdges((eds) => [...eds.filter((e) => e.id !== edgeId), newEdge]);

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

  // A node can't be connected to itself
  const isValidConnection = useCallback(
    (connection: Connection) => connection.source !== connection.target,
    []
  );

  // While dragging an edge, every node shows its handles
  const [isConnecting, setIsConnecting] = React.useState(false);
  const onConnectStart = useCallback(() => setIsConnecting(true), []);
  const onConnectEnd = useCallback(() => setIsConnecting(false), []);

  // Zoom so that all visible nodes fit, centered on them
  const fitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, maxZoom: 1, duration: 300 });
  }, [reactFlowInstance]);

  // Show another canvas, after saving the one shown
  const switchCanvas = (id: string) => {
    if (id === canvasIdRef.current) return;
    flushSave();
    canvasIdRef.current = id;
    setCanvasId(id);
    setSelectedEdge(null);
    setContextMenu(null);
    plugin.setActiveCanvas(id);
    loadSavedData(true);
  };

  const addCanvas = () => {
    switchCanvas(plugin.addCanvas().id);
  };

  const deleteCanvas = (id: string) => {
    const canvas = plugin.getCanvas(id);
    if (!canvas || canvasList.length === 1) return;

    const nodeCount =
      id === canvasIdRef.current ? nodesRef.current.length : canvas.nodes.length;
    const confirmed =
      nodeCount === 0 ||
      confirm(
        localize({
          en: `Delete the canvas "${canvas.name}" with its ${nodeCount} nodes? The tasks themselves stay.`,
          zh: `确定要删除画布「${canvas.name}」吗？画布上的 ${nodeCount} 个节点和连线会一起删除，任务本身不受影响。`,
        })
      );
    if (!confirmed) return;

    if (id === canvasIdRef.current) {
      const index = canvasList.findIndex((c) => c.id === id);
      switchCanvas((canvasList[index + 1] ?? canvasList[index - 1]).id);
    }
    plugin.deleteCanvas(id);
  };

  // Canvases are added, renamed and deleted in any open map view
  useEffect(
    () =>
      plugin.subscribeCanvasList(() => setCanvasList(plugin.getCanvasList())),
    [plugin]
  );

  // Another map view deleted the canvas this one shows
  useEffect(() => {
    if (!canvasList.some((canvas) => canvas.id === canvasIdRef.current)) {
      switchCanvas(plugin.getActiveCanvas().id);
    }
  }, [canvasList]);

  const tagsContextValue = useMemo(
    () => ({
      allTags,
      updateTaskTags,
    }),
    [allTags, updateTaskTags]
  );

  const containerClassName = [
    "tasks-map-graph-container",
    isDragOver && "drag-over",
    isConnecting && "is-connecting",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TagsContext.Provider value={tagsContextValue}>
      <div
        className={containerClassName}
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
          connectionMode={ConnectionMode.Loose}
          isValidConnection={isValidConnection}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
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
            allStatuses={ALL_TASK_STATUSES}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
          />
          <AlignmentGuides guides={alignmentGuides} />
          <CanvasTabs
            canvases={canvasList}
            activeCanvasId={canvasId}
            onSelect={switchCanvas}
            onAdd={addCanvas}
            onRename={(id, name) => plugin.renameCanvas(id, name)}
            onDelete={deleteCanvas}
          />
          <Panel position="bottom-right" className="tasks-map-canvas-controls">
            <button
              className="clickable-icon tasks-map-canvas-control"
              onClick={fitView}
              aria-label={localize({ en: "Fit view", zh: "适应画布" })}
            >
              <Maximize size={16} />
            </button>
          </Panel>
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
