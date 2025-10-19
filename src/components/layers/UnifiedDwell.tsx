import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  ringPx: number;
  streakSame: number;
  shrinkFramesLeft: number;
  prev?: { angleDeg: number; radiusFactor: number };
}

const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor units
const DOT_PX = 6; // target when shrinking
const GROW_STEP_PX = 0.8; // px to add per SAME frame (no cap)
const SHRINK_FRAMES = 7; // shrink finishes in ~7 frames (fast but visible)

/**
 * Calculate shortest angular distance (signed, wrap-aware)
 */
const shortestAngularDelta = (a: number, b: number): number => {
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow when position doesn't change, shrink when position changes
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  
  // Persistent state that survives renders
  const dwellStatesRef = React.useRef<Map<string, DwellState>>(new Map());
  const rafRef = React.useRef<number>(0);
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - position-based only
  React.useEffect(() => {
    const animate = () => {
      const dwellStates = dwellStatesRef.current;
      
      peopleAtTime
        .filter((person) => person.isVisible)
        .forEach((person) => {
          // Get or create persistent state
          let state = dwellStates.get(person.id);
          if (!state) {
            state = {
              ringPx: DOT_PX,
              streakSame: 0,
              shrinkFramesLeft: 0
            };
            dwellStates.set(person.id, state);
          }
          
          const posNow = {
            angleDeg: person.currentAngleDeg,
            radiusFactor: person.currentRadiusFactor
          };
          
          // Check for exit
          const isExiting = person.currentRadiusFactor > 1.0;
          
          if (isExiting) {
            // Exiting: shrink to 0 over SHRINK_FRAMES
            if (state.shrinkFramesLeft <= 0) state.shrinkFramesLeft = SHRINK_FRAMES;
            const step = Math.max(state.ringPx / state.shrinkFramesLeft, 1);
            state.ringPx = Math.max(0, state.ringPx - step);
            state.shrinkFramesLeft -= 1;
            state.prev = posNow;
            return;
          }
          
          // First frame for this person
          if (!state.prev) {
            state.prev = posNow;
            state.ringPx = DOT_PX;
            state.streakSame = 0;
            state.shrinkFramesLeft = 0;
            return;
          }
          
          // Compare current position to previous frame
          const dAng = Math.abs(shortestAngularDelta(posNow.angleDeg, state.prev.angleDeg));
          const dRad = Math.abs(posNow.radiusFactor - state.prev.radiusFactor);
          const SAME = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
          
          if (SAME) {
            // Position unchanged: cancel any shrink and grow without cap
            state.shrinkFramesLeft = 0;
            state.streakSame += 1;
            state.ringPx += GROW_STEP_PX; // unlimited growth
          } else {
            // Position changed: start/continue smooth shrink to dot
            state.streakSame = 0;
            if (state.shrinkFramesLeft <= 0) {
              state.shrinkFramesLeft = SHRINK_FRAMES;
            }
            
            // Smooth step down to DOT_PX over SHRINK_FRAMES
            const step = Math.max((state.ringPx - DOT_PX) / state.shrinkFramesLeft, 1);
            state.ringPx = Math.max(DOT_PX, state.ringPx - step);
            state.shrinkFramesLeft -= 1;
          }
          
          // Update previous position
          state.prev = posNow;
        });
      
      // Remove states for people no longer visible
      const visibleIds = new Set(peopleAtTime.filter(p => p.isVisible).map(p => p.id));
      Array.from(dwellStates.keys()).forEach(id => {
        if (!visibleIds.has(id)) {
          dwellStates.delete(id);
        }
      });
      
      // Force re-render to show updated rings
      forceUpdate({});
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [peopleAtTime]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {peopleAtTime
            .filter((person) => person.isVisible)
            .map((person) => {
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * person.currentRadiusFactor,
                person.currentAngleDeg
              );
              
              const state = dwellStatesRef.current.get(person.id);
              const ringRadius = state?.ringPx || DOT_PX;

              if (ringRadius <= 0) return null;

              return (
                <circle
                  key={person.id}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke={person.color}
                  strokeWidth="2"
                  strokeOpacity="0.9"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};
