import React, { useState, useContext, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Tag as TagIcon } from "lucide-react";
import { useApp } from "src/hooks/hooks";
import { Task } from "src/types/task";
import { NodeColor } from "src/lib/node-colors";
import { TaskDetails } from "./task-details";
import { ExpandButton } from "./expand-button";
import { LinkButton } from "./link-button";
import { StarButton } from "./star-button";
import { Tag } from "./tag";
import { TaskStatusToggle } from "./task-status";
import { TaskBackground } from "./task-background";
import { TaskPriority } from "./task-priority";
import { TaskProject } from "./task-project";
import { TagInput } from "./tag-input";
import { useSummaryRenderer } from "../hooks/use-summary-renderer";
import {
  removeTagFromTaskInVault,
  addTagToTaskInVault,
  addStarToTaskInVault,
  removeStarFromTaskInVault,
} from "../lib/utils";
import { TagsContext } from "../contexts/context";
import { getProjectTagPrefix, splitProjectTags } from "../lib/project-tags";

export const NODEWIDTH = 250;
export const NODEHEIGHT = 120;

// Edges can start and end on any side. The canvas uses the loose connection
// mode, in which source handles connect to each other.
const HANDLE_POSITIONS = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

interface TaskNodeData {
  task: Task;
  color?: NodeColor;
  layoutDirection?: "Horizontal" | "Vertical";
  showPriorities?: boolean;
  showTags?: boolean;
  debugVisualization?: boolean;
  tagColorMode?: "random" | "static";
  tagColorSeed?: number;
  tagStaticColor?: string;
}

export default function TaskNode({ data }: NodeProps<TaskNodeData>) {
  const {
    task,
    color,
    showPriorities = true,
    showTags = true,
    debugVisualization = false,
    tagColorMode = "random",
    tagColorSeed = 42,
    tagStaticColor = "#3b82f6",
  } = data;

  const { allTags, updateTaskTags } = useContext(TagsContext);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [starred, setStarred] = useState(task.starred);
  const [tags, setTags] = useState(task.tags || []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagError, setTagError] = useState(false);
  const app = useApp();
  const summaryRef = useSummaryRenderer(task.summary);

  // Sync local state with task prop when it changes (e.g., after Update Nodes)
  useEffect(() => {
    setStatus(task.status);
  }, [task.status]);

  useEffect(() => {
    setStarred(task.starred);
  }, [task.starred]);

  useEffect(() => {
    setTags(task.tags || []);
  }, [task.tags]);

  const priority = showPriorities ? task.priority : "";
  // Project tags show as the project of the task, not among its tags
  const { projects, tags: otherTags } = splitProjectTags(
    tags,
    getProjectTagPrefix(app)
  );
  const hasTagRow = showTags && (otherTags.length > 0 || isAddingTag);

  const handleTagRemove = async (tagToRemove: string) => {
    // Immediately update the visual state
    setTags((prevTags) => {
      const updatedTags = prevTags.filter((tag) => tag !== tagToRemove);
      // Update tasks array so allTags recomputes
      updateTaskTags(task.id, updatedTags);
      return updatedTags;
    });

    try {
      await removeTagFromTaskInVault(task, tagToRemove, app);
    } catch {
      // Revert the visual change if the vault operation failed
      setTags((prevTags) => {
        const revertedTags = [...prevTags, tagToRemove];
        updateTaskTags(task.id, revertedTags);
        return revertedTags;
      });
    }
  };

  const handleAddTag = async (tagToAdd: string) => {
    if (!tagToAdd.trim()) return;

    // Don't allow tags with spaces - check before any cleaning
    if (tagToAdd.includes(" ")) {
      setTagError(true);
      // Reset after showing error briefly
      setTimeout(() => {
        setTagError(false);
        setIsAddingTag(false);
      }, 100);
      return;
    }

    const cleanTag = tagToAdd.trim().replace(/^#+/, ""); // Remove any leading #

    // Clear any previous error
    setTagError(false);

    // Don't add duplicate tags
    if (tags.includes(cleanTag)) {
      setIsAddingTag(false);
      return;
    }

    // Immediately update the visual state
    setTags((prevTags) => {
      const updatedTags = [...prevTags, cleanTag];
      // Update tasks array so allTags recomputes
      updateTaskTags(task.id, updatedTags);
      return updatedTags;
    });

    try {
      await addTagToTaskInVault(task, cleanTag, app);
    } catch {
      // Revert the visual change if the vault operation failed
      setTags((prevTags) => {
        const revertedTags = prevTags.filter((tag) => tag !== cleanTag);
        updateTaskTags(task.id, revertedTags);
        return revertedTags;
      });
    }

    // Reset input state
    setIsAddingTag(false);
  };

  const handleCancelAddTag = () => {
    setIsAddingTag(false);
    setTagError(false);
  };

  const handleStarToggle = async () => {
    const newStarred = !starred;
    // Immediately update the visual state
    setStarred(newStarred);

    try {
      if (newStarred) {
        await addStarToTaskInVault(task, app);
      } else {
        await removeStarFromTaskInVault(task, app);
      }
    } catch {
      // Revert the visual change if the vault operation failed
      setStarred(!newStarred);
    }
  };

  return (
    <TaskBackground
      status={status}
      color={color}
      starred={starred}
      expanded={expanded}
      debugVisualization={debugVisualization}
    >
      {HANDLE_POSITIONS.map((position) => (
        <Handle
          key={position}
          id={position}
          type="source"
          position={position}
          className="tasks-map-handle"
        />
      ))}

      <div className="tasks-map-task-node-header">
        <TaskStatusToggle
          status={status}
          task={task}
          onStatusChange={setStatus}
        />
        <span ref={summaryRef} className="tasks-map-task-node-summary" />
        {priority && <TaskPriority priority={priority} />}
      </div>

      {showTags &&
        projects.map((project) => <TaskProject key={project} path={project} />)}

      {/* Shown above the node while it is hovered */}
      <div className="tasks-map-task-node-actions nodrag">
        {showTags && (
          <button
            className="clickable-icon tasks-map-node-action nodrag"
            onClick={() => setIsAddingTag(true)}
            aria-label="Add tag"
          >
            <TagIcon size={14} />
          </button>
        )}
        <StarButton starred={starred} onClick={handleStarToggle} />
        <LinkButton link={task.link} app={app} />
      </div>

      {hasTagRow && (
        <div className="tasks-map-task-node-tags">
          {otherTags.map((tag) => (
            <Tag
              key={tag}
              tag={tag}
              tagColorMode={tagColorMode}
              tagColorSeed={tagColorSeed}
              tagStaticColor={tagStaticColor}
              onRemove={handleTagRemove}
            />
          ))}
          {isAddingTag && (
            <div className="nodrag">
              <TagInput
                allTags={allTags}
                existingTags={tags}
                onAddTag={handleAddTag}
                onCancel={handleCancelAddTag}
                hasError={tagError}
              />
            </div>
          )}
        </div>
      )}

      {debugVisualization && (
        <ExpandButton
          expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        />
      )}

      {debugVisualization && expanded && (
        <TaskDetails task={task} status={status} />
      )}
    </TaskBackground>
  );
}
