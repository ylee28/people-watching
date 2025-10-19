import { create } from 'zustand';

export interface PersonBase {
  id: string;
  angleDeg: number;
  radiusFactor: number;
  bench: string;
  color: string;
  posture: string;
  words: string;
}

export interface CSVSample {
  tSec: number;
  angleDeg?: number;
  radiusFactor?: number;
  bench?: string;
  notes?: string;
}

export interface TimelinePoint {
  t: number;
  action: string;
  angleDeg: number;
  radiusFactor: number;
  duration?: number; // optional, for path segments
}

export interface TimelinePerson {
  id: string;
  track: TimelinePoint[];
}

export interface PersonState extends PersonBase {
  currentAngleDeg: number;
  currentRadiusFactor: number;
  currentAction: string;
  isVisible: boolean;
  pathHistory: { angleDeg: number; radiusFactor: number; t: number }[];
}

interface PeoplePlaybackStore {
  timeSec: number;
  isPlaying: boolean;
  speed: number;
  durationSec: number;
  peopleBase: PersonBase[];
  timeline: TimelinePerson[];
  peopleAtTime: PersonState[];
  csvPositions: Record<string, CSVSample[]> | null;
  peopleMeta: Record<string, { color: string; posture: string; words: string }>;
  
  // Actions
  play: () => void;
  pause: () => void;
  setTime: (t: number) => void;
  setSpeed: (speed: number) => void;
  loadData: () => Promise<void>;
  loadCSVData: (csvText: string) => void;
  tick: (deltaTime: number) => void;
  computePeopleAtTime: () => void;
}

