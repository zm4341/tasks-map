import React from "react";
import { App } from "obsidian";
import { ArrowUpRight } from "lucide-react";

interface LinkButtonProps {
  link: string;
  app: App;
}

export const LinkButton = ({ link, app }: LinkButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    app.workspace.openLinkText(link, link);
  };

  return (
    <button
      className="clickable-icon tasks-map-node-action nodrag"
      onClick={handleClick}
      aria-label="Open file"
    >
      <ArrowUpRight size={14} />
    </button>
  );
};
