import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { useNavigate } from "react-router-dom";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedNotesProps {
  size?: number;
}

/**
 * Layer 3: Notes - Shows all 13 people with text observations
 */
export const UnifiedNotes: React.FC<UnifiedNotesProps> = ({ size = 520 }) => {
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
            .filter((person) => person.isVisible && person.words)
            .map((person) => {
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * person.currentRadiusFactor,
                person.currentAngleDeg
              );
              const isHovered = hoveredId === person.id;

              // Truncate text for display
              const displayText = person.words.length > 15 
                ? person.words.substring(0, 15) + "..." 
                : person.words;

              return (
                <g key={person.id}>
                  <text
                    x={coord.x}
                    y={coord.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isHovered ? "11" : "10"}
                    fill="hsl(var(--foreground))"
                    style={{ cursor: "pointer", maxWidth: "80px" }}
                    onMouseEnter={() => setHoveredId(person.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/person/${person.id}`)}
                  >
                    {displayText}
                  </text>
                  {isHovered && (
                    <g>
                      <rect
                        x={coord.x - 60}
                        y={coord.y + 15}
                        width={120}
                        height={40}
                        fill="rgba(0,0,0,0.9)"
                        rx="4"
                      />
                      <text
                        x={coord.x}
                        y={coord.y + 35}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize="10"
                      >
                        {person.words}
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
