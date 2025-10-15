import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedColorsProps {
  size?: number;
}

/**
 * Layer 1: Colors - Shows all 13 people with their color attribute
 */
export const UnifiedColors: React.FC<UnifiedColorsProps> = ({ size = 520 }) => {
  const navigate = useNavigate();
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {peopleAtTime
            .filter((person) => person.isVisible)
            .map((person) => {
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * person.currentRadiusFactor,
                person.currentAngleDeg
              );
              const isHovered = hoveredId === person.id;

              return (
                <g key={person.id}>
                  <motion.circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isHovered ? 10 : 8}
                    fill={person.color}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: "pointer" }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    onMouseEnter={() => setHoveredId(person.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/person/${person.id}`)}
                  />
                  {isHovered && (
                    <g>
                      <rect
                        x={coord.x + 15}
                        y={coord.y - 20}
                        width={80}
                        height={30}
                        fill="rgba(0,0,0,0.8)"
                        rx="4"
                      />
                      <text
                        x={coord.x + 55}
                        y={coord.y - 2}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="12"
                      >
                        {person.color}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
};
