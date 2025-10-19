import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG SWITCH ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => { if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...a); };

// ====== CONSTANTS ======
const DWELL_DEFAULT_DIAM = 10;   // px - baseline ring diameter
const DWELL_GROW_PER_SEC = 10;   // px (diameter) per second during STILL
const DWELL_STROKE_WIDTH = 2;

// ====== TYPES ======
type MotionState = 'STILL' | 'MOVING';
type MotionInterval = { tA: number; tB: number; timeLabel?: string; motion: MotionState };
type MotionSchedule = Record<string /*personId*/, MotionInterval[]>;
type DwellState = { lastKey?: string; diamPx: number };

// ====== STATE (PERSISTENT) ======
const dwellStates = new Map<string, DwellState>();
let motionSchedule: MotionSchedule | null = null;
let scheduleInitialized = false;

// ====== MOTION SCHEDULE BUILDER ======
function normalizeMotion(m?: string): MotionState {
  if (!m) return 'MOVING';
  const v = m.trim().toUpperCase();
  return v === 'STILL' ? 'STILL' : 'MOVING';
}

/**
 * Build motion schedule from CSV data.
 * Each row at tSec = T defines the motion state for interval [T, T+10).
 * Contract: motion column is authoritative (STILL or MOVING).
 */
function buildMotionSchedule(csvPositions: Record<string, any[]>): MotionSchedule {
  const schedule: MotionSchedule = {};
  
  for (const personId in csvPositions) {
    const rows = csvPositions[personId];
    if (!rows || rows.length === 0) continue;
    
    // Sort by tSec
    const sorted = [...rows].sort((a, b) => (a.tSec || 0) - (b.tSec || 0));
    
    const intervals: MotionInterval[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const A = sorted[i];
      const B = sorted[i + 1];
      intervals.push({
        tA: Number(A.tSec),
        tB: Number(B.tSec),
        timeLabel: A.time ? String(A.time) : undefined,
        motion: normalizeMotion(A.motion),
      });
    }
    schedule[personId] = intervals;
  }
  
  return schedule;
}

/**
 * Get current motion interval for a person at timeSec.
 * Returns the interval [tA, tB) where tA <= timeSec < tB.
 */
function getCurrentInterval(personId: string, timeSec: number, sched: MotionSchedule): MotionInterval | null {
  const list = sched[personId];
  if (!list || list.length === 0) return null;
  
  // Find interval where tA <= timeSec < tB
  for (let i = 0; i < list.length; i++) {
    const iv = list[i];
    if (timeSec >= iv.tA && timeSec < iv.tB) return iv;
  }
  
  // Clamp to last interval if beyond
  return list[list.length - 1];
}

/**
 * Update dwell state for a person based on motion schedule.
 * MOVING interval: diameter = 10px
 * STILL interval: diameter grows +10px/sec (unbounded), continues across consecutive STILL intervals
 */
function updateDwellState(personId: string, timeSec: number, dtSec: number, sched: MotionSchedule) {
  const iv = getCurrentInterval(personId, timeSec, sched);
  if (!iv) return;
  
  const key = `${iv.tA}-${iv.tB}`;
  const state = dwellStates.get(personId) ?? { diamPx: DWELL_DEFAULT_DIAM };
  
  // On entering a new interval
  if (state.lastKey !== key) {
    state.lastKey = key;
    
    // Reset to baseline only when entering a MOVING interval
    if (iv.motion === 'MOVING') {
      state.diamPx = DWELL_DEFAULT_DIAM;
    }
    // For STILL intervals, keep diameter (allows continuity across consecutive STILL intervals)
    
    dlog('🔄 ENTER', personId, iv.motion, `[${iv.tA}-${iv.tB})`, `${state.diamPx.toFixed(1)}px`, iv.timeLabel || '');
  }
  
  // Apply growth rule
  if (iv.motion === 'STILL') {
    state.diamPx += DWELL_GROW_PER_SEC * dtSec;  // +10px/s, unbounded
  } else {
    state.diamPx = DWELL_DEFAULT_DIAM;  // locked at 10px during MOVING
  }
  
  dwellStates.set(personId, state);
}

interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - Shows growing rings around stationary people
 * CSV-motion-driven only. No heuristics. Pure motion schedule logic.
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  
  const [lastFrameTime, setLastFrameTime] = React.useState(0);

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Initialize motion schedule once (one-time setup)
  React.useEffect(() => {
    if (!csvPositions || scheduleInitialized) return;
    
    motionSchedule = buildMotionSchedule(csvPositions);
    scheduleInitialized = true;
    
    const ids = Object.keys(motionSchedule);
    dlog('✅ Motion schedule built:', ids.length, 'people');
    
    // Log first person's schedule as example
    if (ids.length > 0) {
      const firstId = ids[0];
      const firstSched = motionSchedule[firstId].slice(0, 3);
      dlog(`   ${firstId}:`, firstSched);
    }
  }, [csvPositions]);

  // Setup dev helpers and visual probe (once)
  React.useEffect(() => {
    // Dev helpers (global)
    (window as any).jumpTo = (t: number) => {
      const state = usePeoplePlaybackStore.getState();
      const clamped = Math.max(0, Math.min(state.durationSec ?? 0, t));
      usePeoplePlaybackStore.setState({ timeSec: clamped });
      console.log('[TIME] ⏭️  Jumped to', clamped, 'seconds');
    };
    (window as any).start = () => (window as any).jumpTo(0);
    (window as any).mid = () => (window as any).jumpTo(90);
    (window as any).end = () => (window as any).jumpTo(usePeoplePlaybackStore.getState().durationSec ?? 180);

    // Keyboard shortcut: R to rewind
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') (window as any).start();
    };
    window.addEventListener('keydown', handleKeydown);

    // Visual probe overlay
    const probeEl = document.createElement('div');
    probeEl.id = 'dwell-probe';
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.8);color:#0f0;padding:8px 12px;border-radius:6px;font:11px/1.4 "Courier New",monospace;pointer-events:none;z-index:9999;border:1px solid #0f0;max-width:300px';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  // Update dwell states every frame (driven by global timeSec)
  React.useEffect(() => {
    if (!motionSchedule) return;

    const dtSec = lastFrameTime > 0 ? Math.max(0, timeSec - lastFrameTime) : 0;
    setLastFrameTime(timeSec);

    // Update all people from motion schedule
    const personIds = Object.keys(motionSchedule);
    
    for (const personId of personIds) {
      updateDwellState(personId, timeSec, dtSec, motionSchedule);
    }

    // Update visual probe
    const probeEl = document.getElementById('dwell-probe');
    if (probeEl) {
      const allStates = personIds.map(id => {
        const iv = getCurrentInterval(id, timeSec, motionSchedule!);
        const s = dwellStates.get(id);
        return { id, iv, s };
      }).filter(p => p.iv && p.s);

      const stillPeople = allStates.filter(p => p.iv!.motion === 'STILL');
      const movingPeople = allStates.filter(p => p.iv!.motion === 'MOVING');
      const mm = Math.floor(timeSec / 60);
      const ss = Math.floor(timeSec % 60);
      
      const p01Data = allStates.find(p => p.id === 'P01');
      
      probeEl.innerHTML = `<strong>Dwell (${stillPeople.length} STILL, ${movingPeople.length} MOVING)</strong><br/>` +
        `time: ${mm}:${ss.toString().padStart(2,'0')} (${timeSec.toFixed(1)}s)<br/>` +
        (p01Data?.iv ? 
          `P01: <strong>${p01Data.iv.motion}</strong> ${p01Data.s!.diamPx.toFixed(1)}px [${p01Data.iv.tA}-${p01Data.iv.tB}) ${p01Data.iv.timeLabel || ''}<br/>` : '') +
        (stillPeople.length > 0 ? 
          `Growing: ${stillPeople.slice(0, 4).map(p => `${p.id}:${p.s!.diamPx.toFixed(0)}px`).join(', ')}${stillPeople.length > 4 ? ` +${stillPeople.length - 4} more` : ''}` : 
          'No one STILL');
    }

    // Log periodic summary
    if ((window as any).DEBUG_DWELL && Math.floor(timeSec) !== Math.floor(lastFrameTime) && Math.floor(timeSec) % 5 === 0) {
      const stillCount = personIds.filter(id => {
        const iv = getCurrentInterval(id, timeSec, motionSchedule!);
        return iv?.motion === 'STILL';
      }).length;
      dlog(`⏱️  t=${timeSec.toFixed(1)}s: ${stillCount} STILL, ${personIds.length - stillCount} MOVING`);
    }
  }, [timeSec, lastFrameTime]);

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
