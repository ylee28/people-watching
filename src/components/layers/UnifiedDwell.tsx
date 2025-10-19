import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedDwellProps {
  size?: number;
}

interface DwellState {
  intervalKey?: string;
  ringDiameterPx: number;
}

type CSVSample = {
  tSec: number;
  angleDeg?: number;
  radiusFactor?: number;
  motion?: string;
};

const DWELL_DEFAULT_DIAMETER_PX = 10;
const DWELL_GROW_DIAM_PER_SEC = 10; // +10px diameter per second
const STROKE_WIDTH_PX = 2;

// Module-level persistent state
const dwellState = new Map<string, DwellState>();

// rAF loop state
let rafId: number | null = null;
let lastFrameTime = performance.now();

/**
 * Get interval motion for a person at a given time
 */
function getIntervalMotion(
  personId: string,
  timeSec: number,
  csvPositions: Record<string, CSVSample[]> | null
): { tA: number; tB: number; motion: 'STILL' | 'MOVING' } | null {
  if (!csvPositions) return null;
  const samples = csvPositions[personId];
  if (!samples || samples.length < 2) return null;

  // Find the current interval [tA, tB) where tA <= timeSec < tB
  for (let i = 0; i < samples.length - 1; i++) {
    const tA = samples[i].tSec;
    const tB = samples[i + 1].tSec;
    
    if (tA <= timeSec && timeSec < tB) {
      // Read motion from the sample at tA
      const motion = samples[i].motion;
      
      // If motion is missing or blank, treat as MOVING
      if (!motion || motion === '') {
        return { tA, tB, motion: 'MOVING' };
      }
      
      return {
        tA,
        tB,
        motion: motion === 'STILL' ? 'STILL' : 'MOVING'
      };
    }
  }

  // Beyond last interval
  return null;
}

/**
 * Update dwell for one person
 */
function updateDwell(
  personId: string,
  timeSec: number,
  dtSec: number,
  csvPositions: Record<string, CSVSample[]> | null
): void {
  const im = getIntervalMotion(personId, timeSec, csvPositions);
  if (!im) return;

  const key = `${im.tA}-${im.tB}`;
  let s = dwellState.get(personId);
  
  if (!s) {
    s = { ringDiameterPx: DWELL_DEFAULT_DIAMETER_PX };
  }

  // If we entered a new interval, reset to default diameter if STILL
  if (s.intervalKey !== key) {
    s.intervalKey = key;
    if (im.motion === 'STILL') {
      s.ringDiameterPx = DWELL_DEFAULT_DIAMETER_PX;
    }
  }

  // Apply growth if STILL, hold size if MOVING
  if (im.motion === 'STILL') {
    s.ringDiameterPx += DWELL_GROW_DIAM_PER_SEC * dtSec;
  }
  // MOVING: maintain current size (no change)

  dwellState.set(personId, s);
}

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Rings grow at +10px diameter/sec when motion=STILL, hold size when motion=MOVING
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  const [, forceUpdate] = React.useState({});

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Main animation loop
  React.useEffect(() => {
    function frame(now = performance.now()) {
      const dtSec = Math.max(0, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (dtSec > 0 && dtSec < 0.1) {
        // Update all dwell states
        const activePeople = peopleAtTime.filter(
          (p) => p.isVisible && p.currentRadiusFactor <= 1.0
        );

        activePeople.forEach((person) => {
          updateDwell(person.id, timeSec, dtSec, csvPositions);
        });

        // Remove states for people no longer visible
        const visibleIds = new Set(activePeople.map((p) => p.id));
        Array.from(dwellState.keys()).forEach((id) => {
          if (!visibleIds.has(id)) {
            dwellState.delete(id);
          }
        });

        // Force re-render
        forceUpdate({});
      }

      rafId = requestAnimationFrame(frame);
    }

    if (!rafId) {
      rafId = requestAnimationFrame(frame);
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

              const state = dwellState.get(person.id);
              const ringDiameter = state?.ringDiameterPx || DWELL_DEFAULT_DIAMETER_PX;
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
                  strokeWidth={STROKE_WIDTH_PX}
                  strokeOpacity="0.9"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};
