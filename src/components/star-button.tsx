import { Star } from "lucide-react";

interface StarButtonProps {
  starred: boolean;
  onClick: () => void;
}

export function StarButton({ starred, onClick }: StarButtonProps) {
  return (
    <button
      className={`clickable-icon tasks-map-node-action tasks-map-star-button nodrag ${starred ? "is-starred" : ""}`}
      onClick={onClick}
      aria-label={starred ? "Remove star" : "Add star"}
    >
      <Star size={14} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
