import * as React from "react";
import { motion } from "framer-motion";
type LayerType = "colors" | "postures" | "notes" | "movement" | "coverage";
const layerLabels: Record<LayerType, string> = {
  colors: "Colors",
  postures: "Postures",
  notes: "Notes",
  movement: "Path",
  coverage: "Coverage"
};
const layerColors: Record<LayerType, string> = {
  colors: "from-red-500 to-orange-500",
  postures: "from-blue-500 to-cyan-500",
  notes: "from-green-500 to-emerald-500",
  movement: "from-purple-500 to-pink-500",
  coverage: "from-yellow-500 to-amber-500"
};
interface LayerNavButtonsProps {
  onSelect: (layer: LayerType) => void;
  activeLayer?: LayerType | null;
  layout?: "vertical" | "horizontal";
}
export const LayerNavButtons: React.FC<LayerNavButtonsProps> = ({
  onSelect,
  activeLayer,
  layout = "vertical"
}) => {
  const layers: LayerType[] = ["colors", "postures", "notes", "movement", "coverage"];
  return <div className={`flex ${layout === "vertical" ? "flex-col gap-3" : "flex-row gap-2 overflow-x-auto pb-2"}`}>
      {layers.map(layer => {
      const isActive = activeLayer === layer;
      return (
        <motion.button
          key={layer}
          onClick={() => onSelect(layer)}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${isActive 
              ? 'bg-primary text-primary-foreground shadow-md' 
              : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
            }
          `}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {layerLabels[layer]}
        </motion.button>
      );
    })}
    </div>;
};