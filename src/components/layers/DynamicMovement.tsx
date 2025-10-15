import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";

interface TimelinePoint {
  t: number; // time in seconds
  action: string;
  angleDeg: number;
  radiusFactor: number;
}

interface TimelinePerson {
  id: string;
  track: TimelinePoint[];
}

interface DynamicMovementProps {
  size?: number;
  currentTime: number; // Global time in seconds (0-300)
}

/**
 * Layer 4: Movement Paths - Animated breadcrumb dots along movement paths using timeline data
 */
export const DynamicMovement: React.FC<DynamicMovementProps> = ({ 
  size = 520,
  currentTime 
}) => {
  const [data, setData] = React.useState<TimelinePerson[]>([]);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  React.useEffect(() => {
    fetch("/data/timeline.json")
      .then((res) => res.json())
      .then((json: TimelinePerson[]) => setData(json))
      .catch((err) => console.error("Failed to load timeline:", err));
  }, []);

  // Interpolate position for a person at currentTime
  const interpolatePosition = (track: TimelinePoint[], t: number) => {
    if (track.length === 0) return null;
    
    // Find surrounding points
    let before = track[0];
    let after = track[track.length - 1];
    
    for (let i = 0; i < track.length - 1; i++) {
      if (track[i].t <= t && track[i + 1].t >= t) {
        before = track[i];
        after = track[i + 1];
        break;
      }
    }
    
    if (before === after) return before;
    
    // Linear interpolation
    const ratio = (t - before.t) / (after.t - before.t);
    return {
      angleDeg: before.angleDeg + (after.angleDeg - before.angleDeg) * ratio,
      radiusFactor: before.radiusFactor + (after.radiusFactor - before.radiusFactor) * ratio,
      action: before.action,
    };
  };

  // Get all points up to currentTime for breadcrumbs
  const getBreadcrumbs = (track: TimelinePoint[], t: number) => {
    return track.filter((p) => p.t <= t);
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {data.map((person) => {
          const breadcrumbs = getBreadcrumbs(person.track, currentTime);
          const currentPos = interpolatePosition(person.track, currentTime);
          
          if (!currentPos) return null;

          // Convert breadcrumbs to coordinates
          const breadcrumbCoords = breadcrumbs.map((pt) =>
            polarToCartesian(center, center, maxRadius * pt.radiusFactor, pt.angleDeg)
          );

          // Path line through all breadcrumbs
          const pathData = breadcrumbCoords
            .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
            .join(" ");

          // Current position
          const currCoord = polarToCartesian(
            center,
            center,
            maxRadius * currentPos.radiusFactor,
            currentPos.angleDeg
          );

          // Color based on action
          const getColor = (action: string) => {
            switch (action) {
              case "sit": return "#3498db";
              case "stand": return "#2ecc71";
              case "walk": return "#f39c12";
              case "queue": return "#e74c3c";
              case "board": return "#9b59b6";
              case "exit": return "#95a5a6";
              default: return "#34495e";
            }
          };

          const color = getColor(currentPos.action);

          return (
            <g key={person.id}>
              {/* Path line */}
              {breadcrumbCoords.length > 1 && (
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
              )}

              {/* Breadcrumb dots */}
              {breadcrumbCoords.map((coord, idx) => (
                <circle
                  key={idx}
                  cx={coord.x}
                  cy={coord.y}
                  r="3"
                  fill={color}
                  opacity="0.6"
                />
              ))}

              {/* Current position dot (larger, pulsing) */}
              <motion.circle
                cx={currCoord.x}
                cy={currCoord.y}
                r="7"
                fill={color}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};