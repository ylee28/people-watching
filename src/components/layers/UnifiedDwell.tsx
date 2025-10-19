import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  ringRadiusPx: number;
  dwellSec: number; // accumulate time while STILL
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
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

// Module-level persistent state (survives renders)
const dwellMap = new Map<string, DwellState>();
let rafId: number | null = null;
let lastTime = performance.now();
let debugTimer = 0;

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow when the CSV keyframe interval shows no position change
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - interval-based detection
  React.useEffect(() => {
    function loop(now = performance.now()) {
      const dtSec = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        // Update all dwell states
        const activePeople = peopleAtTime.filter(p => p.isVisible);
        
        activePeople.forEach((person) => {
          // Check for exit
          const isExiting = person.currentRadiusFactor > 1.0;
          if (isExiting) {
            const state = dwellMap.get(person.id);
            if (state) {
              state.ringRadiusPx = DEFAULT_RADIUS_PX;
              state.dwellSec = 0;
            }
            return;
          }
          
          // Get or create state
          let state = dwellMap.get(person.id);
          if (!state) {
            state = { ringRadiusPx: DEFAULT_RADIUS_PX, dwellSec: 0 };
            dwellMap.set(person.id, state);
          }
          
          // Determine if the INTERVAL is STILL or MOVING
          // Compare the current CSV keyframe to the next CSV keyframe
          let intervalStill = false;
          
          if (csvPositions) {
            const samples = csvPositions[person.id];
            if (samples && samples.length > 0) {
              // Find bracketing samples A (current interval) and B (next interval)
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
                
                // INTERVAL_STILL: current keyframe == next keyframe
                intervalStill = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
              }
            }
          }
          
          if (intervalStill) {
            // STILL: position same in current and next interval → GROW
            state.dwellSec += dtSec;
            state.ringRadiusPx = DEFAULT_RADIUS_PX + GROW_RADIUS_PER_SEC * state.dwellSec;
          } else {
            // MOVING: position different in current vs next interval → snap to default
            state.ringRadiusPx = DEFAULT_RADIUS_PX;
            state.dwellSec = 0;
          }
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
          if (p01 && csvPositions) {
            const samples = csvPositions['P01'];
            if (samples && samples.length > 0) {
              let sampleA = null, sampleB = null;
              for (let i = 0; i < samples.length - 1; i++) {
                if (samples[i].tSec <= timeSec && samples[i + 1].tSec > timeSec) {
                  sampleA = samples[i];
                  sampleB = samples[i + 1];
                  break;
                }
              }
              const s = dwellMap.get('P01');
              if (s && sampleA && sampleB) {
                const dAng = Math.abs(shortestAngularDelta(sampleA.angleDeg ?? 0, sampleB.angleDeg ?? 0));
                const dRad = Math.abs((sampleA.radiusFactor ?? 0) - (sampleB.radiusFactor ?? 0));
                const still = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
                console.log('[Dwell] P01', {
                  ring: s.ringRadiusPx.toFixed(2),
                  intervalStill: still,
                  dAng: dAng.toFixed(3),
                  dRad: dRad.toFixed(4),
                  tA: sampleA.tSec,
                  tB: sampleB.tSec
                });
              }
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
