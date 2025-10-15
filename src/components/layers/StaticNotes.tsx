import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";

interface NoteData {
  id: string;
  angleDeg: number;
  words: string;
}

interface StaticNotesProps {
  size?: number;
}

/**
 * Layer 3: Notes - Shows short text observations at seat angles
 */
export const StaticNotes: React.FC<StaticNotesProps> = ({ size = 520 }) => {
  const [data, setData] = React.useState<NoteData[]>([]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const navigate = useNavigate();
  
  const center = size / 2;
  const radius = size / 2 - 40;

  React.useEffect(() => {
    fetch("/data/notes.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load notes data:", err));
  }, []);

  const handleClick = (id: string) => {
    navigate(`/person/${id}`);
  };

  // Truncate text for display on ring
  const getTruncatedText = (text: string, maxLength = 15) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {data.map((item) => {
          const pos = polarToCartesian(center, center, radius, item.angleDeg);
          const isHovered = hoveredId === item.id;
          
          // Calculate text rotation to be tangent to circle
          const textAngle = item.angleDeg;
          
          return (
            <g key={item.id}>
              <motion.text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize="11"
                fontWeight="400"
                transform={`rotate(${textAngle}, ${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ fontSize: 13, fontWeight: 500 }}
                role="button"
                tabIndex={0}
              >
                {getTruncatedText(item.words)}
              </motion.text>
              
              {isHovered && (
                <motion.g
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <rect
                    x={pos.x - 60}
                    y={pos.y - 40}
                    width="120"
                    height="30"
                    fill="hsl(var(--popover))"
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    rx="4"
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 22}
                    textAnchor="middle"
                    fill="hsl(var(--popover-foreground))"
                    fontSize="10"
                    style={{ pointerEvents: "none" }}
                  >
                    {item.words}
                  </text>
                </motion.g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};