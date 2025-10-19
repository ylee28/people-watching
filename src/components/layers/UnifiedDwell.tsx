import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG SWITCH ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => { if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...a); };

// ====== CONSTANTS ======
const DWELL_DEFAULT_DIAM = 10;  // visible size during MOVING
const DWELL_GROW_DIAM_PER_SEC = 10;  // +10px diameter per second while STILL
const DWELL_STROKE_WIDTH = 2;
const INTERVAL_EPS = 1e-6; // Epsilon to avoid edge flicker at exact boundaries

// ====== TYPES ======
type CSVRow = { tSec: number; motion?: string; angleDeg?: number; radiusFactor?: number; bench?: string };
type Interval = { tA: number; tB: number; rowA: CSVRow; rowB: CSVRow; motion: 'STILL' | 'MOVING' };
type DwellState = { lastKey?: string; diamPx: number };

// ====== STATE (PERSISTENT) ======
const dwellStates = new Map<string, DwellState>();
let csvNormalized = false;

// ====== HELPERS ======
function normMotion(m?: string): 'STILL' | 'MOVING' {
  return (m && m.trim().toUpperCase() === 'STILL') ? 'STILL' : 'MOVING';
}

function assertCsvReady(csvPositions: Record<string, CSVRow[]> | null): boolean {
  if (!csvPositions) { dlog('csvPositions is NULL'); return false; }
  const keys = Object.keys(csvPositions);
  if (keys.length === 0) { dlog('csvPositions has NO KEYS'); return false; }
  
  // normalize & sort once
  if (!csvNormalized) {
    keys.forEach(k => {
      const arr = csvPositions[k] || [];
      arr.sort((a, b) => (a.tSec || 0) - (b.tSec || 0));
      arr.forEach(r => r.motion = normMotion(r.motion));
    });
    dlog('✅ CSV normalized. Keys:', keys.slice(0, 8).map(k => `${k}:${csvPositions[k]?.length || 0}`));
    csvNormalized = true;
  }
  return true;
}

/**
 * Unified interval lookup: maps timeSec → current CSV interval [tA, tB) for a person
 * The motion value at tA applies to the entire interval [tA, tB)
 */
function getInterval(personId: string, timeSec: number, map: Record<string, CSVRow[]> | null): Interval | null {
  if (!map) return null;
  const rows = map[personId];
  if (!rows || rows.length < 2) return null;

  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], B = rows[i + 1];
    if (timeSec + INTERVAL_EPS >= A.tSec && timeSec < B.tSec - INTERVAL_EPS) {
      return { tA: A.tSec, tB: B.tSec, rowA: A, rowB: B, motion: normMotion(A.motion) };
    }
  }
  
  // clamp before-first / after-last
  const A = rows[rows.length - 2], B = rows[rows.length - 1];
  return { tA: A.tSec, tB: B.tSec, rowA: A, rowB: B, motion: normMotion(A.motion) };
}

/**
 * Update dwell for one person
 * Default ring diameter = 10px
 * During MOVING interval: ring stays 10px
 * During STILL interval: ring grows +10px/sec (unbounded), continuing across consecutive STILL intervals
 */
function updateDwell(personId: string, timeSec: number, dtSec: number, map: Record<string, CSVRow[]> | null) {
  const iv = getInterval(personId, timeSec, map);
  if (!iv) return;
  
  const key = `${iv.tA}-${iv.tB}`;
  const s = dwellStates.get(personId) ?? { diamPx: DWELL_DEFAULT_DIAM };

  if (s.lastKey !== key) {
    s.lastKey = key;
    if (iv.motion === 'MOVING') s.diamPx = DWELL_DEFAULT_DIAM; // baseline on moving window
    // if STILL, do not reset; continue growth across STILL→STILL
    
    if (personId === 'P01') {
      dlog('🔄 ENTER interval', personId, { key, motion: iv.motion, diam: s.diamPx.toFixed(1) });
    }
  }

  // Apply rule
  if (iv.motion === 'STILL') {
    s.diamPx += DWELL_GROW_DIAM_PER_SEC * dtSec;
    if (personId === 'P01') {
      dlog('📈 GROW', personId, { diam: s.diamPx.toFixed(1), dtSec: dtSec.toFixed(4) });
    }
  } else {
    s.diamPx = DWELL_DEFAULT_DIAM;
  }

  dwellStates.set(personId, s);

  if (personId === 'P01' && Math.random() < 0.05) {
    dlog('🎯 State', personId, { motion: iv.motion, radius: (s.diamPx / 2).toFixed(1), diam: s.diamPx.toFixed(1), interval: key });
  }
}

interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * Unified with global timeSec: 10 seconds on timer = 1 CSV interval
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  const [, forceUpdate] = React.useState({});

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Setup dev helpers and visual probe
  React.useEffect(() => {
    // Dev helpers (global)
    (window as any).jumpTo = (t: number) => {
      const state = usePeoplePlaybackStore.getState();
      const clamped = Math.max(0, Math.min(state.durationSec ?? 0, t));
      usePeoplePlaybackStore.setState({ timeSec: clamped });
      console.log('[TIME] ⏭️  Jumped to', clamped, 'seconds');
    };
    (window as any).start = () => (window as any).jumpTo(0);
    (window as any).mid = () => (window as any).jumpTo(30);
    (window as any).end = () => (window as any).jumpTo(usePeoplePlaybackStore.getState().durationSec ?? 180);

    // Keyboard shortcut: R to rewind
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') (window as any).start();
    };
    window.addEventListener('keydown', handleKeydown);

    // Visual probe overlay
    const probeEl = document.createElement('div');
    probeEl.id = 'dwell-probe';
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.8);color:#0f0;padding:8px 12px;border-radius:6px;font:11px/1.4 "Courier New",monospace;pointer-events:none;z-index:9999;border:1px solid #0f0';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  // Main animation loop using global timeSec
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
        dlog('⏱️  dtSec~1s total =', secAccum.toFixed(3)); 
        secAccum = 0; 
      }

      // Update ALL people from CSV
      const ids = Object.keys(csvPositions);
      
      for (const id of ids) {
        updateDwell(id, timeSec, dtSec, csvPositions);
      }

      // Update visual probe
      probeAccum += dtSec;
      if (probeAccum >= 0.25) {
        probeAccum = 0;
        const probeEl = document.getElementById('dwell-probe');
        if (probeEl) {
          const iv = getInterval('P01', timeSec, csvPositions);
          const s = dwellStates.get('P01');
          if (iv && s) {
            const mm = Math.floor(timeSec / 60);
            const ss = Math.floor(timeSec % 60);
            probeEl.innerHTML = `<strong>P01 Debug</strong><br/>time: ${mm}:${ss.toString().padStart(2,'0')}<br/>motion: <strong>${iv.motion}</strong><br/>diam: ${s.diamPx.toFixed(1)}px<br/>interval: ${iv.tA}-${iv.tB}`;
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
              const ringDiameter = state?.diamPx || DWELL_DEFAULT_DIAM;
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
