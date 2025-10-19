/**
 * Room Geometry - Single source of truth
 * Defines the circular grid layout matching the CSV reference
 * 
 * Angle convention: 0° = right, 90° = top, counter-clockwise positive
 */

export const ROOM = {
  angleZeroDeg: 0,         // 0° at right (3 o'clock)
  sectors: 10,             // 10 equal slices
  sectorSizeDeg: 36,       // 360 / 10 = 36° per sector
  rings: 5,                // 5 concentric rings
  ringRadiusFactors: [0.2, 0.4, 0.6, 0.8, 1.0], // inner → outer (uniform spacing)
  
  // Benches drawn as arcs on the rim
  // Angles in degrees, CCW, 0°=right, 90°=top
  benches: [
    { id: "T2", label: "Top-Right",    startDeg: 72,  endDeg: 108, color: "#3498db" }, // top-right
    { id: "T1", label: "Top-Left",     startDeg: 108, endDeg: 144, color: "#2ecc71" }, // top-left
    { id: "R",  label: "Right",        startDeg: 0,   endDeg: 36,  color: "#e74c3c" }, // right
    { id: "L",  label: "Left",         startDeg: 180, endDeg: 216, color: "#f39c12" }, // left
    { id: "B1", label: "Bottom-Left",  startDeg: 252, endDeg: 288, color: "#9b59b6" }, // bottom-left
    { id: "B2", label: "Bottom-Right", startDeg: 288, endDeg: 324, color: "#1abc9c" }  // bottom-right
  ],
  
  // Optional reference labels
  sectorLabels: Array.from({ length: 10 }, (_, i) => `S${i}`),
  ringLabels: ["R1", "R2", "R3", "R4", "R5"],
  
  // Cardinal direction labels (optional)
  cardinals: [
    { angleDeg: 0, label: "0° Right" },
    { angleDeg: 90, label: "90° Top" },
    { angleDeg: 180, label: "180° Left" },
    { angleDeg: 270, label: "270° Bottom" }
  ]
} as const;

/**
 * Convert polar coordinates to Cartesian
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Distance from center
 * @param angleDeg - Angle in degrees (0° = right, 90° = top, counter-clockwise)
 * @returns {x, y} coordinates
 */
export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } => {
  // Convert to radians: 0° = right = 0 rad, 90° = top = π/2 rad
  // Standard math: angle measured counter-clockwise from positive X-axis
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY - radius * Math.sin(angleRad), // Subtract because SVG Y increases downward
  };
};

/**
 * Check if an angle is within a bench's arc
 */
export const isAngleInBench = (angleDeg: number, benchId: string): boolean => {
  const bench = ROOM.benches.find(b => b.id === benchId);
  if (!bench) return false;
  
  const normalized = ((angleDeg % 360) + 360) % 360;
  return normalized >= bench.startDeg && normalized < bench.endDeg;
};

/**
 * Clamp an angle to a bench's range (for seated positions)
 */
export const clampAngleToBench = (angleDeg: number, benchId: string): number => {
  const bench = ROOM.benches.find(b => b.id === benchId);
  if (!bench) return angleDeg;
  
  const normalized = ((angleDeg % 360) + 360) % 360;
  const { startDeg, endDeg } = bench;
  
  if (normalized < startDeg) return startDeg;
  if (normalized >= endDeg) return endDeg - 0.1; // Just inside the end
  return normalized;
};
