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

  return (
    <div
      className={`flex ${
        layout === "vertical" ? "flex-col gap-3" : "flex-row gap-2 overflow-x-auto pb-2"
      }`}
    >
      {layers.map((layer) => {
        const isActive = activeLayer === layer;
        return (
          <motion.button
            key={layer}
            onClick={() => onSelect(layer)}
            className={`group relative rounded-lg border-2 transition-all ${
              isActive
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border bg-background hover:border-primary/50 hover:shadow-md"
            } ${layout === "vertical" ? "p-4 min-w-[160px]" : "p-3 min-w-[140px] flex-shrink-0"}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            aria-label={`Open ${layerLabels[layer]} layer`}
            aria-current={isActive ? "page" : undefined}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${layerColors[layer]} flex items-center justify-center text-white font-bold text-sm shadow-md`}
              >
                {layer[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {layerLabels[layer]}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
