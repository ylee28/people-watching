import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG SWITCH ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => { if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...a); };

// ====== CONSTANTS ======
const DWELL_DEFAULT_DIAM = 10;   // px
const DWELL_GROW_DIAM_PS = 10;   // px per second
const DWELL_STROKE = 2;

// ====== TYPES ======
type MotionState = 'STILL' | 'MOVING';
type CSVRow = { personId: string; tSec: number; time?: string; motion?: string };
type MotionInterval = { tA: number; tB: number; timeLabel?: string; motion: MotionState };
type MotionSchedule = Record<string /* personId canonical */, MotionInterval[]>;
type DwellState = { lastKey?: string; diamPx: number };

// ====== STATE (PERSISTENT) ======
const dwellStates = new Map<string, DwellState>();
let motionSchedule: MotionSchedule | null = null;
let scheduleInitialized = false;

// ====== HELPERS ======
const canonicalId = (id: string) => String(id).trim().toUpperCase();
const normMotion = (m?: string): MotionState => (m && m.trim().toUpperCase() === 'STILL') ? 'STILL' : 'MOVING';

/**
 * Build motion schedule from CSV rows.
 * Each row at tSec = T defines motion state for interval [T, T+10).
 * Contract: motion column is STILL or MOVING (case-insensitive, defaults to MOVING).
 */
function buildMotionSchedule(rows: CSVRow[]): MotionSchedule {
  const byId: Record<string, CSVRow[]> = {};
  
  for (const r of rows) {
    if (r == null) continue;
    const id = canonicalId(r.personId);
    if (!byId[id]) byId[id] = [];
    byId[id].push({
      personId: id,
      tSec: Number(r.tSec),
      time: r.time ? String(r.time) : undefined,
      motion: normMotion(r.motion),
    });
  }
  
  const schedule: MotionSchedule = {};
  for (const id in byId) {
    const arr = byId[id].filter(a => Number.isFinite(a.tSec));
    arr.sort((a, b) => a.tSec - b.tSec);
    const out: MotionInterval[] = [];
    for (let i = 0; i < arr.length - 1; i++) {
      const A = arr[i], B = arr[i + 1];
      out.push({
        tA: A.tSec,
        tB: B.tSec,
        timeLabel: A.time,
        motion: normMotion(A.motion)
      });
    }
    schedule[id] = out;
  }
  
  return schedule;
}

/**
 * Get current motion interval for a person at timeSec.
 * Strict rule: value at tA applies to [tA, tB).
 * Uses strict < on right boundary to avoid off-by-one errors.
 */
function getCurrentInterval(id: string, timeSec: number, sched: MotionSchedule): MotionInterval | null {
  const key = canonicalId(id);
  const list = sched[key];
  if (!list || list.length === 0) return null;

  // Exact rule: [tA, tB) — value at tA applies to entire interval
  for (let i = 0; i < list.length; i++) {
    const iv = list[i];
    if (timeSec >= iv.tA && timeSec < iv.tB) return iv;
  }
  
  // Clamp to last interval if beyond
  return list[list.length - 1];
}

/**
 * Update dwell layer for all people in motion schedule.
 * MOVING interval: diameter = 10px
 * STILL interval: diameter grows +10px/sec (unbounded), continues across consecutive STILL
 */
