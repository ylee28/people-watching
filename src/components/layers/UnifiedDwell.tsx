import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// === DEBUG SWITCH ===
(window as any).DEBUG_DWELL = true; // set to false to silence all logs

function dbg(...args: any[]) {
  if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...args);
}

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

const DWELL_DEFAULT_DIAM_PX = 10;   // diameter for MOVING intervals
const DWELL_GROW_DIAM_PER_SEC = 10; // +10px/sec while STILL
const DWELL_STROKE_WIDTH = 2;

// Module-level persistent state
const dwellState = new Map<string, DwellState>();

// rAF loop state
let rafId: number | null = null;
let lastFrameTime = performance.now();
let rafAccum = 0; // for periodic dtSec logging

/**
 * Normalize motion field to 'STILL' | 'MOVING'
 */
function normalizeMotion(m?: string): 'STILL' | 'MOVING' {
  if (!m) return 'MOVING';
  const v = m.trim().toUpperCase();
  return (v === 'STILL') ? 'STILL' : 'MOVING';
}

/**
 * Get or create dwell state for a person
 */
function getDwell(personId: string): DwellState {
  let s = dwellState.get(personId);
  if (!s) {
    s = { ringDiameterPx: DWELL_DEFAULT_DIAM_PX };
    dwellState.set(personId, s);
  }
  return s;
}

/**
 * Get interval motion for a person at a given time (with logging)
 */
function getIntervalMotion(
  personId: string,
  timeSec: number,
  csvPositions: Record<string, CSVSample[]> | null
): { tA: number; tB: number; motion: 'STILL' | 'MOVING' } | null {
  if (!csvPositions) {
    console.log('[DWELL] csvPositions is NULL');
    return null;
  }
  const samples = csvPositions[personId];
  if (!samples) {
    console.log('[DWELL] No samples for', personId);
    return null;
  }
  if (samples.length < 2) {
    console.log('[DWELL] samples.length < 2 for', personId, '(length:', samples.length, ')');
    return null;
  }

  // Find the current interval [tA, tB) where tA <= timeSec < tB
  for (let i = 0; i < samples.length - 1; i++) {
    const tA = samples[i].tSec;
    const tB = samples[i + 1].tSec;
    
    if (timeSec >= tA && timeSec < tB) {
      // Read motion from the sample at tA and normalize
      const motion = normalizeMotion(samples[i].motion);
      
      if ((window as any).DEBUG_DWELL && personId === 'P01') {
        console.log('[DWELL] motion=', motion, 'interval=', `${tA}-${tB}`, 'person=', personId, 'timeSec=', timeSec.toFixed(1));
      }
      
      return { tA, tB, motion };
    }
  }

  // Beyond last interval - use the last available interval
  if (samples.length >= 2) {
    const tA = samples[samples.length - 2].tSec;
    const tB = samples[samples.length - 1].tSec;
    const motion = normalizeMotion(samples[samples.length - 2].motion);
    
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      console.log('[DWELL] motion=', motion, 'interval(end)=', `${tA}-${tB}`, 'person=', personId, 'timeSec=', timeSec.toFixed(1));
    }
    
    return { tA, tB, motion };
  }

  return null;
}

/**
 * Update dwell for one person (with logging)
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
  const s = getDwell(personId);

  // On new interval, initialize baseline for MOVING; keep continuity across consecutive STILL intervals
  if (s.intervalKey !== key) {
    s.intervalKey = key;
    if (im.motion === 'MOVING') {
      s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX;
    }
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      dbg('Interval enter', personId, { key, motion: im.motion, startDiam: s.ringDiameterPx.toFixed(1) });
    }
  }

  // Apply per-interval rule
  if (im.motion === 'STILL') {
    const before = s.ringDiameterPx;
    s.ringDiameterPx += DWELL_GROW_DIAM_PER_SEC * dtSec; // unbounded growth
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      dbg('GROW', personId, { before: before.toFixed(1), after: s.ringDiameterPx.toFixed(1), dtSec: dtSec.toFixed(4) });
    }
  } else { // MOVING
    s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX;            // fixed size during MOVING
  }

  if ((window as any).DEBUG_DWELL && personId === 'P01' && Math.random() < 0.1) {
    dbg('State', personId, { motion: im.motion, diam: s.ringDiameterPx.toFixed(1), interval: key });
  }
}

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * MOVING → 10px diameter (fixed), STILL → grows +10px/sec (unbounded, continuous across STILL intervals)
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  const [, forceUpdate] = React.useState({});

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Create visual probe overlay (once)
  React.useEffect(() => {
    const probeId = 'P01';
    const probeEl = document.createElement('div');
    probeEl.id = 'dwell-probe';
    probeEl.style.position = 'fixed';
    probeEl.style.bottom = '16px';
    probeEl.style.left = '16px';
    probeEl.style.padding = '8px 10px';
    probeEl.style.background = 'rgba(0,0,0,0.6)';
    probeEl.style.color = '#fff';
    probeEl.style.font = '12px/1.3 system-ui, sans-serif';
    probeEl.style.borderRadius = '6px';
    probeEl.style.pointerEvents = 'none';
    probeEl.style.zIndex = '9999';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
    };
  }, []);

  // Main animation loop
  React.useEffect(() => {
    let probeAccum = 0;

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

        // rAF delta sanity check (log once per second)
        rafAccum += dtSec;
        if ((window as any).DEBUG_DWELL && rafAccum >= 1) {
          dbg('dtSec check (last ~1s sum):', rafAccum.toFixed(3));
          rafAccum = 0;
        }

        // Update visual probe
        probeAccum += dtSec;
        if (probeAccum >= 0.25) { // update 4x/sec
          probeAccum = 0;
          const probeEl = document.getElementById('dwell-probe');
          if (probeEl) {
            const im = getIntervalMotion('P01', timeSec, csvPositions);
            const s = dwellState.get('P01');
            if (im && s) {
              probeEl.textContent = `P01 — motion:${im.motion}  diam:${s.ringDiameterPx.toFixed(1)}  interval:${im.tA}-${im.tB}`;
            }
          }
        }

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
              const ringDiameter = state?.ringDiameterPx || DWELL_DEFAULT_DIAM_PX;
              const ringRadius = ringDiameter / 2;

              if (ringRadius <= 0) return null;

              // Debug: log P01 rendering
              if ((window as any).DEBUG_DWELL && person.id === 'P01' && Math.random() < 0.05) {
                console.log('[DWELL] Rendering P01: diameter=', ringDiameter.toFixed(1), 'radius=', ringRadius.toFixed(1));
              }

              return (
                <circle
                  key={person.id}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke={person.color}
                  strokeWidth={DWELL_STROKE_WIDTH}
                  strokeOpacity="0.9"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};
