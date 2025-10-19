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
  tween?: { from: number; to: number; t: number; dur: number };
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
  
  const [dwellStates, setDwellStates] = React.useState<Map<string, DwellState>>(new Map());
  const prevTimeRef = React.useRef<number>(0);
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Use requestAnimationFrame for smooth animations
  React.useEffect(() => {
    const animate = (now: number) => {
      const dtSec = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        setDwellStates((prev) => {
          const next = new Map(prev);
          
          peopleAtTime
            .filter((person) => person.isVisible)
            .forEach((person) => {
              const state = next.get(person.id) || {
                dwellSec: 0,
                ringPx: DOT_PX
              };
              
              // Determine if the current interval is STILL or MOVING
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
              
              let newState = { ...state };
              
              if (isExiting) {
                // Exiting: shrink to 0 with tween
                newState.dwellSec = 0;
                if (!newState.tween || newState.tween.to !== 0) {
                  newState.tween = { from: newState.ringPx, to: 0, t: 0, dur: 0.12 };
                }
                if (newState.tween) {
                  newState.tween.t = Math.min(newState.tween.t + dtSec, newState.tween.dur);
                  const k = newState.tween.t / newState.tween.dur;
                  const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
                  newState.ringPx = newState.tween.from + (newState.tween.to - newState.tween.from) * e;
                }
              } else if (!intervalStill) {
                // INTERVAL_MOVING: start/maintain shrink tween to DOT_PX
                newState.dwellSec = 0;
                if (!newState.tween || newState.tween.to !== DOT_PX) {
                  newState.tween = { from: newState.ringPx, to: DOT_PX, t: 0, dur: 0.12 };
                }
                if (newState.tween) {
                  newState.tween.t = Math.min(newState.tween.t + dtSec, newState.tween.dur);
                  const k = newState.tween.t / newState.tween.dur;
                  const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
                  newState.ringPx = newState.tween.from + (newState.tween.to - newState.tween.from) * e;
                }
              } else {
                // INTERVAL_STILL: cancel tween and grow without bound
                newState.tween = undefined;
                newState.dwellSec += dtSec;
                const target = DOT_PX + GROWTH_RATE_PX_PER_SEC * newState.dwellSec;
                // Light smoothing to prevent jitter
                newState.ringPx += (target - newState.ringPx) * 0.3;
              }
              
              next.set(person.id, newState);
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

  // Reset on time jump
  React.useEffect(() => {
    const dt = timeSec - prevTimeRef.current;
    prevTimeRef.current = timeSec;
    
    if (dt <= 0 || dt > 1) {
      // Reset on time jump
      setDwellStates(new Map());
    }
  }, [timeSec]);

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
              
              const state = dwellStates.get(person.id);
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
