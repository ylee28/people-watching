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
  colors: "Colors",
  dwell: "Dwell Time",
  notes: "Notes",
  movement: "Path",
  coverage: "Coverage"
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
        return <UnifiedNotes />;
      case "movement":
        return <UnifiedMovement />;
      case "coverage":
        return <UnifiedCoverage />;
    }
  };
  return <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Timer and timeline controls at top center */}
      <div className="max-w-7xl mx-auto mb-6 space-y-4">
        <div className="flex justify-center">
          <Timer />
        </div>
        <TimelineControls />
      </div>

      {/* Header controls */}
      <div className="max-w-7xl mx-auto mb-8 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Button variant={viewMode === "intro" ? "default" : "outline"} onClick={() => {
            setViewMode("intro");
            setIntroMode("overlapped");
          }} size="sm">
              Intro
            </Button>
            {viewMode === "focus" && <Button variant="outline" onClick={handleBack} size="sm">
                Back
              </Button>}
            {introMode === "exploded" && viewMode === "intro" && <Button variant="outline" onClick={handleBackgroundClick} size="sm">
                Back to Overlapped
              </Button>}
          </div>

          {/* Intro Style Reference (Intro only) */}
          {viewMode === "intro" && <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="intro-style-file" className="text-sm cursor-pointer">
                  Intro Style:
                </Label>
                
              </div>
              
              {introStyleImage && <>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Opacity:</Label>
                    <Slider value={[introStyleOpacity]} onValueChange={v => setIntroStyleOpacity(v[0])} min={0} max={100} step={1} className="w-24" />
                    <span className="text-xs text-muted-foreground">{introStyleOpacity}%</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={introStylePosition === "below" ? "default" : "outline"} onClick={() => setIntroStylePosition("below")} size="sm">
                      Below
                    </Button>
                    <Button variant={introStylePosition === "above" ? "default" : "outline"} onClick={() => setIntroStylePosition("above")} size="sm">
                      Above
                    </Button>
                  </div>
                </>}
            </div>}

          {/* Overlay controls (Focus only) */}
          {viewMode === "focus" && <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="overlay-file" className="text-sm cursor-pointer">
                Overlay:
              </Label>
              
            </div>
            
            {overlayImage && <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Opacity:</Label>
                  <Slider value={[overlayOpacity]} onValueChange={v => setOverlayOpacity(v[0])} min={0} max={100} step={1} className="w-24" />
                  <span className="text-xs text-muted-foreground">{overlayOpacity}%</span>
                </div>
                <div className="flex gap-2">
                  <Button variant={overlayPosition === "below" ? "default" : "outline"} onClick={() => setOverlayPosition("below")} size="sm">
                    Below
                  </Button>
                  <Button variant={overlayPosition === "above" ? "default" : "outline"} onClick={() => setOverlayPosition("above")} size="sm">
                    Above
                  </Button>
                </div>
              </>}
            </div>}
        </div>
      </div>

      {/* Main visualization area */}
      <div className="max-w-7xl mx-auto flex justify-center items-center min-h-[600px] gap-8">
        {/* Layer navigation buttons - beside the grid, not overlaying */}
        {viewMode === "intro" && <div className="hidden lg:block flex-shrink-0">
            <LayerNavButtons onSelect={goToLayer} activeLayer={selectedLayer} layout="vertical" />
          </div>}
        
        <AnimatePresence mode="wait">
          {/* INTRO VIEW - Overlapped ↔ Exploded */}
          {viewMode === "intro" && <motion.div key="intro" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} className="relative flex flex-col items-center gap-6">
              {/* Mobile buttons - above grid */}
              <div className="lg:hidden w-full max-w-md">
                <LayerNavButtons onSelect={goToLayer} activeLayer={selectedLayer} layout="horizontal" />
              </div>
              
              <div className="relative" style={{
            perspective: "none"
          }}>
                {/* Intro Style Reference Overlay (below) */}
                {introStyleImage && introStylePosition === "below" && <img src={introStyleImage} alt="Intro style reference" className="absolute inset-0 m-auto pointer-events-none" style={{
              width: 520,
              height: 520,
              opacity: introStyleOpacity / 100,
              zIndex: 0
            }} />}

                {/* Circular click area for overlapped state */}
                {introMode === "overlapped" && <div className="absolute inset-0 m-auto cursor-pointer" style={{
              width: 520,
              height: 520,
              borderRadius: "50%",
              zIndex: 10
            }} onClick={handleIntroClick} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && handleIntroClick()} aria-label="Click to explode layers" />}

                {/* Background click area for exploded state */}
                {introMode === "exploded" && <div className="absolute inset-0 m-auto cursor-pointer" style={{
              width: 600,
              height: 600,
              zIndex: 1
            }} onClick={handleBackgroundClick} aria-label="Click background to return to overlapped view" />}

                {/* Layer stack */}
                <div className="relative" style={{
              transformStyle: "preserve-3d"
            }}>
                  {layers.map((layer, idx) => {
                const circleDiameter = 520;
                const ovalWidth = circleDiameter;
                const ovalHeight = circleDiameter * 0.22; // 114.4px
                const ellipseScaleY = 0.22; // vertical squash factor

                // Fixed 5px gap between ovals
                const gap = 5;
                let yOffset = 0;
                let containerHeight = circleDiameter;
                if (introMode === "overlapped") {
                  yOffset = 0; // All perfectly overlapped
                } else if (introMode === "exploded") {
                  // y(i) = centerY + (i - 2) * (ovalHeight + gap)
                  yOffset = (idx - 2) * (ovalHeight + gap);
                  containerHeight = ovalHeight;
                }

                // Unique clipPath ID for each layer
                const clipId = `oval-clip-${layer}`;
                return <motion.div key={layer} id={`layer-${layer}`} className="absolute overflow-hidden" style={{
                  zIndex: layers.length - idx + 10,
                  left: "50%",
                  top: "50%",
                  marginLeft: -ovalWidth / 2,
                  marginTop: introMode === "exploded" ? -ovalHeight / 2 : -circleDiameter / 2,
                  width: ovalWidth,
                  height: containerHeight,
                  pointerEvents: introMode === "exploded" ? "auto" : "none",
                  cursor: introMode === "exploded" ? "pointer" : "default"
                }} initial={false} animate={{
                  y: yOffset,
                  rotateX: 0
                }} transition={{
                  duration: 0.6,
                  ease: "easeOut"
                }} whileHover={introMode === "exploded" ? {
                  scale: 1.02
                } : undefined} onClick={e => {
                  if (introMode === "exploded") {
                    e.stopPropagation(); // Prevent background click
                    goToLayer(layer);
                  }
                }}>
                        {introMode === "exploded" ?
                  // Render live layer visualization in thin oval (with scaleY transform)
                  <svg width={ovalWidth} height={ovalHeight} viewBox={`0 0 ${ovalWidth} ${ovalHeight}`} style={{
                    display: 'block'
                  }}>
                            <defs>
                              {/* Ellipse clipPath */}
                              <clipPath id={clipId}>
                                <ellipse cx={ovalWidth / 2} cy={ovalHeight / 2} rx={ovalWidth / 2 - 1} ry={ovalHeight / 2 - 1} />
                              </clipPath>
                            </defs>
                            
                            {/* Container for scaled visualization */}
                            <g clipPath={`url(#${clipId})`}>
                              {/* Scale the entire layer visualization vertically */}
                              <g transform={`translate(${ovalWidth / 2}, ${ovalHeight / 2}) scale(1, ${ellipseScaleY}) translate(-${circleDiameter / 2}, -${circleDiameter / 2})`}>
                                <foreignObject width={circleDiameter} height={circleDiameter} style={{
                          pointerEvents: 'none'
                        }}>
                                  <div style={{
                            width: circleDiameter,
                            height: circleDiameter
                          }}>
                                    {renderLayer(layer)}
                                  </div>
                                </foreignObject>
                              </g>
                            </g>
                          </svg> :
                  // Render full layer visualization in overlapped view
                  renderLayer(layer)}
                      </motion.div>;
              })}
                </div>

                {/* Intro Style Reference Overlay (above) */}
                {introStyleImage && introStylePosition === "above" && <img src={introStyleImage} alt="Intro style reference" className="absolute inset-0 m-auto pointer-events-none" style={{
              width: 520,
              height: 520,
              opacity: introStyleOpacity / 100,
              zIndex: 20
            }} />}
              </div>

              {introMode === "overlapped" && <p className="text-center text-sm text-muted-foreground">
                  Click the circle to explode layers
                </p>}
              {introMode === "exploded" && <p className="text-center text-sm text-muted-foreground">
                  Click a layer to view • Click background or press Esc to collapse
                </p>}
            </motion.div>}

          {/* FOCUS VIEW - Single layer full circle */}
          {viewMode === "focus" && selectedLayer && <motion.div key="focus" initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} exit={{
          scale: 0.8,
          opacity: 0
        }} className="flex items-center gap-8">
              {/* Title on the left */}
              
              
              <div className="relative flex justify-center">
                {/* Overlay below */}
                {overlayImage && overlayPosition === "below" && <img src={overlayImage} alt="Overlay" className="absolute inset-0 m-auto" style={{
              width: 520,
              height: 520,
              opacity: overlayOpacity / 100,
              zIndex: 0
            }} />}

                {/* Layer visualization */}
                <div style={{
              position: "relative",
              zIndex: 1
            }}>
                  {renderLayer(selectedLayer)}
                </div>

                {/* Overlay above */}
                {overlayImage && overlayPosition === "above" && <img src={overlayImage} alt="Overlay" className="absolute inset-0 m-auto" style={{
              width: 520,
              height: 520,
              opacity: overlayOpacity / 100,
              zIndex: 2,
              pointerEvents: "none"
            }} />}
              </div>
            </motion.div>}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-xs text-muted-foreground">
        
      </div>
    </div>;
};
export default Index;