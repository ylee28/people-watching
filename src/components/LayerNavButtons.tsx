import * as React from "react";
import { motion } from "framer-motion";
type LayerType = "colors" | "dwell" | "notes" | "movement" | "coverage";
const layerLabels: Record<LayerType, string> = {
  colors: "Colors",
  dwell: "Dwell Time",
  notes: "Notes",
  movement: "Path",
  coverage: "Other"
};
const layerColors: Record<LayerType, string> = {
  colors: "from-red-500 to-orange-500",
  dwell: "from-blue-500 to-cyan-500",
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
  const layers: LayerType[] = ["colors", "dwell", "notes", "movement", "coverage"];
  return <div className={`flex ${layout === "vertical" ? "flex-col gap-[100px]" : "flex-row gap-2 overflow-x-auto pb-2"}`} style={{ marginLeft: '-400px' }}>
      {layers.map(layer => {
      const isActive = activeLayer === layer;
      return <button key={layer} onClick={() => onSelect(layer)} className="font-mori cursor-pointer hover:opacity-70 transition-opacity" style={{
              fontSize: '14px',
              color: '#CFBD94',
              background: 'none',
              border: 'none',
              padding: '8px 0',
              textAlign: 'left'
            }}>
            {layerLabels[layer]}
          </button>;
    })}
    </div>;
};