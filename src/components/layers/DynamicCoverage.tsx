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
}

/**
 * Layer 5: Coverage - Expanding dashed rings with rotation
 */
export const DynamicCoverage: React.FC<DynamicCoverageProps> = ({ size = 520 }) => {
  const [data, setData] = React.useState<CoverageData[]>([]);
  
  const center = size / 2;
  const baseRadius = size / 2 - 60;

  React.useEffect(() => {
    fetch("/data/coverage.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load coverage data:", err));
  }, []);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {data.map((item, idx) => {
            // Stagger rings at different radii
            const radius = baseRadius * (0.4 + idx * 0.25);
            const circumference = 2 * Math.PI * radius;
            const dashLength = 10;
            const gapLength = 5;
            const strokeDasharray = `${dashLength} ${gapLength}`;
            
            // Calculate dash offset based on progress (0 to 1)
            const dashOffset = circumference * (1 - item.progress);

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
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 20 + idx * 5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ originX: "50%", originY: "50%" }}
                />

                {/* Expanding animation */}
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
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};