function updateDwellLayer(timeSec: number, dtSec: number, sched: MotionSchedule, personIds: string[]) {
  for (const rawId of personIds) {
    const id = canonicalId(rawId);
    const iv = getCurrentInterval(id, timeSec, sched);
    if (!iv) continue;

    const key = `${iv.tA}-${iv.tB}`;
    const s = dwellStates.get(id) ?? { diamPx: DWELL_DEFAULT_DIAM };

    // On entering new interval
    if (s.lastKey !== key) {
      s.lastKey = key;
      // Reset to baseline only for MOVING intervals
      if (iv.motion === 'MOVING') {
        s.diamPx = DWELL_DEFAULT_DIAM;
      }
      // For STILL intervals, keep diameter (continuity across consecutive STILL)
      
      if (id === 'P01') {
        dlog('🔄 ENTER', id, `[${iv.tA}-${iv.tB})`, iv.motion, `diam=${s.diamPx.toFixed(1)}px`, iv.timeLabel || '');
      }
    }

    // Apply growth rule
    if (iv.motion === 'STILL') {
      s.diamPx += DWELL_GROW_DIAM_PS * dtSec; // +10px per second (unbounded)
    } else {
      s.diamPx = DWELL_DEFAULT_DIAM; // locked at 10px during MOVING
    }

    dwellStates.set(id, s);

    // Debug P01 periodically
    if (id === 'P01' && Math.random() < 0.05) {
      dlog('timeSec', timeSec.toFixed(1), 'interval', `${iv.tA}-${iv.tB}`, 'motion', iv.motion, 'diam', s.diamPx.toFixed(1));
    }
  }
}

interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - CSV motion-driven only. No heuristics.
 * Shows growing rings around stationary people (STILL state).
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const csvPositions = usePeoplePlaybackStore((state) => state.csvPositions);
  
  const [lastFrameTime, setLastFrameTime] = React.useState(0);

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Build motion schedule once (after CSV loads)
  React.useEffect(() => {
    if (!csvPositions || scheduleInitialized) return;
    
    // Flatten CSV to row array
    const rows: CSVRow[] = [];
    for (const personId in csvPositions) {
      const samples = csvPositions[personId];
      for (const sample of samples) {
        rows.push({
          personId,
          tSec: sample.tSec,
          time: sample.time,
          motion: sample.motion,
        });
      }
    }
    
    dlog('📥 Raw CSV rows (first 10):', rows.slice(0, 10).map(r => `${r.personId}@${r.tSec}:${r.motion}`));
    
    motionSchedule = buildMotionSchedule(rows);
    scheduleInitialized = true;
    
    const ids = Object.keys(motionSchedule);
    dlog('✅ Motion schedule built:', ids.length, 'people');
    dlog('Schedule keys:', ids.slice(0, 10));
    
    // Log P01's schedule in detail (all intervals)
    if (motionSchedule['P01']) {
      dlog('🔍 P01 complete schedule:', motionSchedule['P01']);
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
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.8);color:#0f0;padding:8px 12px;border-radius:6px;font:11px/1.4 "Courier New",monospace;pointer-events:none;z-index:9999;border:1px solid #0f0;max-width:320px';
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

    // Update ALL people from motion schedule (not just visible)
    const personIds = Object.keys(motionSchedule);
    updateDwellLayer(timeSec, dtSec, motionSchedule, personIds);

    // Update visual probe
    const probeEl = document.getElementById('dwell-probe');
    if (probeEl) {
      const allStates = personIds.map(id => {
        const canId = canonicalId(id);
        const iv = getCurrentInterval(canId, timeSec, motionSchedule!);
        const s = dwellStates.get(canId);
        return { id: canId, iv, s };
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
          `Growing: ${stillPeople.slice(0, 4).map(p => `${p.id}:${p.s!.diamPx.toFixed(0)}px`).join(', ')}${stillPeople.length > 4 ? ` +${stillPeople.length - 4}` : ''}` : 
          'No one STILL');
    }

    // Log periodic summary
    if ((window as any).DEBUG_DWELL && Math.floor(timeSec) !== Math.floor(lastFrameTime) && Math.floor(timeSec) % 10 === 0) {
      const stillCount = personIds.filter(id => {
        const iv = getCurrentInterval(canonicalId(id), timeSec, motionSchedule!);
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

              const canId = canonicalId(person.id);
              const state = dwellStates.get(canId);
              const ringDiameter = state?.diamPx || DWELL_DEFAULT_DIAM;
              const ringRadius = ringDiameter / 2; // IMPORTANT: SVG circle uses radius, not diameter

              if (ringRadius <= 0) return null;

              return (
                <circle
                  key={person.id}
                  id={`dwell-${canId}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke={person.color}
                  strokeWidth={DWELL_STROKE}
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
