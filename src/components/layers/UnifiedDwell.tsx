import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  ringDiameterPx: number;
  lastIntervalKey?: string;
}

const DEFAULT_DIAM_PX = 5;
const GROW_DIAM_PER_SEC = 3; // +3px diameter/sec = +1.5px radius/sec
const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor

/**
 * Calculate shortest angular distance (wrap-aware)
 */
function shortestAngularDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180; // (-180, 180]
}

// Module-level persistent state (survives renders)
const dwellStore = new Map<string, DwellState>();
let rafId: number | null = null;
let lastNow = performance.now();
let debugTimer = 0;

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow at +3px diameter/sec when keyframe A == keyframe B (INTERVAL_STILL)
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop - interval-based detection (A vs B keyframes)
  React.useEffect(() => {
    function loop(now = performance.now()) {
      const dtSec = Math.max(0, (now - lastNow) / 1000);
      lastNow = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        // Update all dwell states
        const activePeople = peopleAtTime.filter(p => p.isVisible);
        
        activePeople.forEach((person) => {
          // Check for exit
          const isExiting = person.currentRadiusFactor > 1.0;
          if (isExiting) {
            const state = dwellStore.get(person.id);
            if (state) {
              state.ringDiameterPx = DEFAULT_DIAM_PX;
            }
            return;
          }
          
          // Get bracketing CSV samples A and B
          if (!csvPositions) return;
          
          const samples = csvPositions[person.id];
          if (!samples || samples.length === 0) return;
          
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
          
          if (!sampleA || !sampleB) return;
          
          const tA = sampleA.tSec;
          const tB = sampleB.tSec;
          const intervalKey = `${tA}-${tB}`;
          
          const aA = sampleA.angleDeg ?? 0;
          const rA = sampleA.radiusFactor ?? 0;
          const aB = sampleB.angleDeg ?? 0;
          const rB = sampleB.radiusFactor ?? 0;
          
          const dAng = Math.abs(shortestAngularDelta(aA, aB));
          const dRad = Math.abs(rB - rA);
          
          const INTERVAL_STILL = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
          
          // Get or create state
          let state = dwellStore.get(person.id);
          if (!state) {
            state = { ringDiameterPx: DEFAULT_DIAM_PX };
            dwellStore.set(person.id, state);
          }
          
          // Reset ring when interval changes and moving
          if (state.lastIntervalKey !== intervalKey && !INTERVAL_STILL) {
            state.ringDiameterPx = DEFAULT_DIAM_PX;
          }
          state.lastIntervalKey = intervalKey;
          
          if (INTERVAL_STILL) {
            // STILL: A == B → grow continuously for entire interval
            state.ringDiameterPx += GROW_DIAM_PER_SEC * dtSec;
          } else {
            // MOVING: A != B → snap to default for entire interval
            state.ringDiameterPx = DEFAULT_DIAM_PX;
          }
        });
        
        // Remove states for people no longer visible
        const visibleIds = new Set(activePeople.map(p => p.id));
        Array.from(dwellStore.keys()).forEach(id => {
          if (!visibleIds.has(id)) {
            dwellStore.delete(id);
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
              const s = dwellStore.get('P01');
              if (s && sampleA && sampleB) {
                const dAng = Math.abs(shortestAngularDelta(sampleA.angleDeg ?? 0, sampleB.angleDeg ?? 0));
                const dRad = Math.abs((sampleA.radiusFactor ?? 0) - (sampleB.radiusFactor ?? 0));
                const still = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
                console.log('[Dwell] P01', {
                  diameter: s.ringDiameterPx.toFixed(2),
                  INTERVAL_STILL: still,
                  dAng: dAng.toFixed(3),
                  dRad: dRad.toFixed(4),
                  interval: `${sampleA.tSec}-${sampleB.tSec}`
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
              
              const state = dwellStore.get(person.id);
              const ringDiameter = state?.ringDiameterPx || DEFAULT_DIAM_PX;
              const ringRadius = ringDiameter / 2;

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
