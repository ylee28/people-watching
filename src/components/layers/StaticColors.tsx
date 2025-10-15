import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";

interface ColorData {
  id: string;
  angleDeg: number;
  color: string;
}

interface StaticColorsProps {
  size?: number;
}

/**
 * Layer 1: Colors - Shows colored dots at seat angles representing people's clothing colors
 */
export const StaticColors: React.FC<StaticColorsProps> = ({ size = 520 }) => {
  const [data, setData] = React.useState<ColorData[]>([]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const navigate = useNavigate();
  
  const center = size / 2;
  const radius = size / 2 - 40;

  React.useEffect(() => {
    // Load data from JSON file
    fetch("/data/colors.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load colors data:", err));
  }, []);

  const handleClick = (id: string) => {
    navigate(`/person/${id}`);
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
      >
        {data.map((item) => {
          const pos = polarToCartesian(center, center, radius, item.angleDeg);
          const isHovered = hoveredId === item.id;
          
          return (
            <g key={item.id}>
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={isHovered ? 12 : 8}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onClick={() => handleClick(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.2 }}
                aria-label={`Person ${item.id} at ${item.angleDeg} degrees, color ${item.color}`}
                role="button"
                tabIndex={0}
              />
              {isHovered && (
                <motion.text
                  x={pos.x}
                  y={pos.y - 20}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fontSize="12"
                  fontWeight="500"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ pointerEvents: "none" }}
                >
                  {item.color}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};