import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  dwellSec: number;
  ringPx: number;
  shrinkTween?: { from: number; to: number; t: number; dur: number };
  lastSeenTick?: number;
}

const ANGLE_EPS = 0.5; // degrees (tight tolerance for CSV rounding)
const RADIUS_EPS = 0.002; // radiusFactor units
const DOT_PX = 6;
const GROWTH_RATE_PX_PER_SEC = 1.0;
// No max cap - rings grow unbounded while still

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
 * Rings grow during flat CSV intervals, snap to dot during movement
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  
  // Persistent state that survives renders
  const dwellStatesRef = React.useRef<Map<string, DwellState>>(new Map());
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  const prevTimeSecRef = React.useRef<number>(0);
  const [, forceUpdate] = React.useState({});
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Reset on time jump (rewind)
  React.useEffect(() => {
    const dt = timeSec - prevTimeSecRef.current;
    if (dt <= 0 || dt > 1) {
      // Time jumped backwards or skipped - reset all states
      dwellStatesRef.current.clear();
      forceUpdate({});
    }
    prevTimeSecRef.current = timeSec;
  }, [timeSec]);

  // Main animation loop
  React.useEffect(() => {
    const animate = (now: number) => {
      const dtSec = Math.max(0, (now - lastFrameTimeRef.current) / 1000);
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
                dwellSec: 0,
                ringPx: DOT_PX
              };
              dwellStates.set(person.id, state);
            }
            
            // Determine if the current interval is STILL or MOVING
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
                  
                  intervalStill = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
                }
              }
            }
            
            // Check for exit
            const isExiting = person.currentRadiusFactor > 1.0;
            
            if (isExiting) {
              // Exiting: shrink to 0 with tween
              state.dwellSec = 0;
              if (!state.shrinkTween || state.shrinkTween.to !== 0) {
                state.shrinkTween = { from: state.ringPx, to: 0, t: 0, dur: 0.12 };
              }
              if (state.shrinkTween) {
                state.shrinkTween.t = Math.min(state.shrinkTween.t + dtSec, state.shrinkTween.dur);
                const k = state.shrinkTween.t / state.shrinkTween.dur;
                const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
                state.ringPx = state.shrinkTween.from + (state.shrinkTween.to - state.shrinkTween.from) * easeOutCubic(k);
              }
            } else if (!intervalStill) {
              // INTERVAL_MOVING: start/maintain shrink tween to DOT_PX
              state.dwellSec = 0;
              if (!state.shrinkTween || state.shrinkTween.to !== DOT_PX) {
                state.shrinkTween = { from: state.ringPx, to: DOT_PX, t: 0, dur: 0.12 };
              }
              if (state.shrinkTween) {
                state.shrinkTween.t = Math.min(state.shrinkTween.t + dtSec, state.shrinkTween.dur);
                const k = state.shrinkTween.t / state.shrinkTween.dur;
                const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
                state.ringPx = state.shrinkTween.from + (state.shrinkTween.to - state.shrinkTween.from) * easeOutCubic(k);
              }
            } else {
              // INTERVAL_STILL: cancel tween and grow without bound
              state.shrinkTween = undefined;
              state.dwellSec += dtSec;
              const target = DOT_PX + GROWTH_RATE_PX_PER_SEC * state.dwellSec; // unlimited growth
              // Light smoothing to prevent jitter
              state.ringPx += (target - state.ringPx) * 0.3;
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
  }, [timeSec, peopleAtTime, csvPositions]);

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
