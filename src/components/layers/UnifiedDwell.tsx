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

const DEFAULT_DIAMETER_PX = 5;
const DEFAULT_RADIUS_PX = DEFAULT_DIAMETER_PX / 2; // 2.5px
const GROW_RADIUS_PER_SEC = 1.5; // +3px diameter/sec = +1.5px radius/sec
const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor

/**
 * Calculate shortest angular distance (wrap-aware)
 */
function shortestAngularDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180; // (-180, 180]
}

/**
 * Check if two positions are the same (within tolerances)
 */
function isSamePos(
  prev: { angleDeg: number; radiusFactor: number },
  curr: { angleDeg: number; radiusFactor: number }
): boolean {
  const dAng = Math.abs(shortestAngularDelta(prev.angleDeg, curr.angleDeg));
  const dRad = Math.abs(prev.radiusFactor - curr.radiusFactor);
  return dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
}

// Module-level persistent state (survives renders)
const dwellMap = new Map<string, DwellState>();
let rafId: number | null = null;
let lastTime = performance.now();
let debugTimer = 0;

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow at 3px diameter/sec when position doesn't change, snap to 5px diameter when moving
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - frame-based with performance.now()
  React.useEffect(() => {
    function loop(now = performance.now()) {
      const dtSec = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        // Update all dwell states
        const activePeople = peopleAtTime.filter(p => p.isVisible);
        
        activePeople.forEach((person) => {
          const curr = {
            angleDeg: person.currentAngleDeg,
            radiusFactor: person.currentRadiusFactor
          };
          
          // Check for exit
          const isExiting = person.currentRadiusFactor > 1.0;
          if (isExiting) {
            // Exiting: snap to default
            const state = dwellMap.get(person.id);
            if (state) {
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              state.prev = curr;
            }
            return;
          }
          
          // Get or create state
          let state = dwellMap.get(person.id);
          if (!state) {
            state = { ringRadiusPx: DEFAULT_RADIUS_PX, prev: curr };
            dwellMap.set(person.id, state);
            return;
          }
          
          // Determine if position is SAME or MOVING
          const SAME = state.prev ? isSamePos(state.prev, curr) : true;
          
          if (SAME) {
            // GROW: always increase radius (unbounded)
            state.ringRadiusPx += GROW_RADIUS_PER_SEC * dtSec;
          } else {
            // MOVE: snap back to default immediately
            state.ringRadiusPx = DEFAULT_RADIUS_PX;
          }
          
          state.prev = curr;
        });
        
        // Remove states for people no longer visible
        const visibleIds = new Set(activePeople.map(p => p.id));
        Array.from(dwellMap.keys()).forEach(id => {
          if (!visibleIds.has(id)) {
            dwellMap.delete(id);
          }
        });
        
        // Debug logging (once per second)
        debugTimer += dtSec;
        if (debugTimer >= 1) {
          const p01 = activePeople.find(p => p.id === 'P01');
          if (p01) {
            const s = dwellMap.get('P01');
            if (s && s.prev) {
              const curr = { angleDeg: p01.currentAngleDeg, radiusFactor: p01.currentRadiusFactor };
              const same = isSamePos(s.prev, curr);
              console.log('[Dwell] P01', {
                ring: s.ringRadiusPx.toFixed(2),
                same: same,
                dAng: Math.abs(shortestAngularDelta(s.prev.angleDeg, curr.angleDeg)).toFixed(3),
                dRad: Math.abs(s.prev.radiusFactor - curr.radiusFactor).toFixed(4)
              });
            }
          }
          debugTimer = 0;
        }
        
        // Force re-render
        forceUpdate({});
      }
      
      rafId = requestAnimationFrame(loop);
    }
    
    if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
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
              
              const state = dwellMap.get(person.id);
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
