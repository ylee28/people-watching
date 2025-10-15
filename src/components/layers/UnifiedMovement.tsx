import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedMovementProps {
  size?: number;
}

/**
 * Layer 4: Movement Paths - Shows breadcrumb trails for all 13 people
 */
export const UnifiedMovement: React.FC<UnifiedMovementProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const getActionColor = (action: string) => {
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

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {peopleAtTime
          .filter((person) => person.isVisible && person.pathHistory.length > 0)
          .map((person) => {
            const color = getActionColor(person.currentAction);
            
            // Convert path history to coordinates
            const pathCoords = person.pathHistory.map((pt) =>
              polarToCartesian(center, center, maxRadius * pt.radiusFactor, pt.angleDeg)
            );

            // Current position
            const currCoord = polarToCartesian(
              center,
              center,
              maxRadius * person.currentRadiusFactor,
              person.currentAngleDeg
            );

            // Path line
            const pathData = pathCoords
              .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
              .join(" ");

            return (
              <g key={person.id}>
                {/* Path line */}
                {pathCoords.length > 1 && (
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
                {pathCoords.map((coord, idx) => (
                  <circle
                    key={idx}
                    cx={coord.x}
                    cy={coord.y}
                    r="3"
                    fill={color}
                    opacity="0.6"
                  />
                ))}

                {/* Current position (pulsing if playing) */}
                <motion.circle
                  cx={currCoord.x}
                  cy={currCoord.y}
                  r="7"
                  fill={color}
                  animate={isPlaying ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ repeat: isPlaying ? Infinity : 0, duration: 1.5 }}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
};
