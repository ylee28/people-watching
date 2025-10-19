import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG SWITCH ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => { if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...a); };

// ====== CONSTANTS ======
const DWELL_DEFAULT_DIAM_PX = 10;  // visible size during MOVING
const DWELL_GROW_DIAM_PER_SEC = 10;  // +10px diameter per second while STILL
const DWELL_STROKE_WIDTH = 2;

// ====== STATE (PERSISTENT; NOT PER-RENDER) ======
type CSVRow = { tSec: number; motion?: string; angleDeg?: number; radiusFactor?: number; bench?: string };
type IntervalMotion = { tA: number; tB: number; motion: 'STILL' | 'MOVING' };
type DwellState = { intervalKey?: string; ringDiameterPx: number; };

const dwellStates = new Map<string, DwellState>();

function getDwell(personId: string): DwellState {
  let s = dwellStates.get(personId);
  if (!s) { s = { ringDiameterPx: DWELL_DEFAULT_DIAM_PX }; dwellStates.set(personId, s); }
  return s;
}

function normalizeMotion(m?: string): 'STILL' | 'MOVING' {
  if (!m) return 'MOVING';
  const v = m.trim().toUpperCase();
  return v === 'STILL' ? 'STILL' : 'MOVING';
}

// ====== CSV READY + NORMALIZE ======
let csvNormalized = false;

function assertCsvReady(csvPositions: Record<string, CSVRow[]> | null) {
  if (!csvPositions) { dlog('csvPositions is NULL'); return false; }
  const keys = Object.keys(csvPositions);
  if (keys.length === 0) { dlog('csvPositions has NO KEYS'); return false; }
  
  // normalize & sort once
  if (!csvNormalized) {
    keys.forEach(k => {
      const arr = csvPositions[k] || [];
      arr.sort((a, b) => (a.tSec || 0) - (b.tSec || 0));
      arr.forEach(r => r.motion = normalizeMotion(r.motion));
    });
    dlog('csvPositions normalized. Keys sample:', keys.slice(0, 8).map(k => `${k}:${csvPositions[k]?.length || 0}`));
    csvNormalized = true;
  }
  return true;
}

// ====== INTERVAL LOOKUP (value at t applies to [t, nextT) ) ======
function getIntervalMotion(
  personId: string,
  timeSec: number,
  csvPositions: Record<string, CSVRow[]> | null
): IntervalMotion | null {
  if (!csvPositions) { dlog('IM: csvPositions null'); return null; }
  const samples = csvPositions[personId];
  if (!samples) { dlog('IM: no samples for', personId); return null; }
  if (samples.length < 2) { dlog('IM: too few samples for', personId, samples.length); return null; }

  if (timeSec < samples[0].tSec) {
    const A = samples[0], B = samples[1];
    const motion = normalizeMotion(A.motion);
    if (personId === 'P01') dlog('IM<first', { timeSec, interval: `${A.tSec}-${B.tSec}`, motion });
    return { tA: A.tSec, tB: B.tSec, motion };
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const A = samples[i], B = samples[i + 1];
    if (timeSec >= A.tSec && timeSec < B.tSec) {
      const motion = normalizeMotion(A.motion);
      if (personId === 'P01') dlog('IM', { timeSec: timeSec.toFixed(2), interval: `${A.tSec}-${B.tSec}`, motion });
      return { tA: A.tSec, tB: B.tSec, motion };
    }
  }
  const A = samples[samples.length - 2], B = samples[samples.length - 1];
  const motion = normalizeMotion(A.motion);
  if (personId === 'P01') dlog('IM>last', { timeSec, interval: `${A.tSec}-${B.tSec}`, motion });
  return { tA: A.tSec, tB: B.tSec, motion };
}

// ====== DWELL UPDATE (GROW ON STILL, HOLD 10PX ON MOVING) ======
function updateDwellForPerson(
  personId: string,
  timeSec: number,
  dtSec: number,
  csvPositions: Record<string, CSVRow[]> | null
) {
  const im = getIntervalMotion(personId, timeSec, csvPositions);
  if (!im) return;

  const key = `${im.tA}-${im.tB}`;
  const s = getDwell(personId);

  if (s.intervalKey !== key) {
    s.intervalKey = key;
    if (im.motion === 'MOVING') s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX; // reset on moving window
    if (personId === 'P01') dlog('ENTER interval', { key, motion: im.motion, diam: s.ringDiameterPx.toFixed(1) });
  }

  // Apply rule
  if (im.motion === 'STILL') {
    s.ringDiameterPx += DWELL_GROW_DIAM_PER_SEC * dtSec; // +10 px/s
    if (personId === 'P01') dlog('GROW', { diam: s.ringDiameterPx.toFixed(1) });
  } else {
    s.ringDiameterPx = DWELL_DEFAULT_DIAM_PX;
  }

  if (personId === 'P01') dlog('State', { motion: im.motion, radius: (s.ringDiameterPx / 2).toFixed(1), diam: s.ringDiameterPx.toFixed(1) });
}

interface UnifiedDwellProps {
  size?: number;
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
    const probeEl = document.createElement('div');
    probeEl.id = 'dwell-probe';
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.6);color:#fff;padding:8px 10px;border-radius:6px;font:12px/1.3 system-ui;pointer-events:none;z-index:9999';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
    };
  }, []);

  // ====== START LOOP AFTER CSV IS LOADED ======
  React.useEffect(() => {
    let rafId: number | null = null;
    let last = performance.now();
    let secAccum = 0;
    let probeAccum = 0;

    const step = () => {
      const now = performance.now();
      const dtSec = Math.max(0, (now - last) / 1000);
      last = now;

      if (!csvPositions || !assertCsvReady(csvPositions)) {
        rafId = requestAnimationFrame(step);
        return;
      }

      secAccum += dtSec;
      if (secAccum >= 1 && (window as any).DEBUG_DWELL) { 
        dlog('dtSec~1s total =', secAccum.toFixed(3)); 
        secAccum = 0; 
      }

      // Update ALL people from CSV (not filtered by peopleAtTime)
      const ids = Object.keys(csvPositions);
      if (ids.length && (window as any).DEBUG_DWELL && secAccum === 0) {
        dlog('ACTIVE ids from CSV:', ids.slice(0, 9));
      }

      for (const id of ids) {
        updateDwellForPerson(id, timeSec, dtSec, csvPositions);
      }

      // Update visual probe
      probeAccum += dtSec;
      if (probeAccum >= 0.25) {
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

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [timeSec, csvPositions]);

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

              return (
                <circle
                  key={person.id}
                  id={`dwell-ring-${person.id}`}
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
