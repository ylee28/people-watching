import * as React from "react";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { useNavigate } from "react-router-dom";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedPosturesProps {
  size?: number;
}

/**
 * Layer 2: Postures - Shows all 13 people with stick-figure glyphs
 */
export const UnifiedPostures: React.FC<UnifiedPosturesProps> = ({ size = 520 }) => {
  const navigate = useNavigate();
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const getPostureIcon = (posture: string) => {
    switch (posture) {
      case "upright": return "↑";
      case "leaning": return "↗";
      case "curled": return "⤵";
      case "phone": return "📱";
      case "reading": return "📖";
      case "stand": return "🧍";
      default: return "●";
    }
  };

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
                  <text
                    x={coord.x}
                    y={coord.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isHovered ? "22" : "18"}
                    fill="hsl(var(--foreground))"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredId(person.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/person/${person.id}`)}
                  >
                    {getPostureIcon(person.posture)}
                  </text>
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
                        fontSize="11"
                      >
                        {person.posture}
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
