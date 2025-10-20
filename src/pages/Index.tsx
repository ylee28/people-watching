import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { UnifiedColors } from "@/components/layers/UnifiedColors";
import { UnifiedDwell } from "@/components/layers/UnifiedDwell";
import { UnifiedNotes } from "@/components/layers/UnifiedNotes";
import { UnifiedMovement } from "@/components/layers/UnifiedMovement";
import { UnifiedCoverage } from "@/components/layers/UnifiedCoverage";
import { Timer } from "@/components/Timer";
import { TimelineControls } from "@/components/TimelineControls";
import { LayerNavButtons } from "@/components/LayerNavButtons";
import { usePeoplePlaybackStore, startPlaybackTicker } from "@/lib/usePeoplePlaybackStore";
type ViewMode = "intro" | "focus";
type IntroMode = "overlapped" | "exploded";
type LayerType = "colors" | "dwell" | "notes" | "movement" | "coverage";
const layerLabels: Record<LayerType, string> = {
  colors: "Color",
  dwell: "Dwell Time",
  notes: "Notes",
  movement: "Path",
  coverage: "Other"
};
const Index = () => {
  const [viewMode, setViewMode] = React.useState<ViewMode>("intro");
  const [introMode, setIntroMode] = React.useState<IntroMode>("overlapped");
  const [selectedLayer, setSelectedLayer] = React.useState<LayerType | null>(null);
  const [overlayImage, setOverlayImage] = React.useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = React.useState(50);
  const [overlayPosition, setOverlayPosition] = React.useState<"above" | "below">("below");
  const [introStyleImage, setIntroStyleImage] = React.useState<string | null>(null);
  const [introStyleOpacity, setIntroStyleOpacity] = React.useState(30);
  const [introStylePosition, setIntroStylePosition] = React.useState<"above" | "below">("below");

  // Zustand store
  const {
    timeSec,
    loadData
  } = usePeoplePlaybackStore();
  const layers: LayerType[] = ["colors", "dwell", "notes", "movement", "coverage"];

  // Load data and start ticker on mount
  React.useEffect(() => {
    loadData();
    startPlaybackTicker();
  }, [loadData]);

  // Track window size for responsive oval spacing
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        setOverlayImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleIntroStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        setIntroStyleImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleIntroClick = () => {
    if (introMode === "overlapped") {
      setIntroMode("exploded");
    }
  };
  const handleBackgroundClick = () => {
    if (introMode === "exploded") {
      setIntroMode("overlapped");
    }
  };

  // Keyboard support: Esc to return to overlapped
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && introMode === "exploded") {
        setIntroMode("overlapped");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [introMode]);
  const goToLayer = (layer: LayerType) => {
    setSelectedLayer(layer);
    setViewMode("focus");
  };
  const handleBack = () => {
    if (viewMode === "focus") {
      setViewMode("intro");
      setSelectedLayer(null);
    }
  };
  const renderLayer = (layer: LayerType) => {
    switch (layer) {
      case "colors":
        return <UnifiedColors />;
      case "dwell":
        return <UnifiedDwell />;
      case "notes":
        return <UnifiedColors />;
      case "movement":
        return <UnifiedMovement />;
      case "coverage":
        return <UnifiedColors />;
    }
  };
  return (
    <div className="app-shell">
      {/* Header row */}
      <div className="app-header">
        <Timer />
        <TimelineControls />
        
        {/* Header controls */}
        <div className="flex flex-wrap gap-4 items-center justify-center">
          {/* Intro Style Reference (Intro only) */}
          {viewMode === "intro" && introStyleImage && (
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Opacity:</Label>
                <Slider 
                  value={[introStyleOpacity]} 
                  onValueChange={v => setIntroStyleOpacity(v[0])} 
                  min={0} max={100} step={1} 
                  className="w-20" 
                />
                <span className="text-xs text-muted-foreground">{introStyleOpacity}%</span>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant={introStylePosition === "below" ? "default" : "outline"} 
                  onClick={() => setIntroStylePosition("below")} 
                  size="sm"
                >
                  Below
                </Button>
                <Button 
                  variant={introStylePosition === "above" ? "default" : "outline"} 
                  onClick={() => setIntroStylePosition("above")} 
                  size="sm"
                >
                  Above
                </Button>
              </div>
            </div>
          )}

          {/* Overlay controls (Focus only) */}
          {viewMode === "focus" && overlayImage && (
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Opacity:</Label>
                <Slider 
                  value={[overlayOpacity]} 
                  onValueChange={v => setOverlayOpacity(v[0])} 
                  min={0} max={100} step={1} 
                  className="w-20" 
                />
                <span className="text-xs text-muted-foreground">{overlayOpacity}%</span>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant={overlayPosition === "below" ? "default" : "outline"} 
                  onClick={() => setOverlayPosition("below")} 
                  size="sm"
                >
                  Below
                </Button>
                <Button 
                  variant={overlayPosition === "above" ? "default" : "outline"} 
                  onClick={() => setOverlayPosition("above")} 
                  size="sm"
                >
                  Above
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content row */}
      <div className={`app-main ${viewMode === "intro" && introMode === "exploded" ? "with-sidebar" : ""}`}>
        {/* Left sidebar - layer buttons (exploded view only) */}
        {viewMode === "intro" && introMode === "exploded" && (
          <div className="left-sidebar hidden md:flex flex-col justify-center">
            <LayerNavButtons onSelect={goToLayer} activeLayer={selectedLayer} layout="vertical" />
          </div>
        )}
        
        {/* Visualization stage */}
        <div className="viz-stage">
          <div className="viz-canvas">
            <AnimatePresence mode="wait">
              {/* INTRO VIEW */}
              {viewMode === "intro" && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative flex flex-col items-center justify-center gap-4"
                >
                  {/* Mobile buttons above (exploded only) */}
                  {introMode === "exploded" && (
                    <div className="md:hidden w-full max-w-md px-4">
                      <LayerNavButtons onSelect={goToLayer} activeLayer={selectedLayer} layout="horizontal" />
                    </div>
                  )}

                  {/* SVG container */}
                  <div className="relative flex-1 w-full flex items-center justify-center">
                    <svg
                      className="viz-svg"
                      viewBox="-280 -280 560 560"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        {/* Clip paths for each layer in exploded view */}
                        {layers.map(layer => (
                          <clipPath key={`clip-${layer}`} id={`oval-clip-${layer}`}>
                            <ellipse cx="0" cy="0" rx="256" ry="56" />
                          </clipPath>
                        ))}
                      </defs>

                      {/* Background overlay (below) */}
                      {introStyleImage && introStylePosition === "below" && (
                        <image
                          href={introStyleImage}
                          x="-260"
                          y="-260"
                          width="520"
                          height="520"
                          opacity={introStyleOpacity / 100}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      )}

                      {/* Clickable area for overlapped -> exploded */}
                      {introMode === "overlapped" && (
                        <circle
                          cx="0"
                          cy="0"
                          r="260"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onClick={handleIntroClick}
                        />
                      )}

                      {/* Layer stack */}
                      <g id="layer-stack">
                        {layers.map((layer, idx) => {
                          const ovalHeight = 520 * 0.22; // 114.4px
                          const gap = 5;
                          
                          // Calculate y offset for exploded view
                          const yOffset = introMode === "exploded" 
                            ? (idx - 2) * (ovalHeight + gap)
                            : 0;

                          return (
                            <g key={layer}>
                              <motion.g
                                initial={false}
                                animate={{
                                  y: yOffset,
                                  scaleY: introMode === "exploded" ? 0.22 : 1
                                }}
                                transition={{
                                  duration: 0.6,
                                  ease: "easeOut"
                                }}
                                style={{
                                  cursor: introMode === "exploded" ? "pointer" : "default"
                                }}
                                onClick={(e: any) => {
                                  if (introMode === "exploded") {
                                    e.stopPropagation();
                                    goToLayer(layer);
                                  }
                                }}
                                whileHover={introMode === "exploded" ? { scale: 1.02 } : undefined}
                              >
                                {/* Clip group for exploded view */}
                                {introMode === "exploded" && (
                                  <g clipPath={`url(#oval-clip-${layer})`}>
                                    <foreignObject x="-260" y="-260" width="520" height="520">
                                      <div style={{ width: 520, height: 520 }}>
                                        {renderLayer(layer)}
                                      </div>
                                    </foreignObject>
                                  </g>
                                )}

                                {/* No clip for overlapped view */}
                                {introMode === "overlapped" && (
                                  <foreignObject x="-260" y="-260" width="520" height="520">
                                    <div style={{ width: 520, height: 520 }}>
                                      {renderLayer(layer)}
                                    </div>
                                  </foreignObject>
                                )}
                              </motion.g>

                              {/* Layer label (exploded only) */}
                              {introMode === "exploded" && (
                                <motion.text
                                  initial={false}
                                  animate={{ y: yOffset }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                  x="-300"
                                  y="0"
                                  textAnchor="end"
                                  dominantBaseline="middle"
                                  fill="#CFBD94"
                                  fontSize="21"
                                  fontFamily="PP Mori, sans-serif"
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {layerLabels[layer]}
                                </motion.text>
                              )}
                            </g>
                          );
                        })}
                      </g>

                      {/* Background click area for exploded -> overlapped */}
                      {introMode === "exploded" && (
                        <rect
                          x="-300"
                          y="-300"
                          width="600"
                          height="600"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onClick={handleBackgroundClick}
                        />
                      )}

                      {/* Foreground overlay (above) */}
                      {introStyleImage && introStylePosition === "above" && (
                        <image
                          href={introStyleImage}
                          x="-260"
                          y="-260"
                          width="520"
                          height="520"
                          opacity={introStyleOpacity / 100}
                          preserveAspectRatio="xMidYMid meet"
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                    </svg>
                  </div>
                </motion.div>
              )}

              {/* FOCUS VIEW */}
              {viewMode === "focus" && selectedLayer && (
                <motion.div
                  key="focus"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="w-full h-full relative flex items-center justify-center"
                >
                  <svg
                    className="viz-svg"
                    viewBox="-280 -280 560 560"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Overlay below */}
                    {overlayImage && overlayPosition === "below" && (
                      <image
                        href={overlayImage}
                        x="-260"
                        y="-260"
                        width="520"
                        height="520"
                        opacity={overlayOpacity / 100}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    )}

                    {/* Layer visualization */}
                    <foreignObject x="-260" y="-260" width="520" height="520">
                      <div style={{ width: 520, height: 520 }}>
                        {renderLayer(selectedLayer)}
                      </div>
                    </foreignObject>

                    {/* Overlay above */}
                    {overlayImage && overlayPosition === "above" && (
                      <image
                        href={overlayImage}
                        x="-260"
                        y="-260"
                        width="520"
                        height="520"
                        opacity={overlayOpacity / 100}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Back button */}
      {(viewMode === "focus" || introMode === "exploded") && (
        <div
          onClick={viewMode === "focus" ? handleBack : handleBackgroundClick}
          className="fixed bottom-8 left-8 font-tiny cursor-pointer hover:opacity-70 transition-opacity z-50"
          style={{
            fontSize: '100pt',
            lineHeight: '1',
            color: '#CFBD94'
          }}
        >
          &lt;
        </div>
      )}
    </div>
  );
};
export default Index;