// Helper: normalize angle to [0, 360)
const normalizeAngle = (angle: number): number => {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

// Helper: shortest angular distance (handles 360° wrap)
const shortestAngleDist = (from: number, to: number): number => {
  const diff = to - from;
  const normalized = ((diff + 180) % 360) - 180;
  return normalized < -180 ? normalized + 360 : normalized;
};

// Helper: interpolate position between two CSV samples
const interpolateCSVPosition = (before: CSVSample, after: CSVSample, t: number) => {
  if (before.tSec === after.tSec) return before;
  
  const ratio = (t - before.tSec) / (after.tSec - before.tSec);
  
  let angleDeg = before.angleDeg;
  if (before.angleDeg !== undefined && after.angleDeg !== undefined) {
    const dist = shortestAngleDist(before.angleDeg, after.angleDeg);
    angleDeg = normalizeAngle(before.angleDeg + dist * ratio);
  }
  
  let radiusFactor = before.radiusFactor;
  if (before.radiusFactor !== undefined && after.radiusFactor !== undefined) {
    radiusFactor = before.radiusFactor + (after.radiusFactor - before.radiusFactor) * ratio;
  }
  
  return {
    tSec: t,
    angleDeg,
    radiusFactor,
    bench: before.bench,
    notes: before.notes || after.notes,
  };
};

// Helper: interpolate position between two timeline points
const interpolatePosition = (track: TimelinePoint[], t: number) => {
  if (track.length === 0) return null;
  
  let before = track[0];
  let after = track[track.length - 1];
  
  for (let i = 0; i < track.length - 1; i++) {
    if (track[i].t <= t && track[i + 1].t >= t) {
      before = track[i];
      after = track[i + 1];
      break;
    }
  }
  
  if (before === after) return before;
  
  const ratio = (t - before.t) / (after.t - before.t);
  return {
    angleDeg: before.angleDeg + (after.angleDeg - before.angleDeg) * ratio,
    radiusFactor: before.radiusFactor + (after.radiusFactor - before.radiusFactor) * ratio,
    action: before.action,
  };
};

// Helper: get path history up to time t
const getPathHistory = (track: TimelinePoint[], t: number) => {
  return track
    .filter((p) => p.t <= t)
    .map((p) => ({ angleDeg: p.angleDeg, radiusFactor: p.radiusFactor, t: p.t }));
};

// Timeline augmentation: add procedural movements to make the scene more dynamic
const augmentTimeline = (timeline: TimelinePerson[]): TimelinePerson[] => {
  const augmented = timeline.map((person) => ({ ...person, track: [...person.track] }));
  
  // Rim runners: P06, P07, P09 - 2 full clockwise laps between t=150-270s
  const rimRunners = ['P06', 'P07', 'P09'];
  rimRunners.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const startAngle = idx * 120; // Spread 120° apart
    const lapDuration = 60; // 60s per lap
    
    // Remove existing events in this range if any
    person.track = person.track.filter((p) => p.t < 150 || p.t > 270);
    
    // Add lap events
    person.track.push(
      { t: 150, action: 'stand', angleDeg: startAngle, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.25, action: 'walk', angleDeg: startAngle + 90, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.5, action: 'walk', angleDeg: startAngle + 180, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.75, action: 'walk', angleDeg: startAngle + 270, radiusFactor: 0.92 },
      { t: 150 + lapDuration, action: 'walk', angleDeg: startAngle + 360, radiusFactor: 0.92 },
      // Second lap
      { t: 210 + lapDuration * 0.25, action: 'walk', angleDeg: startAngle + 450, radiusFactor: 0.92 },
      { t: 210 + lapDuration * 0.5, action: 'walk', angleDeg: startAngle + 540, radiusFactor: 0.92 },
      { t: 210 + lapDuration * 0.75, action: 'walk', angleDeg: startAngle + 630, radiusFactor: 0.92 },
      { t: 270, action: 'walk', angleDeg: startAngle + 720, radiusFactor: 0.92 },
    );
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Wide sweepers: P03, P05 - figure-eight sweeps between t=120-240s
  const wideSweepers = ['P03', 'P05'];
  wideSweepers.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const baseAngle = idx * 180; // 0° and 180°
    
    person.track = person.track.filter((p) => p.t < 120 || p.t > 240);
    
    // Two figure-eight cycles
    for (let cycle = 0; cycle < 2; cycle++) {
      const tBase = 120 + cycle * 60;
      person.track.push(
        { t: tBase, action: 'stand', angleDeg: baseAngle, radiusFactor: 0.92 },
        { t: tBase + 15, action: 'walk', angleDeg: baseAngle + 45, radiusFactor: 0.55 },
        { t: tBase + 30, action: 'walk', angleDeg: baseAngle + 90, radiusFactor: 0.92 },
        { t: tBase + 45, action: 'walk', angleDeg: baseAngle + 180, radiusFactor: 0.55 },
        { t: tBase + 60, action: 'walk', angleDeg: baseAngle + 270, radiusFactor: 0.92 },
      );
    }
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Center drifters: P12, P13 - spiral out from center between t=160-230s
  const centerDrifters = ['P12', 'P13'];
  centerDrifters.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const baseAngle = idx * 180;
    
    person.track = person.track.filter((p) => p.t < 160 || p.t > 230);
    
    // Spiral out
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = 160 + (i / steps) * 70;
      const r = 0.25 + (0.55 / steps) * i;
      const angle = baseAngle + (360 / steps) * i;
      person.track.push({
        t: Math.round(t),
        action: i === 0 ? 'stand' : 'walk',
        angleDeg: angle,
        radiusFactor: r,
      });
    }
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Enforce exits: ALL 13 people exit by t=300s by moving OUTWARD past the rim
  // Each person gets an exit angle within -10° to +20° (egress region)
  // They tween from their position to radiusFactor > 1.05, then fade
  augmented.forEach((person, idx) => {
    // Remove any existing exit
    person.track = person.track.filter((p) => p.action !== 'exit');
    
    // Determine last known position before exit
    const lastNonExit = person.track[person.track.length - 1] || { 
      t: 295, 
      angleDeg: person.id === 'P01' ? 0 : person.id === 'P04' ? 120 : person.id === 'P11' ? 240 : idx * 30, 
      radiusFactor: 0.92 
    };
    
    // Assign exit angle (spread within -10° to +20°)
    const exitAngle = -10 + (idx / 12) * 30; // Distribute exits across egress zone
    
    // Move toward exit angle at rim (t=295-298s)
    if (lastNonExit.t < 295) {
      person.track.push({ 
        t: 295, 
        action: 'walk', 
        angleDeg: exitAngle, 
        radiusFactor: 0.92 
      });
    }
    
    // Move outward past rim (t=298-299s) - radiusFactor 0.92 → 1.08
    person.track.push({ 
      t: 298, 
      action: 'walk', 
      angleDeg: exitAngle, 
      radiusFactor: 0.92 
    });
    
    person.track.push({ 
      t: 299.5, 
      action: 'walk', 
      angleDeg: exitAngle, 
      radiusFactor: 1.08 
    });
    
    // Exit (fade out at t=300s)
    person.track.push({ 
      t: 300, 
      action: 'exit', 
      angleDeg: exitAngle, 
      radiusFactor: 1.08 
    });
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  return augmented;
};

export const usePeoplePlaybackStore = create<PeoplePlaybackStore>((set, get) => ({
  timeSec: 0,
  isPlaying: true, // Always playing, but keep property for backwards compatibility
  speed: 1,
  durationSec: 300,
  peopleBase: [],
  timeline: [],
  peopleAtTime: [],
  csvPositions: null,
  peopleMeta: {},

  play: () => {
    // No-op, always playing
  },

  pause: () => {
    // No-op, always playing
  },

  setTime: (t: number) => {
    const { durationSec } = get();
    const clampedTime = Math.max(0, Math.min(durationSec, t));
    set({ timeSec: clampedTime });
    get().computePeopleAtTime();
  },

  setSpeed: (speed: number) => {
    set({ speed });
  },

  tick: (deltaTime: number) => {
    const { timeSec, speed, durationSec } = get();
    
    // Clamp at end, don't wrap or reset
    const newTime = Math.min(timeSec + deltaTime * speed, durationSec);
    set({ timeSec: newTime });
    
    // Always recompute, even at end (for rendering consistency)
    get().computePeopleAtTime();
  },

  loadData: async () => {
    try {
      // Load CSV positions
      const csvRes = await fetch('/data/positions.csv');
      const csvText = await csvRes.text();
      
      // Load people metadata
      const peopleRes = await fetch('/data/people.json');
      const peopleBase: PersonBase[] = await peopleRes.json();
      
      // Build metadata from peopleBase
      const peopleMeta: Record<string, { color: string; posture: string; words: string }> = {};
      peopleBase.forEach((person) => {
        peopleMeta[person.id] = {
          color: person.color,
          posture: person.posture,
          words: person.words,
        };
      });
      
      set({ peopleBase, peopleMeta });
      
      // Parse and load CSV data
      get().loadCSVData(csvText);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  },

  loadCSVData: (csvText: string) => {
    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const csvPositions: Record<string, CSVSample[]> = {};
      let maxTime = 0;
      
      // Parse CSV rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        
        const personId = row.personId;
        if (!personId) continue;
        
        const tSec = parseInt(row.tSec, 10);
        if (isNaN(tSec)) continue;
        
        maxTime = Math.max(maxTime, tSec);
        
        const sample: CSVSample = { tSec };
        
        if (row.angleDeg && row.angleDeg !== '') {
          sample.angleDeg = normalizeAngle(parseFloat(row.angleDeg));
        }
        
        if (row.radiusFactor && row.radiusFactor !== '') {
          sample.radiusFactor = parseFloat(row.radiusFactor);
        } else if (row.bench && ['T1', 'T2', 'L', 'R', 'B1', 'B2'].includes(row.bench)) {
          // Default radiusFactor for bench seats
          sample.radiusFactor = 0.92;
        }
        
        if (row.bench) {
          sample.bench = row.bench;
        }
        
        if (row.notes) {
          sample.notes = row.notes;
        }
        
        if (!csvPositions[personId]) {
          csvPositions[personId] = [];
        }
        csvPositions[personId].push(sample);
      }
      
      // Sort samples by tSec for each person
      Object.keys(csvPositions).forEach((personId) => {
        csvPositions[personId].sort((a, b) => a.tSec - b.tSec);
      });
      
      const durationSec = maxTime;
      set({ csvPositions, durationSec, timeSec: 0 });
      get().computePeopleAtTime();
    } catch (err) {
      console.error('Failed to parse CSV:', err);
    }
  },

  computePeopleAtTime: () => {
    const { peopleBase, timeline, timeSec, csvPositions, peopleMeta } = get();
    
    // If CSV data is loaded, use that instead of timeline
    if (csvPositions) {
      const peopleAtTime: PersonState[] = [];
      
      Object.keys(csvPositions).forEach((personId) => {
        const samples = csvPositions[personId];
        if (!samples || samples.length === 0) return;
        
        // Find bracketing samples
        let before: CSVSample | null = null;
        let after: CSVSample | null = null;
        
        for (let i = 0; i < samples.length; i++) {
          if (samples[i].tSec <= timeSec) {
            before = samples[i];
          }
          if (samples[i].tSec >= timeSec && !after) {
            after = samples[i];
          }
        }
        
        // Person not yet visible
        if (!before) return;
        
        // Check for exit
        const isExited = before.bench === 'EXIT' || 
                        (before.radiusFactor !== undefined && before.radiusFactor > 1.0) ||
                        (after && (after.bench === 'EXIT' || (after.radiusFactor !== undefined && after.radiusFactor > 1.0)) && timeSec >= after.tSec);
        
        if (isExited) return; // Don't render exited people
        
        // Interpolate position
        const interpolated = after && before.tSec !== after.tSec
          ? interpolateCSVPosition(before, after, timeSec)
          : before;
        
        if (interpolated.angleDeg === undefined || interpolated.radiusFactor === undefined) return;
        
        // Build path history (traveled portion)
        const pathHistory = samples
          .filter((s) => s.tSec <= timeSec && s.angleDeg !== undefined && s.radiusFactor !== undefined)
          .map((s) => ({
            angleDeg: s.angleDeg!,
            radiusFactor: s.radiusFactor!,
            t: s.tSec,
          }));
        
        // Get metadata
        const meta = peopleMeta[personId] || {
          color: '#888888',
          posture: 'standing',
          words: '',
        };
        
        peopleAtTime.push({
          id: personId,
          angleDeg: interpolated.angleDeg,
          radiusFactor: interpolated.radiusFactor,
          bench: interpolated.bench || 'CENTER',
          color: meta.color,
          posture: meta.posture,
          words: interpolated.notes || meta.words,
          currentAngleDeg: interpolated.angleDeg,
          currentRadiusFactor: interpolated.radiusFactor,
          currentAction: 'walk',
          isVisible: true,
          pathHistory,
        });
      });
      
      set({ peopleAtTime });
      return;
    }
    
    // Original timeline-based computation
    const peopleAtTime: PersonState[] = peopleBase.map((base) => {
      // Find timeline track for this person
      const track = timeline.find((t) => t.id === base.id);
      
      if (!track) {
        // No timeline, use base position
        return {
          ...base,
          currentAngleDeg: base.angleDeg,
          currentRadiusFactor: base.radiusFactor,
          currentAction: 'sit',
          isVisible: true,
          pathHistory: [],
        };
      }
      
      // Interpolate current position
      const currentPos = interpolatePosition(track.track, timeSec);
      
      if (!currentPos) {
        return {
          ...base,
          currentAngleDeg: base.angleDeg,
          currentRadiusFactor: base.radiusFactor,
          currentAction: 'sit',
          isVisible: true,
          pathHistory: [],
        };
      }
      
      // Check if person has exited
      const lastPoint = track.track[track.track.length - 1];
      const isVisible = !(lastPoint.action === 'exit' && timeSec >= lastPoint.t);
      
      return {
        ...base,
        currentAngleDeg: currentPos.angleDeg,
        currentRadiusFactor: currentPos.radiusFactor,
        currentAction: currentPos.action,
        isVisible,
        pathHistory: getPathHistory(track.track, timeSec),
      };
    });
    
    set({ peopleAtTime });
  },
}));

// Start the tick with requestAnimationFrame (call this once in the app)
let rafId: number | null = null;
let lastTickTime: number | null = null;

export const startPlaybackTicker = () => {
  if (rafId) return;
  
  const tick = (timestamp: number) => {
    if (lastTickTime === null) {
      lastTickTime = timestamp;
    }
    
    const deltaTime = (timestamp - lastTickTime) / 1000; // Convert to seconds
    lastTickTime = timestamp;
    
    usePeoplePlaybackStore.getState().tick(deltaTime);
    
    rafId = requestAnimationFrame(tick);
  };
  
  rafId = requestAnimationFrame(tick);
};

export const stopPlaybackTicker = () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
    lastTickTime = null;
  }
};
