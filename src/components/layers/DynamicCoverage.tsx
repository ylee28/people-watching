import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { motion } from "framer-motion";

interface CoverageData {
  id: string;
  progress: number;
  color: string;
}

interface DynamicCoverageProps {
  size?: number;
  currentTime: number; // Global time in seconds (0-300)
}

/**
 * Layer 5: Coverage - Expanding dashed rings with rotation, synchronized with timer
 */
export const DynamicCoverage: React.FC<DynamicCoverageProps> = ({ 
  size = 520,
  currentTime 
}) => {
  const [data, setData] = React.useState<CoverageData[]>([]);
  
  const center = size / 2;
  const baseRadius = size / 2 - 60;

  React.useEffect(() => {
    fetch("/data/coverage.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load coverage data:", err));
  }, []);

  // Calculate progress based on currentTime (0-300s)
  const timeProgress = Math.min(currentTime / 300, 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {data.map((item, idx) => {
            // Use combined progress from item definition and time
            const combinedProgress = Math.min(item.progress * timeProgress, 1);
            const radius = baseRadius * (0.4 + idx * 0.25) * (0.5 + combinedProgress * 0.5);
            const circumference = 2 * Math.PI * radius;
            const dashLength = 10;
            const gapLength = 5;
            const strokeDasharray = `${dashLength} ${gapLength}`;
            
            // Calculate dash offset based on progress (0 to 1)
            const dashOffset = circumference * (1 - combinedProgress);

            return (
              <g key={item.id}>
                {/* Background ring (full dashed) */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray={strokeDasharray}
                  opacity="0.2"
                />
                
                {/* Progress ring (rotates slowly) */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={dashOffset}
                  opacity="0.8"
                  animate={{ rotate: timeProgress * 360 }}
                  transition={{
                    duration: 0.5,
                    ease: "linear",
                  }}
                  style={{ originX: "50%", originY: "50%" }}
                />

                {/* Expanding animation */}
                {radius > 0 && (
                  <motion.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    opacity="0.4"
                    initial={{ scale: 0.95, opacity: 0.6 }}
                    animate={{ scale: 1.05, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    style={{ originX: "50%", originY: "50%" }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};