import * as React from "react";

interface CircularGridProps {
  size?: number;
  concentricRings?: number;
  radialLines?: number;
  className?: string;
}

/**
 * CircularGrid: Draws a circular grid with concentric circles and radial lines.
 * Used as the base visualization for all layers.
 */
export const CircularGrid: React.FC<CircularGridProps> = ({
  size = 520,
  concentricRings = 5,
  radialLines = 10, // 10 wedges = 36° each
  className = "",
}) => {
  const center = size / 2;
  const maxRadius = size / 2 - 20; // padding

  // Bench arc definitions: updated layout (T1/T2 top, B1/B2 bottom, R right, L left)
  const benches = [
    { label: "T1", center: 126, color: "#2ecc71" },  // 108-144° top-left
    { label: "T2", center: 90, color: "#3498db" },   // 72-108° top-right
    { label: "R", center: 18, color: "#e74c3c" },    // 0-36° right
    { label: "L", center: 198, color: "#f39c12" },   // 180-216° left
    { label: "B1", center: 270, color: "#9b59b6" },  // 252-288° bottom-left
    { label: "B2", center: 306, color: "#1abc9c" },  // 288-324° bottom-right
  ];

  const benchRadius = maxRadius * 0.92;
  const benchArcSpan = 36; // ±18° = 36° total

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Circular grid visualization with benches"
    >
      {/* Concentric circles */}
      {Array.from({ length: concentricRings }).map((_, i) => {
        const radius = (maxRadius / concentricRings) * (i + 1);
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

      {/* Radial wedge lines (10 wedges = 36° each) */}
      {Array.from({ length: radialLines }).map((_, i) => {
        const angle = (i * 360) / radialLines;
        const radians = (angle * Math.PI) / 180;
        const x2 = center + maxRadius * Math.cos(radians);
        const y2 = center + maxRadius * Math.sin(radians);
        return (
          <line
            key={`radial-${i}`}
            x1={center}
            y1={center}
            x2={x2}
            y2={y2}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1"
            opacity="0.2"
          />
        );
      })}

      {/* Bench arcs */}
      {benches.map((bench) => {
        const startAngle = bench.center - benchArcSpan / 2;
        const endAngle = bench.center + benchArcSpan / 2;
        
        const startPos = polarToCartesian(center, center, benchRadius, startAngle);
        const endPos = polarToCartesian(center, center, benchRadius, endAngle);
        
        const largeArcFlag = benchArcSpan > 180 ? 1 : 0;
        
        const pathData = [
          `M ${startPos.x} ${startPos.y}`,
          `A ${benchRadius} ${benchRadius} 0 ${largeArcFlag} 1 ${endPos.x} ${endPos.y}`,
        ].join(" ");

        const labelPos = polarToCartesian(center, center, benchRadius + 20, bench.center);

        return (
          <g key={bench.label}>
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
              {bench.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Helper function to convert angle (degrees) and radius to x, y coordinates
 * angleDeg: 0° = right (3 o'clock), grows counter-clockwise
 */
export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY + radius * Math.sin(angleRad),
  };
};