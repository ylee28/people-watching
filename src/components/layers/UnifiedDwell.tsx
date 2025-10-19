import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";
import { motion, AnimatePresence } from "framer-motion";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  lastPos?: { angleDeg: number; radiusFactor: number };
  dwellSec: number;
  ringRadius: number;
  lastUpdateTime: number;
}

const ANGLE_TOLERANCE = 2.0; // degrees
const RADIUS_TOLERANCE = 0.015; // radiusFactor
const BASE_RADIUS = 6; // px
const MAX_RADIUS_FOCUS = 36; // px
const GROWTH_RATE = 0.9; // px/s

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  
  const [dwellStates, setDwellStates] = React.useState<Map<string, DwellState>>(new Map());
  const prevTimeRef = React.useRef<number>(0);
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  React.useEffect(() => {
    const dt = timeSec - prevTimeRef.current;
    prevTimeRef.current = timeSec;
    
    if (dt <= 0 || dt > 1) return; // Skip on reset or large jumps
    
    setDwellStates((prev) => {
      const next = new Map(prev);
      
      peopleAtTime
        .filter((person) => person.isVisible)
        .forEach((person) => {
          const currentPos = {
            angleDeg: person.currentAngleDeg,
            radiusFactor: person.currentRadiusFactor
          };
          
          const state = next.get(person.id) || {
            dwellSec: 0,
            ringRadius: 0,
            lastUpdateTime: timeSec
          };
          
          // Check if stationary
          let isStationary = false;
          if (state.lastPos) {
            const angleDiff = Math.abs(currentPos.angleDeg - state.lastPos.angleDeg);
            const radiusDiff = Math.abs(currentPos.radiusFactor - state.lastPos.radiusFactor);
            
            // Handle angle wrap
            const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
            
            isStationary = normalizedAngleDiff <= ANGLE_TOLERANCE && radiusDiff <= RADIUS_TOLERANCE;
          }
          
          if (isStationary) {
            // Grow
            const newDwellSec = state.dwellSec + dt;
            const targetRadius = Math.min(BASE_RADIUS + GROWTH_RATE * newDwellSec, MAX_RADIUS_FOCUS);
            
            next.set(person.id, {
              lastPos: currentPos,
              dwellSec: newDwellSec,
              ringRadius: targetRadius,
              lastUpdateTime: timeSec
            });
          } else {
            // Moving - shrink
            next.set(person.id, {
              lastPos: currentPos,
              dwellSec: 0,
              ringRadius: 0,
              lastUpdateTime: timeSec
            });
          }
        });
      
      // Remove states for people no longer visible
      const visibleIds = new Set(peopleAtTime.filter(p => p.isVisible).map(p => p.id));
      Array.from(next.keys()).forEach(id => {
        if (!visibleIds.has(id)) {
          next.delete(id);
        }
      });
      
      return next;
    });
  }, [timeSec, peopleAtTime]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          <AnimatePresence>
            {peopleAtTime
              .filter((person) => person.isVisible)
              .map((person) => {
                const coord = polarToCartesian(
                  center,
                  center,
                  maxRadius * person.currentRadiusFactor,
                  person.currentAngleDeg
                );
                
                const state = dwellStates.get(person.id);
                const ringRadius = state?.ringRadius || 0;

                if (ringRadius < BASE_RADIUS) return null;

                return (
                  <motion.circle
                    key={person.id}
                    cx={coord.x}
                    cy={coord.y}
                    r={ringRadius}
                    fill="none"
                    stroke={person.color}
                    strokeWidth="2.5"
                    strokeOpacity="0.9"
                    strokeDasharray="8 6"
                    initial={{ r: 0, opacity: 0 }}
                    animate={{ r: ringRadius, opacity: 0.9 }}
                    exit={{ r: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                );
              })}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
};
