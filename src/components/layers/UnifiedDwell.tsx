import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  ringRadiusPx: number;
  dwellSec: number; // track time spent still
}

const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor units
const DEFAULT_DIAMETER_PX = 5;
const DEFAULT_RADIUS_PX = DEFAULT_DIAMETER_PX / 2; // = 2.5px
const GROW_RADIUS_PER_SEC = 1.5; // +3px diameter per second = +1.5px radius per second

/**
 * Calculate shortest angular distance (wrap-aware)
 */
const shortestAngularDelta = (a: number, b: number): number => {
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow at 3px diameter/sec when position doesn't change, snap to 5px diameter when moving
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  
  // Persistent state that survives renders
  const dwellStatesRef = React.useRef<Map<string, DwellState>>(new Map());
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - interval-based detection
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
                ringRadiusPx: DEFAULT_RADIUS_PX,
                dwellSec: 0
              };
              dwellStates.set(person.id, state);
            }
            
            // Check for exit
            const isExiting = person.currentRadiusFactor > 1.0;
            
            if (isExiting) {
              // Exiting: snap to default
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              state.dwellSec = 0;
              return;
            }
            
            // Determine if the current INTERVAL is STILL or MOVING
            // Use bracketing CSV samples A and B
            let intervalStill = false;
            
            if (csvPositions) {
              const samples = csvPositions[person.id];
              if (samples && samples.length > 0) {
                // Find bracketing samples A and B
                let sampleA = null;
                let sampleB = null;
                
                for (let i = 0; i < samples.length - 1; i++) {
                  if (samples[i].tSec <= timeSec && samples[i + 1].tSec > timeSec) {
                    sampleA = samples[i];
                    sampleB = samples[i + 1];
                    break;
                  }
                }
                
                // If at or past last sample, use last sample as both A and B
                if (!sampleA && samples.length > 0) {
                  const lastSample = samples[samples.length - 1];
                  if (timeSec >= lastSample.tSec) {
                    sampleA = lastSample;
                    sampleB = lastSample;
                  }
                }
                
                if (sampleA && sampleB) {
                  const aA = sampleA.angleDeg ?? 0;
                  const rA = sampleA.radiusFactor ?? 0;
                  const aB = sampleB.angleDeg ?? 0;
                  const rB = sampleB.radiusFactor ?? 0;
                  
                  const dAng = Math.abs(shortestAngularDelta(aA, aB));
                  const dRad = Math.abs(rB - rA);
                  
                  // INTERVAL_STILL if the keyframes are identical
                  intervalStill = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
                }
              }
            }
            
            if (intervalStill) {
              // Position unchanged in this interval: grow unbounded
              state.dwellSec += dtSec;
              state.ringRadiusPx = DEFAULT_RADIUS_PX + GROW_RADIUS_PER_SEC * state.dwellSec;
            } else {
              // Position changing: snap back to default
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              state.dwellSec = 0;
            }
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
  }, [peopleAtTime, timeSec, csvPositions]);

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
