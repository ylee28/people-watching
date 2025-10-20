import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== CONSTANTS (SPEC-LOCKED) ======

const DWELL_DEFAULT_DIAM = 10;   // px (MOVING baseline)
const DWELL_GROW_PS      = 1;    // px/s when STILL (changed from 10)
const DWELL_STROKE       = 2;

// ====== PERSISTENT STATE (MODULE SCOPE - SINGLE SOURCE OF TRUTH) ======
type DwellState = { lastKey?: string; diamPx: number };
const dwell = new Map<string, DwellState>();

function getDwell(id: string): DwellState {
  let s = dwell.get(id);
  if (!s) { 
    s = { diamPx: DWELL_DEFAULT_DIAM }; 
    dwell.set(id, s); 
  }
  return s;
}

// ====== MOTION SCHEDULE (JSON-BASED) ======
type MotionInterval = { 
  interval: string; 
  tA: number; 
  tB: number; 
  STILL: string[]; 
  MOVING: string[] 
};
type MotionSchedule = { motionSchedule: MotionInterval[] };

let motionSchedule: MotionInterval[] | null = null;
const canonicalId = (id: string) => String(id).trim().toUpperCase();

/**
 * getInterval: Find current interval for timeSec using [tA, tB) logic.
 */
function getInterval(timeSec: number): MotionInterval | null {
  if (!motionSchedule || motionSchedule.length === 0) return null;
  for (const iv of motionSchedule) {
    if (timeSec >= iv.tA && timeSec < iv.tB) return iv;
  }
  // Clamp to last interval if beyond
  return motionSchedule[motionSchedule.length - 1];
}

/**
 * isStill: Check if personId is in STILL list for current interval.
 * personId is already canonical, schedule lists are canonical after load.
 */
function isStill(personId: string, interval: MotionInterval | null): boolean {
  if (!interval) return false;
  return interval.STILL.includes(personId); // Simple lookup, both sides canonical
}

/**
 * updateDwell: ONLY place that changes ring size.
 * Called every rAF with timeSec and dtSec.
 */
function updateDwell(personId: string, timeSec: number, dtSec: number) {
  const iv = getInterval(timeSec);
  if (!iv) return;

  const key = `${iv.tA}-${iv.tB}`;
  const s = getDwell(personId);
  const still = isStill(personId, iv);

  // Reset ONLY when entering a MOVING window
  if (s.lastKey !== key) {
    s.lastKey = key;
    if (!still) {
      s.diamPx = DWELL_DEFAULT_DIAM;
    }
  }

  // Apply rule
  if (still) {
    s.diamPx += DWELL_GROW_PS * dtSec;
  } else {
    s.diamPx = DWELL_DEFAULT_DIAM;
  }

  // Draw (SVG circle uses RADIUS = diameter / 2)
  const r = s.diamPx / 2;
  const el = document.getElementById(`dwell-ring-${personId}`);
  
  if (el) {
    el.setAttribute('r', String(r));
    el.setAttribute('stroke-width', String(DWELL_STROKE));
    el.setAttribute('fill', 'none');
    el.setAttribute('vector-effect', 'non-scaling-stroke');
  }
}

// ====== RAF LOOP (DEDICATED UPDATER) ======
let rafId: number | null = null;
let _lastNow = performance.now();
let _secAccum = 0;

function rafTick() {
  const now = performance.now();
  const dtSec = Math.max(0, (now - _lastNow) / 1000);
  _lastNow = now;
  _secAccum += dtSec;

  const { timeSec, peopleAtTime } = usePeoplePlaybackStore.getState();

  // Don't run until schedule is ready
  if (!motionSchedule) {
    rafId = requestAnimationFrame(rafTick);
    return;
  }

  // ✅ Correct: iterate the array, keep only visible, pass CANONICAL ids
  const ids = (Array.isArray(peopleAtTime) ? peopleAtTime : Object.values(peopleAtTime))
    .filter((p: any) => p?.isVisible !== false)
    .map((p: any) => canonicalId(p.id));

  ids.forEach(id => updateDwell(id, timeSec, dtSec));

  rafId = requestAnimationFrame(rafTick);
}

function startDwellLoop() {
  if (rafId !== null) return;
  _lastNow = performance.now();
  _secAccum = 0;
  rafId = requestAnimationFrame(rafTick);
}

function stopDwellLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ====== REACT COMPONENT ======
interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - JSON motion schedule driven with direct DOM updates.
 * Shows growing rings around stationary people (STILL state).
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Load motion schedule from JSON (once)
  React.useEffect(() => {
    fetch('/data/motion_schedule.json')
      .then(res => res.json())
      .then((data: MotionSchedule) => {
        // Canonicalize IDs inside STILL/MOVING lists once
        motionSchedule = data.motionSchedule.map(iv => ({
          ...iv,
          STILL: iv.STILL.map(canonicalId),
          MOVING: iv.MOVING.map(canonicalId),
        }));
      })
      .catch(err => console.error('Failed to load motion schedule:', err));
  }, []);

  // Start/stop dedicated rAF loop
  React.useEffect(() => {
    startDwellLoop();
    return () => stopDwellLoop();
  }, []);

  // Runtime cleanup of any stray debug elements
  React.useEffect(() => {
    document.querySelectorAll('#dwell-probe, .dwell-probe').forEach(n => n.remove());
    (window as any).DEBUG_DWELL = false;
  }, []);

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

              const canId = canonicalId(person.id);
              const state = getDwell(canId);
              const ringRadius = state.diamPx / 2; // Initial render (rAF will update)

              return (
                <circle
                  key={person.id}
                  id={`dwell-ring-${canId}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke="#CFBD94"
                  strokeWidth={DWELL_STROKE}
                  strokeOpacity={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};