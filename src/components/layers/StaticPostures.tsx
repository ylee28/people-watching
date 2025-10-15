import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircularGrid, polarToCartesian } from "../CircularGrid";
import { motion } from "framer-motion";

interface PostureData {
  id: string;
  angleDeg: number;
  posture: "upright" | "leaning" | "curled" | "phone" | "reading";
}

interface StaticPosturesProps {
  size?: number;
}

/**
 * Simple stick figure SVG for different postures
 */
const PostureGlyph: React.FC<{
  posture: string;
  x: number;
  y: number;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ posture, x, y, onClick, onMouseEnter, onMouseLeave }) => {
  const glyphs = {
    upright: (
      <g transform={`translate(${x - 8}, ${y - 16})`}>
        <circle cx="8" cy="4" r="3" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="7" x2="8" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="4" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="12" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="16" x2="5" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="16" x2="11" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
      </g>
    ),
    leaning: (
      <g transform={`translate(${x - 8}, ${y - 16})`}>
        <circle cx="10" cy="4" r="3" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="10" y1="7" x2="6" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="3" y2="13" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="12" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="6" y1="16" x2="3" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="6" y1="16" x2="9" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
      </g>
    ),
    curled: (
      <g transform={`translate(${x - 8}, ${y - 12})`}>
        <circle cx="8" cy="4" r="3" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <path d="M 8 7 Q 6 10, 8 13 Q 10 10, 8 7" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="10" x2="5" y2="12" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="11" y2="12" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="13" x2="6" y2="18" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="13" x2="10" y2="18" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
      </g>
    ),
    phone: (
      <g transform={`translate(${x - 8}, ${y - 16})`}>
        <circle cx="8" cy="4" r="3" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="7" x2="8" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="4" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="11" y2="8" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <rect x="10" y="6" width="3" height="5" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="16" x2="5" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="16" x2="11" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
      </g>
    ),
    reading: (
      <g transform={`translate(${x - 8}, ${y - 16})`}>
        <circle cx="8" cy="4" r="3" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="7" x2="8" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="3" y2="12" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="13" y2="12" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <rect x="5" y="8" width="6" height="4" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
        <line x1="8" y1="16" x2="5" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        <line x1="8" y1="16" x2="11" y2="22" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
      </g>
    ),
  };

  return (
    <motion.g
      style={{ cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.2 }}
      role="button"
      tabIndex={0}
    >
      {glyphs[posture as keyof typeof glyphs] || glyphs.upright}
    </motion.g>
  );
};

/**
 * Layer 2: Postures - Shows stick figure glyphs representing body postures
 */
export const StaticPostures: React.FC<StaticPosturesProps> = ({ size = 520 }) => {
  const [data, setData] = React.useState<PostureData[]>([]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const navigate = useNavigate();
  
  const center = size / 2;
  const radius = size / 2 - 40;

  React.useEffect(() => {
    fetch("/data/postures.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load postures data:", err));
  }, []);

  const handleClick = (id: string) => {
    navigate(`/person/${id}`);
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {data.map((item) => {
          const pos = polarToCartesian(center, center, radius, item.angleDeg);
          const isHovered = hoveredId === item.id;
          
          return (
            <g key={item.id}>
              <PostureGlyph
                posture={item.posture}
                x={pos.x}
                y={pos.y}
                onClick={() => handleClick(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
              {isHovered && (
                <motion.text
                  x={pos.x}
                  y={pos.y - 30}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fontSize="12"
                  fontWeight="500"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ pointerEvents: "none" }}
                >
                  {item.posture}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};