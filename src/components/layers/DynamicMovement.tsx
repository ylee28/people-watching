import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";

interface PathPoint {
  angleDeg: number;
  radiusFactor?: number;
}

interface MovementPath {
  id: string;
  color: string;
  points: PathPoint[];
}

interface DynamicMovementProps {
  size?: number;
}

/**
 * Layer 4: Movement Paths - Animated breadcrumb dots along movement paths
 */
export const DynamicMovement: React.FC<DynamicMovementProps> = ({ size = 520 }) => {
  const [data, setData] = React.useState<MovementPath[]>([]);
  const [progress, setProgress] = React.useState(0);
  
  const center = size / 2;
  const baseRadius = size / 2 - 40;

  React.useEffect(() => {
    fetch("/data/movementPaths.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load movement paths data:", err));
  }, []);

  // Animate progress from 0 to 1 continuously
  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 1 ? 0 : prev + 0.01));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {data.map((path) => {
          const positions = path.points.map((point) => {
            const radius = baseRadius * (point.radiusFactor ?? 0.9);
            return polarToCartesian(center, center, radius, point.angleDeg);
          });

          // Draw the path line
          const pathD = positions
            .map((pos, idx) => `${idx === 0 ? "M" : "L"} ${pos.x} ${pos.y}`)
            .join(" ");

          // Calculate visible breadcrumbs based on progress
          const visiblePoints = Math.floor(progress * positions.length);

          return (
            <g key={path.id}>
              {/* Path line */}
              <motion.path
                d={pathD}
                stroke={path.color}
                strokeWidth="2"
                fill="none"
                opacity="0.3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />

              {/* Breadcrumb dots */}
              {positions.slice(0, visiblePoints + 1).map((pos, idx) => (
                <motion.circle
                  key={`${path.id}-dot-${idx}`}
                  cx={pos.x}
                  cy={pos.y}
                  r="4"
                  fill={path.color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                />
              ))}

              {/* Moving dot at current position */}
              {visiblePoints < positions.length && (
                <motion.circle
                  cx={positions[visiblePoints]?.x}
                  cy={positions[visiblePoints]?.y}
                  r="6"
                  fill={path.color}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};