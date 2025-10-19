import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ==== 0) One switch to enable/disable logs ====
(window as any).DEBUG_DWELL = true;
function dlog(...args: any[]) { 
  if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...args); 
}

interface UnifiedDwellProps {
  size?: number;
}

type CSVSample = {
  tSec: number;
  angleDeg?: number;
  radiusFactor?: number;
  motion?: string;
  bench?: string;
};

type IntervalMotion = { 
  tA: number; 
  tB: number; 
  motion: 'STILL' | 'MOVING' 
};

const DWELL_DEFAULT_DIAM_PX = 10;   // diameter for MOVING intervals
const DWELL_GROW_DIAM_PER_SEC = 10; // +10px/sec while STILL
const DWELL_STROKE_WIDTH = 2;

type DwellState = { 
  intervalKey?: string; 
  ringDiameterPx: number 
};

const dwellStates = new Map<string, DwellState>();

// rAF loop state
let rafId: number | null = null;
let lastNow = performance.now();
let rafAccum = 0;
let csvReadinessChecked = false;

// ==== 1) Verify CSV is loaded and grouped properly ====
function assertCsvReady(csvPositions: Record<string, CSVSample[]> | null): boolean {
  if (!csvPositions) { 
    dlog('csvPositions is NULL'); 
    return false; 
  }
  const keys = Object.keys(csvPositions);
  if (keys.length === 0) { 
    dlog('csvPositions has NO KEYS'); 
    return false; 
  }
  // Print first few keys and counts
  const sample = keys.slice(0, 5).map(k => ({ 
    id: k, 
    rows: csvPositions[k]?.length || 0 
  }));
  dlog('csvPositions keys sample:', sample);
  
  // Sanity for a known ID like P01
  if (!csvPositions['P01']) {
    const found = keys.find(k => k.toUpperCase() === 'P01');
    dlog('P01 present?', !!csvPositions['P01'], 'Case-insensitive found?', !!found, 'Available IDs:', keys.slice(0, 10));
  }
  return true;
}

// Normalize motion field
function normalizeMotion(m?: string): 'STILL' | 'MOVING' {
  if (!m) return 'MOVING';
  const v = m.trim().toUpperCase();
  return v === 'STILL' ? 'STILL' : 'MOVING';
}

// Get or create dwell state
function getDwell(id: string): DwellState {
  let s = dwellStates.get(id);
  if (!s) { 
    s = { ringDiameterPx: DWELL_DEFAULT_DIAM_PX }; 
    dwellStates.set(id, s); 
  }
  return s;
}

// ==== 2) Hardened interval lookup (NEVER silently null) ====
function getIntervalMotion(
  personId: string,
  timeSec: number,
  csvPositions: Record<string, CSVSample[]> | null
): IntervalMotion | null {
  if (!csvPositions) { 
    dlog('getIntervalMotion: csvPositions null'); 
    return null; 
  }
  const samples = csvPositions[personId];
  if (!samples) { 
    dlog('getIntervalMotion: samples missing for', personId); 
    return null; 
  }
  if (samples.length < 2) { 
    dlog('getIntervalMotion: too few samples for', personId, samples.length); 
    return null; 
  }

  // if timeSec < first.tSec => clamp to first interval
  const first = samples[0], second = samples[1];
  if (timeSec < first.tSec) {
    const motion = normalizeMotion(first.motion);
    dlog('IM<first', personId, { timeSec, interval: `${first.tSec}-${second.tSec}`, motion });
    return { tA: first.tSec, tB: second.tSec, motion };
  }

  // in-between windows
  for (let i = 0; i < samples.length - 1; i++) {
    const tA = samples[i].tSec;
    const tB = samples[i + 1].tSec;
    // Strictly < tB on the right side
    if (timeSec >= tA && timeSec < tB) {
      const motion = normalizeMotion(samples[i].motion);
      if ((window as any).DEBUG_DWELL && personId === 'P01') {
        console.log('[DWELL] motion=', motion, 'interval=', `${tA}-${tB}`, 'person=', personId, 'timeSec=', timeSec.toFixed(2));
      }
      return { tA, tB, motion };
    }
  }

  // Beyond the last interval -> clamp to the last pair
  const preLast = samples[samples.length - 2];
  const last = samples[samples.length - 1];
  const motion = normalizeMotion(preLast.motion);
  dlog('IM>last', personId, { timeSec, interval: `${preLast.tSec}-${last.tSec}`, motion });
  return { tA: preLast.tSec, tB: last.tSec, motion };
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
  if (!im) {
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      dlog('NO-IM', personId, { timeSec });
    }
    return;
  }

  const key = `${im.tA}-${im.tB}`;
  const s = getDwell(personId);

  // On new interval, initialize baseline for MOVING; keep continuity across consecutive STILL intervals
  if (s.intervalKey !== key) {
    s.intervalKey = key;
    if (im.motion === 'MOVING') {
      s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX;
    }
    // If STILL: do not reset; continue growing across consecutive STILL intervals
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      dlog('ENTER interval', personId, { key, motion: im.motion, diam: s.ringDiameterPx.toFixed(1) });
    }
  }

  // Apply per-interval rule
  if (im.motion === 'STILL') {
    const before = s.ringDiameterPx;
    s.ringDiameterPx += DWELL_GROW_DIAM_PER_SEC * dtSec;
    if ((window as any).DEBUG_DWELL && personId === 'P01') {
      dlog('GROW', personId, { before: before.toFixed(1), after: s.ringDiameterPx.toFixed(1), dtSec: dtSec.toFixed(4) });
    }
  } else { // MOVING
    s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX;
  }

  if ((window as any).DEBUG_DWELL && personId === 'P01' && Math.random() < 0.1) {
    dlog('State', personId, { motion: im.motion, diam: s.ringDiameterPx.toFixed(1), interval: key });
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
      const dtSec = Math.max(0, (now - lastNow) / 1000);
      lastNow = now;

      // One-time CSV readiness check
      if (!csvReadinessChecked && csvPositions) {
        assertCsvReady(csvPositions);
        csvReadinessChecked = true;
      }

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
        Array.from(dwellStates.keys()).forEach((id) => {
          if (!visibleIds.has(id)) {
            dwellStates.delete(id);
          }
        });

        // rAF delta sanity check (log once per second)
        rafAccum += dtSec;
        if ((window as any).DEBUG_DWELL && rafAccum >= 1) {
          dlog('dtSec~1s total =', rafAccum.toFixed(3));
          rafAccum = 0;
        }

        // Update visual probe
        probeAccum += dtSec;
        if (probeAccum >= 0.25) { // update 4x/sec
          probeAccum = 0;
          const probeEl = document.getElementById('dwell-probe');
          if (probeEl) {
            const im = getIntervalMotion('P01', timeSec, csvPositions);
            const s = dwellStates.get('P01');
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

              const state = dwellStates.get(person.id);
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
