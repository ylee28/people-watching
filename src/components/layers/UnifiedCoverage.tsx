import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { motion } from "framer-motion";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedCoverageProps {
  size?: number;
}

/**
 * Layer 5: Coverage - Shows expanding coverage rings based on people's traveled arcs
 */
export const UnifiedCoverage: React.FC<UnifiedCoverageProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const center = size / 2;
  const baseRadius = size / 2 - 60;

  // Compute coverage from traveled angles
  const computeCoverage = () => {
    const anglesCovered = new Set<number>();
    
    peopleAtTime.forEach((person) => {
      if (!person.isVisible) return;
      
      person.pathHistory.forEach((pt) => {
        // Sample angle in 5-degree increments
        const normalizedAngle = Math.floor(pt.angleDeg / 5) * 5;
        anglesCovered.add(normalizedAngle);
      });
    });
    
    return anglesCovered.size / 72; // 360/5 = 72 possible samples
  };

  const coverageProgress = computeCoverage();
  const timeProgress = Math.min(timeSec / 300, 1);

  // Generate 3 rings with different coverage
  const rings = [
    { id: "ring1", color: "#3498db", radiusMult: 0.5, progress: coverageProgress * 0.8 },
    { id: "ring2", color: "#2ecc71", radiusMult: 0.7, progress: coverageProgress * 0.9 },
    { id: "ring3", color: "#f39c12", radiusMult: 0.9, progress: coverageProgress },
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {rings.map((ring) => {
            const radius = baseRadius * ring.radiusMult;
            const circumference = 2 * Math.PI * radius;
            const dashLength = 10;
            const gapLength = 5;
            const strokeDasharray = `${dashLength} ${gapLength}`;
            const dashOffset = circumference * (1 - ring.progress);

            return (
              <g key={ring.id}>
                {/* Background ring */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth="3"
                  strokeDasharray={strokeDasharray}
                  opacity="0.2"
                />
                
                {/* Progress ring (rotates when playing) */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth="3"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={dashOffset}
                  opacity="0.8"
                  animate={isPlaying ? { rotate: timeProgress * 360 } : { rotate: 0 }}
                  transition={{ duration: 0.5, ease: "linear" }}
                  style={{ originX: "50%", originY: "50%" }}
                />

                {/* Expanding pulse when playing */}
                {isPlaying && radius > 0 && (
                  <motion.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth="2"
                    opacity="0.4"
                    initial={{ scale: 0.95, opacity: 0.6 }}
                    animate={{ scale: 1.05, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
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
