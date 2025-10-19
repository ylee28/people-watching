import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedCoverageProps {
  size?: number;
}

/**
 * Layer 5: Coverage - Shows accumulated footprint of where dots have been
 */
export const UnifiedCoverage: React.FC<UnifiedCoverageProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const lastTimeRef = React.useRef<number>(0);
  const lastPositionsRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Clear canvas when time rewinds to 0
  React.useEffect(() => {
    if (timeSec < lastTimeRef.current || timeSec === 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          lastPositionsRef.current.clear();
        }
      }
    }
    lastTimeRef.current = timeSec;
  }, [timeSec, size]);

  // Stamp footprints on canvas
  React.useEffect(() => {
    if (!isPlaying) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stamp a circle for each visible person at their current position
    peopleAtTime
      .filter((person) => person.isVisible)
      .forEach((person) => {
        const coord = polarToCartesian(
          center,
          center,
          maxRadius * person.currentRadiusFactor,
          person.currentAngleDeg
        );

        // Only stamp if position changed significantly (avoid over-stamping)
        const lastPos = lastPositionsRef.current.get(person.id);
        if (lastPos) {
          const dist = Math.sqrt(
            Math.pow(coord.x - lastPos.x, 2) + Math.pow(coord.y - lastPos.y, 2)
          );
          if (dist < 2) return; // Skip if moved less than 2px
        }

        // Stamp a small semi-transparent circle
        ctx.fillStyle = hexToRgba(person.color, 0.08);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Update last position
        lastPositionsRef.current.set(person.id, { x: coord.x, y: coord.y });
      });
  }, [peopleAtTime, isPlaying, center, maxRadius]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      
      {/* Off-screen canvas for footprint accumulation */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
};
