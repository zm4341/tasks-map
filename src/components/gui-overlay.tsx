import MultiSelect from "./multi-select";
import TagSelect from "./tag-select";
import { TaskStatus } from "src/types/task";

interface GuiOverlayProps {
  allTags: string[];
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void; // eslint-disable-line no-unused-vars
  reloadTasks: () => void;
  loadSavedData: () => void;
  allStatuses: TaskStatus[];
  selectedStatuses: TaskStatus[];
  setSelectedStatuses: (statuses: TaskStatus[]) => void; // eslint-disable-line no-unused-vars
}

export default function GuiOverlay(props: GuiOverlayProps) {
  const {
    allTags,
    selectedTags,
    setSelectedTags,
    reloadTasks,
    loadSavedData,
    allStatuses,
    selectedStatuses,
    setSelectedStatuses,
  } = props;

  // Hide filter UI and action buttons - auto-refresh handles updates now
  // Keep the props to avoid breaking changes, but don't render
  void allTags;
  void selectedTags;
  void setSelectedTags;
  void reloadTasks;
  void loadSavedData;
  void allStatuses;
  void selectedStatuses;
  void setSelectedStatuses;

  return null;
}
