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
  radialLines = 12,
  className = "",
}) => {
  const center = size / 2;
  const maxRadius = size / 2 - 20; // padding

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Circular grid visualization"
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

      {/* Radial lines */}
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