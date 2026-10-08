import React, { useEffect, useRef, useState } from "react";
import { Menu } from "obsidian";
import { Panel } from "reactflow";
import { Plus } from "lucide-react";
import { localize } from "src/lib/i18n";
import { CanvasInfo } from "src/types/settings";

interface CanvasTabsProps {
  canvases: CanvasInfo[];
  activeCanvasId: string;
  onSelect: (id: string) => void; // eslint-disable-line no-unused-vars
  onAdd: () => void;
  onRename: (id: string, name: string) => void; // eslint-disable-line no-unused-vars
  onDelete: (id: string) => void; // eslint-disable-line no-unused-vars
}

/** Switches between the canvases of the map, in its top left corner */
export function CanvasTabs({
  canvases,
  activeCanvasId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: CanvasTabsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const openMenu = (e: React.MouseEvent, canvas: CanvasInfo) => {
    e.preventDefault();
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(localize({ en: "Rename", zh: "重命名" }))
        .setIcon("pencil")
        .onClick(() => setRenamingId(canvas.id))
    );
    menu.addItem((item) =>
      item
        .setTitle(localize({ en: "Delete", zh: "删除" }))
        .setIcon("trash-2")
        .setDisabled(canvases.length === 1)
        .onClick(() => onDelete(canvas.id))
    );
    menu.showAtMouseEvent(e.nativeEvent);
  };

  return (
    <Panel
      position="top-left"
      className="tasks-map-canvas-controls tasks-map-canvas-tabs"
    >
      <div className="tasks-map-canvas-tab-list">
        {canvases.map((canvas) =>
          canvas.id === renamingId ? (
            <CanvasNameInput
              key={canvas.id}
              name={canvas.name}
              onDone={(name) => {
                setRenamingId(null);
                if (name !== null) onRename(canvas.id, name);
              }}
            />
          ) : (
            <button
              key={canvas.id}
              className={`tasks-map-canvas-tab ${canvas.id === activeCanvasId ? "is-active" : ""}`}
              onClick={() => onSelect(canvas.id)}
              onContextMenu={(e) => openMenu(e, canvas)}
            >
              <span className="tasks-map-canvas-tab-name">{canvas.name}</span>
            </button>
          )
        )}
      </div>
      <button
        className="clickable-icon tasks-map-canvas-control"
        onClick={onAdd}
        aria-label={localize({ en: "New canvas", zh: "新建画布" })}
      >
        <Plus size={16} />
      </button>
    </Panel>
  );
}

interface CanvasNameInputProps {
  name: string;
  onDone: (name: string | null) => void; // eslint-disable-line no-unused-vars
}

// Enter or clicking elsewhere renames the canvas, Escape cancels
function CanvasNameInput({ name, onDone }: CanvasNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canceledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className="tasks-map-canvas-tab-input"
      defaultValue={name}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          canceledRef.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => onDone(canceledRef.current ? null : e.currentTarget.value)}
    />
  );
}
