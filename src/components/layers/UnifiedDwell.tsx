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

type Sample = { tSec: number; angleDeg?: number; radiusFactor?: number; motion?: string };

const DEFAULT_DIAM_PX = 5;
const GROW_DIAM_PER_SEC = 3; // +3px diameter/sec
const ANGLE_EPS = 0.5; // degrees
const RADIUS_EPS = 0.002; // radiusFactor

/**
 * Calculate shortest angular distance (wrap-aware)
 */
function shortestAngularDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180; // (-180, 180]
}

/**
 * Get bracketing samples A and B for current time
 */
function getAB(
  personId: string,
  tSec: number,
  csvPositions: Record<string, Sample[]> | null
): { A?: Sample; B?: Sample } {
  if (!csvPositions) return {};
  const arr = csvPositions[personId];
  if (!arr || arr.length < 2) return {};

  let A: Sample | undefined, B: Sample | undefined;
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1];
    if (a.tSec <= tSec && tSec <= b.tSec) {
      A = a;
      B = b;
      break;
    }
  }
  // If beyond last sample, use the last pair
  if (!A && arr.length >= 2) {
    A = arr[arr.length - 2];
    B = arr[arr.length - 1];
  }
  return { A, B };
}

// Module-level persistent state (survives renders)
const dwellMap = new Map<string, DwellState>();

function getDwell(personId: string): DwellState {
  let s = dwellMap.get(personId);
  if (!s) {
    s = { ringDiameterPx: DEFAULT_DIAM_PX };
    dwellMap.set(personId, s);
  }
  return s;
}

// rAF loop state
let rafId: number | null = null;
let lastFrameTime = performance.now();
let debugTimer = 0;

/**
 * Update dwell for one person (interval-based: grow when A==B, snap when A!=B)
 */
function updateDwellForPerson(
  personId: string,
  tSec: number,
  dtSec: number,
  csvPositions: Record<string, Sample[]> | null
): void {
  const s = getDwell(personId);
  const { A, B } = getAB(personId, tSec, csvPositions);
  if (!A || !B) return;

  const intervalKey = `${A.tSec}-${B.tSec}`;

  // Check if motion column is present and not blank
  let INTERVAL_STILL: boolean;
  
  if (A.motion && A.motion !== '') {
    // Use explicit motion column if present
    INTERVAL_STILL = A.motion === 'STILL';
  } else {
    // Fall back to comparing angleDeg/radiusFactor with tolerances
    const aA = A.angleDeg ?? 0;
    const rA = A.radiusFactor ?? 0;
    const aB = B.angleDeg ?? 0;
    const rB = B.radiusFactor ?? 0;

    const dAng = Math.abs(shortestAngularDelta(aA, aB));
    const dRad = Math.abs(rB - rA);
    INTERVAL_STILL = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
  }

  // If we just entered a new MOVING interval, reset diameter to default
  if (s.lastIntervalKey !== intervalKey && !INTERVAL_STILL) {
    s.ringDiameterPx = DEFAULT_DIAM_PX;
  }
  s.lastIntervalKey = intervalKey;

  if (INTERVAL_STILL) {
    // Grow +3px/sec over this entire interval (unbounded)
    s.ringDiameterPx += GROW_DIAM_PER_SEC * dtSec;
  } else {
    // MOVING: hold at default for entire interval
    s.ringDiameterPx = DEFAULT_DIAM_PX;
  }
}

/**
 * Debug logging (once per second for P01)
 */
function debugDwell(dtSec: number, tSec: number, csvPositions: Record<string, Sample[]> | null): void {
  debugTimer += dtSec;
  if (debugTimer < 1) return;
  debugTimer = 0;

  const { A, B } = getAB('P01', tSec, csvPositions);
  const d = dwellMap.get('P01');
  if (A && B && d) {
    const aA = A.angleDeg ?? 0;
    const rA = A.radiusFactor ?? 0;
    const aB = B.angleDeg ?? 0;
    const rB = B.radiusFactor ?? 0;

    const dAng = Math.abs(shortestAngularDelta(aA, aB));
    const dRad = Math.abs(rB - rA);
    
    let still: boolean;
    let motionSource: string;
    
    if (A.motion && A.motion !== '') {
      still = A.motion === 'STILL';
      motionSource = `motion=${A.motion}`;
    } else {
      still = dAng <= ANGLE_EPS && dRad <= RADIUS_EPS;
      motionSource = 'calculated';
    }

    console.log('[Dwell][P01]', {
      tSec: tSec.toFixed(1),
      dAng: dAng.toFixed(3),
      dRad: dRad.toFixed(4),
      still: still,
      motionSource: motionSource,
      diameter: d.ringDiameterPx.toFixed(2),
      interval: `${A.tSec}-${B.tSec}`,
      angles: `${aA.toFixed(1)} → ${aB.toFixed(1)}`,
      radii: `${rA.toFixed(3)} → ${rB.toFixed(3)}`
    });
  }
}

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

  // Main animation loop - use real frame delta from performance.now()
  React.useEffect(() => {
    function frame(now = performance.now()) {
      const dtSec = Math.max(0, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (dtSec > 0 && dtSec < 0.1) {
        // Update all dwell states
        const activePeople = peopleAtTime.filter(p => p.isVisible && p.currentRadiusFactor <= 1.0);

        activePeople.forEach((person) => {
          updateDwellForPerson(person.id, timeSec, dtSec, csvPositions);
        });

        // Remove states for people no longer visible
        const visibleIds = new Set(activePeople.map(p => p.id));
        Array.from(dwellMap.keys()).forEach(id => {
          if (!visibleIds.has(id)) {
            dwellMap.delete(id);
          }
        });

        // Debug logging
        debugDwell(dtSec, timeSec, csvPositions);

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

              const state = dwellMap.get(person.id);
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
