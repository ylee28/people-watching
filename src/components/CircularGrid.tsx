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

  // Bench arc definitions: [centerAngle, ±18°]
  const benches = [
    { label: "R", center: 0, color: "#e74c3c" },
    { label: "T2", center: 72, color: "#3498db" },
    { label: "T1", center: 108, color: "#2ecc71" },
    { label: "L", center: 180, color: "#f39c12" },
    { label: "B1", center: 252, color: "#9b59b6" },
    { label: "B2", center: 288, color: "#1abc9c" },
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