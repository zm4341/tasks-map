import React, { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { getTagColor } from "../lib/utils";

interface TagProps {
  tag: string;
  tagColorMode?: "random" | "static";
  tagColorSeed?: number;
  tagStaticColor?: string;
  onRemove?: (tag: string) => void; // eslint-disable-line no-unused-vars
}

export function Tag({
  tag,
  tagColorMode = "random",
  tagColorSeed = 42,
  tagStaticColor = "#3B82F6",
  onRemove,
}: TagProps) {
  const tagRef = useRef<HTMLSpanElement>(null);
  const color = getTagColor(tag, tagColorMode, tagColorSeed, tagStaticColor);

  // The color goes into a CSS variable, global.css decides how it is used
  useLayoutEffect(() => {
    tagRef.current?.style.setProperty("--tasks-map-tag-color", color);
  }, [color]);

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(tag);
  };

  return (
    <span
      ref={tagRef}
      className={`tasks-map-tag ${onRemove ? "removable" : ""}`}
    >
      <span className="tasks-map-tag-text">{tag}</span>
      {onRemove && (
        <X
          size={12}
          className="tasks-map-tag-remove-icon"
          onClick={handleRemoveClick}
        />
      )}
    </span>
  );
}
