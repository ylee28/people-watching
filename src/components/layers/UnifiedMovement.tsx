import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedMovementProps {
  size?: number;
}

// Helper: get traveled subpath for current time
const getTraveledSubpath = (
  pathHistory: { angleDeg: number; radiusFactor: number; t: number }[],
  center: number,
  maxRadius: number
): string => {
  if (pathHistory.length === 0) return "";
  
  const coords = pathHistory.map((pt) =>
    polarToCartesian(center, center, maxRadius * pt.radiusFactor, pt.angleDeg)
  );
  
  return coords
    .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
    .join(" ");
};

/**
 * Layer 4: Movement Paths - Shows moving dots with dotted trails
 */
export const UnifiedMovement: React.FC<UnifiedMovementProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {peopleAtTime
          .filter((person) => person.isVisible && person.pathHistory.length > 0)
          .map((person) => {
            // Current position
            const currCoord = polarToCartesian(
              center,
              center,
              maxRadius * person.currentRadiusFactor,
              person.currentAngleDeg
            );

            // Traveled path
            const traveledPath = getTraveledSubpath(person.pathHistory, center, maxRadius);

            return (
              <g key={person.id}>
                {/* Dotted trail (traveled portion only) */}
                {traveledPath && (
                  <path
                    d={traveledPath}
                    fill="none"
                    stroke={person.color}
                    strokeWidth="3"
                    strokeDasharray="6 8"
                    opacity="0.85"
                    strokeLinecap="round"
                  />
                )}

                {/* Moving dot (pulsing if playing) */}
                <motion.circle
                  cx={currCoord.x}
                  cy={currCoord.y}
                  r="6"
                  fill={person.color}
                  animate={isPlaying ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={{ repeat: isPlaying ? Infinity : 0, duration: 1.5 }}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
};
