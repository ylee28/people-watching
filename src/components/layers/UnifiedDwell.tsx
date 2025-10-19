import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  ringRadiusPx: number;
  prev?: { angleDeg: number; radiusFactor: number };
}

const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor units
const DEFAULT_DIAMETER_PX = 2;
const DEFAULT_RADIUS_PX = DEFAULT_DIAMETER_PX / 2; // = 1px
const GROW_RADIUS_PER_SEC = 0.5; // +1px diameter per second = +0.5px radius per second

/**
 * Calculate shortest angular distance (wrap-aware)
 */
const shortestAngularDelta = (a: number, b: number): number => {
  let d = ((b - a + 540) % 360) - 180; // (-180, 180]
  return d;
};

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow at 1px diameter/sec when position doesn't change, snap to 2px diameter when moving
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  
  // Persistent state that survives renders
  const dwellStatesRef = React.useRef<Map<string, DwellState>>(new Map());
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - position-based with time growth
  React.useEffect(() => {
    const animate = (now: number) => {
      const dtSec = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        const dwellStates = dwellStatesRef.current;
        
        peopleAtTime
          .filter((person) => person.isVisible)
          .forEach((person) => {
            // Get or create persistent state
            let state = dwellStates.get(person.id);
            if (!state) {
              state = {
                ringRadiusPx: DEFAULT_RADIUS_PX
              };
              dwellStates.set(person.id, state);
            }
            
            const cur = {
              angleDeg: person.currentAngleDeg,
              radiusFactor: person.currentRadiusFactor
            };
            
            // Check for exit
            const isExiting = person.currentRadiusFactor > 1.0;
            
            if (isExiting) {
              // Exiting: snap to default
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              state.prev = cur;
              return;
            }
            
            // First frame for this person
            if (!state.prev) {
              state.prev = cur;
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              return;
            }
            
            // Compare current position to previous frame
            const dAng = Math.abs(shortestAngularDelta(cur.angleDeg, state.prev.angleDeg));
            const dRad = Math.abs(cur.radiusFactor - state.prev.radiusFactor);
            const SAME = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
            
            if (SAME) {
              // Position unchanged: grow at +0.5px radius per second (unbounded)
              state.ringRadiusPx += GROW_RADIUS_PER_SEC * dtSec;
            } else {
              // Position changed: snap back to default immediately (2px diameter = 1px radius)
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
            }
            
            // Update previous position
            state.prev = cur;
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
      }
      
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
              const ringRadius = state?.ringRadiusPx || DEFAULT_RADIUS_PX;

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
