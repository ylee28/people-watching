import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";
import { motion, AnimatePresence } from "framer-motion";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  last: { angleDeg: number; radiusFactor: number } | null;
  dwellSec: number;
  ringRadiusPx: number;
  moving: boolean;
}

const ANGLE_EPS = 2.0; // degrees
const RADIUS_EPS = 0.015; // radiusFactor units
const DOT_RADIUS_PX = 6;
const GROWTH_RATE_PX_PER_SEC = 1.0;
const RING_MAX_PX = 36;

/**
 * Calculate shortest angular distance (signed, wrap-aware)
 */
const shortestAngularDistance = (a: number, b: number): number => {
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

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
          const curr = {
            angleDeg: person.currentAngleDeg,
            radiusFactor: person.currentRadiusFactor
          };
          
          const state = next.get(person.id) || {
            last: null,
            dwellSec: 0,
            ringRadiusPx: DOT_RADIUS_PX,
            moving: false
          };
          
          let isMoving = false;
          
          if (state.last !== null) {
            const dAngle = shortestAngularDistance(curr.angleDeg, state.last.angleDeg);
            const dRadius = Math.abs(curr.radiusFactor - state.last.radiusFactor);
            isMoving = Math.abs(dAngle) > ANGLE_EPS || dRadius > RADIUS_EPS;
          }
          
          // Detect movement state change
          const movementStarted = !state.moving && isMoving;
          const becameStill = state.moving && !isMoving;
          
          let newDwellSec = state.dwellSec;
          let newRingRadiusPx = state.ringRadiusPx;
          
          if (movementStarted) {
            // Movement started: reset dwell and shrink to dot
            newDwellSec = 0;
            newRingRadiusPx = DOT_RADIUS_PX;
          } else if (isMoving) {
            // Still moving: keep at dot radius
            newDwellSec = 0;
            newRingRadiusPx = DOT_RADIUS_PX;
          } else {
            // Still (or became still): accumulate and grow
            newDwellSec += dt;
            newRingRadiusPx = Math.min(
              RING_MAX_PX,
              DOT_RADIUS_PX + GROWTH_RATE_PX_PER_SEC * newDwellSec
            );
          }
          
          // Check for exit
          if (person.currentRadiusFactor > 1.0) {
            newRingRadiusPx = 0; // Shrink on exit
          }
          
          next.set(person.id, {
            last: curr,
            dwellSec: newDwellSec,
            ringRadiusPx: newRingRadiusPx,
            moving: isMoving
          });
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
                const ringRadius = state?.ringRadiusPx || DOT_RADIUS_PX;

                if (ringRadius <= 0) return null;

                return (
                  <motion.circle
                    key={person.id}
                    cx={coord.x}
                    cy={coord.y}
                    r={ringRadius}
                    fill="none"
                    stroke={person.color}
                    strokeWidth="2"
                    strokeOpacity="0.9"
                    initial={{ r: DOT_RADIUS_PX }}
                    animate={{ r: ringRadius }}
                    exit={{ r: 0, opacity: 0 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                  />
                );
              })}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
};
