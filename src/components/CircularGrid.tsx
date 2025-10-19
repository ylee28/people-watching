import * as React from "react";
import { ROOM, polarToCartesian } from "@/lib/roomGeometry";

interface CircularGridProps {
  size?: number;
  className?: string;
}

/**
 * CircularGrid: Draws a circular grid matching the CSV reference
 * - 10 sectors (36° each)
 * - 5 rings
 * - 0° = right, 90° = top, counter-clockwise
 * - Benches at specified positions
 */
export const CircularGrid: React.FC<CircularGridProps> = ({
  size = 520,
  className = "",
}) => {
  const center = size / 2;
  const maxRadius = size / 2 - 20; // padding
  const benchRadius = maxRadius * 0.92; // Bench arcs slightly inside the rim

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Circular grid visualization with 10 sectors and 5 rings"
    >
      {/* Concentric rings (5 rings) */}
      {ROOM.ringRadiusFactors.map((factor, i) => {
        const radius = maxRadius * factor;
        return (
          <circle
            key={`ring-${i}`}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1"
            opacity="0.2"
          />
        );
      })}

      {/* Radial sector lines (10 sectors = 36° each) */}
      {Array.from({ length: ROOM.sectors }).map((_, i) => {
        const angleDeg = i * ROOM.sectorSizeDeg;
        const outerPoint = polarToCartesian(center, center, maxRadius, angleDeg);
        return (
          <line
            key={`radial-${i}`}
            x1={center}
            y1={center}
            x2={outerPoint.x}
            y2={outerPoint.y}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1"
            opacity="0.2"
          />
        );
      })}

      {/* Bench arcs */}
      {ROOM.benches.map((bench) => {
        const startPos = polarToCartesian(center, center, benchRadius, bench.startDeg);
        const endPos = polarToCartesian(center, center, benchRadius, bench.endDeg);
        
        const arcSpan = bench.endDeg - bench.startDeg;
        const largeArcFlag = arcSpan > 180 ? 1 : 0;
        
        // SVG arc path: sweep flag = 0 for counter-clockwise (since Y is inverted in SVG)
        const pathData = [
          `M ${startPos.x} ${startPos.y}`,
          `A ${benchRadius} ${benchRadius} 0 ${largeArcFlag} 0 ${endPos.x} ${endPos.y}`,
        ].join(" ");

        // Label position at mid-angle, slightly outside the bench arc
        const midAngle = (bench.startDeg + bench.endDeg) / 2;
        const labelPos = polarToCartesian(center, center, benchRadius + 20, midAngle);

        return (
          <g key={bench.id}>
            {/* Bench arc */}
            <path
              d={pathData}
              fill="none"
              stroke={bench.color}
              strokeWidth="4"
              opacity="0.6"
            />
            {/* Label */}
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-semibold"
              fill={bench.color}
            >
              {bench.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Re-export polarToCartesian for convenience
export { polarToCartesian };