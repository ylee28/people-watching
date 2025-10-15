import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { StaticColors } from "@/components/layers/StaticColors";
import { StaticPostures } from "@/components/layers/StaticPostures";
import { StaticNotes } from "@/components/layers/StaticNotes";
import { DynamicMovement } from "@/components/layers/DynamicMovement";
import { DynamicCoverage } from "@/components/layers/DynamicCoverage";

type ViewMode = "intro" | "stack" | "focus";
type IntroMode = "overlapped" | "exploded" | "tilted";
type LayerType = "colors" | "postures" | "notes" | "movement" | "coverage";

const layerLabels: Record<LayerType, string> = {
  colors: "Colors",
  postures: "Postures",
  notes: "Notes",
  movement: "Movement: Path",
  coverage: "Movement: Coverage",
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

  const layers: LayerType[] = ["colors", "postures", "notes", "movement", "coverage"];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOverlayImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIntroStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setIntroStyleImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIntroClick = () => {
    if (introMode === "overlapped") {
      setIntroMode("exploded");
      // After explosion animation, transition to tilted
      setTimeout(() => {
        setIntroMode("tilted");
      }, 800);
    } else if (introMode === "tilted") {
      setViewMode("stack");
    }
  };

  const handleLayerClick = (layer: LayerType) => {
    setSelectedLayer(layer);
    setViewMode("focus");
  };

  const handleBack = () => {
    if (viewMode === "focus") {
      setViewMode("stack");
      setSelectedLayer(null);
    } else if (viewMode === "stack") {
      setViewMode("intro");
      setIntroMode("tilted");
    }
  };

  const renderLayer = (layer: LayerType) => {
    switch (layer) {
      case "colors":
        return <StaticColors />;
      case "postures":
        return <StaticPostures />;
      case "notes":
        return <StaticNotes />;
      case "movement":
        return <DynamicMovement />;
      case "coverage":
        return <DynamicCoverage />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header controls */}
      <div className="max-w-7xl mx-auto mb-8 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={viewMode === "intro" ? "default" : "outline"}
              onClick={() => {
                setViewMode("intro");
                setIntroMode("overlapped");
              }}
              size="sm"
            >
              Intro
            </Button>
            <Button
              variant={viewMode === "stack" ? "default" : "outline"}
              onClick={() => setViewMode("stack")}
              size="sm"
            >
              Layers
            </Button>
            {viewMode === "focus" && (
              <Button variant="outline" onClick={handleBack} size="sm">
                Back
              </Button>
            )}
          </div>

          {/* Intro Style Reference (Intro only) */}
          {viewMode === "intro" && (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="intro-style-file" className="text-sm cursor-pointer">
                  Intro Style:
                </Label>
                <Input
                  id="intro-style-file"
                  type="file"
                  accept="image/png,image/svg+xml"
                  onChange={handleIntroStyleUpload}
                  className="w-40 text-xs"
                />
              </div>
              
              {introStyleImage && (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Opacity:</Label>
                    <Slider
                      value={[introStyleOpacity]}
                      onValueChange={(v) => setIntroStyleOpacity(v[0])}
                      min={0}
                      max={100}
                      step={1}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">{introStyleOpacity}%</span>
                  </div>
                  <div className="flex gap-2">
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
                </>
              )}
            </div>
          )}

          {/* Overlay controls (Focus only) */}
          {viewMode === "focus" && (
            <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="overlay-file" className="text-sm cursor-pointer">
                Overlay:
              </Label>
              <Input
                id="overlay-file"
                type="file"
                accept="image/png,image/svg+xml"
                onChange={handleFileUpload}
                className="w-40 text-xs"
              />
            </div>
            
            {overlayImage && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Opacity:</Label>
                  <Slider
                    value={[overlayOpacity]}
                    onValueChange={(v) => setOverlayOpacity(v[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">{overlayOpacity}%</span>
                </div>
                <div className="flex gap-2">
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
              </>
            )}
            </div>
          )}
        </div>
      </div>

      {/* Main visualization area */}
      <div className="max-w-7xl mx-auto flex justify-center items-center min-h-[600px]">
        <AnimatePresence mode="wait">
          {/* INTRO VIEW - Overlapped → Exploded → Tilted */}
          {viewMode === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
              style={{ perspective: introMode === "tilted" ? "1000px" : "none" }}
            >
              {/* Intro Style Reference Overlay (below) */}
              {introStyleImage && introStylePosition === "below" && (
                <img
                  src={introStyleImage}
                  alt="Intro style reference"
                  className="absolute inset-0 m-auto pointer-events-none"
                  style={{
                    width: 520,
                    height: 520,
                    opacity: introStyleOpacity / 100,
                    zIndex: 0,
                  }}
                />
              )}

              {/* Circular click area for overlapped state */}
              {introMode === "overlapped" && (
                <div
                  className="absolute inset-0 m-auto cursor-pointer"
                  style={{
                    width: 520,
                    height: 520,
                    borderRadius: "50%",
                    zIndex: 10,
                  }}
                  onClick={handleIntroClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleIntroClick()}
                  aria-label="Click to explode layers"
                />
              )}

              {/* Layer stack */}
              <div
                className="relative"
                style={{
                  transformStyle: "preserve-3d",
                  cursor: introMode === "tilted" ? "pointer" : "default",
                }}
                onClick={introMode === "tilted" ? handleIntroClick : undefined}
              >
                {layers.map((layer, idx) => {
                  let yOffset = 0;
                  let rotateX = 0;
                  let shadow = "";

                  if (introMode === "overlapped") {
                    yOffset = 0; // All perfectly overlapped
                  } else if (introMode === "exploded") {
                    yOffset = idx * 48; // Even vertical spacing
                    shadow = "0 6px 12px rgba(0,0,0,0.08)";
                  } else if (introMode === "tilted") {
                    yOffset = idx * 48;
                    rotateX = 58;
                    shadow = "0 6px 12px rgba(0,0,0,0.08)";
                  }

                  return (
                    <motion.div
                      key={layer}
                      className="absolute"
                      style={{
                        zIndex: layers.length - idx,
                        left: "50%",
                        top: "50%",
                        marginLeft: -260,
                        marginTop: -260,
                        filter: shadow ? `drop-shadow(${shadow})` : undefined,
                      }}
                      initial={false}
                      animate={{
                        y: yOffset,
                        rotateX: rotateX,
                      }}
                      transition={{
                        duration: introMode === "exploded" ? 0.8 : 0.6,
                        ease: "easeOut",
                      }}
                    >
                      {/* Label for tilted state */}
                      {introMode === "tilted" && (
                        <div className="absolute -left-32 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                          {layerLabels[layer]}
                        </div>
                      )}
                      {renderLayer(layer)}
                    </motion.div>
                  );
                })}
              </div>

              {/* Intro Style Reference Overlay (above) */}
              {introStyleImage && introStylePosition === "above" && (
                <img
                  src={introStyleImage}
                  alt="Intro style reference"
                  className="absolute inset-0 m-auto pointer-events-none"
                  style={{
                    width: 520,
                    height: 520,
                    opacity: introStyleOpacity / 100,
                    zIndex: 20,
                  }}
                />
              )}

              {introMode === "overlapped" && (
                <p className="text-center mt-4 text-sm text-muted-foreground">
                  Click the circle to explode layers
                </p>
              )}
              {introMode === "tilted" && (
                <p className="text-center mt-4 text-sm text-muted-foreground">
                  Click to continue to layer selection
                </p>
              )}
            </motion.div>
          )}

          {/* STACK VIEW - Tilted ovals */}
          {viewMode === "stack" && (
            <motion.div
              key="stack"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              style={{ perspective: "1000px" }}
            >
              {layers.map((layer, idx) => (
                <motion.div
                  key={layer}
                  className="cursor-pointer"
                  style={{
                    transformStyle: "preserve-3d",
                  }}
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: 55 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleLayerClick(layer)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleLayerClick(layer)}
                >
                  <div className="relative bg-background border-2 border-border rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">{layerLabels[layer]}</span>
                      <div
                        className="w-16 h-16 bg-muted rounded-full border-2 border-border flex items-center justify-center text-xs"
                        style={{
                          background: `conic-gradient(from 0deg, hsl(var(--primary)) 0%, hsl(var(--muted)) 100%)`,
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* FOCUS VIEW - Single layer full circle */}
          {viewMode === "focus" && selectedLayer && (
            <motion.div
              key="focus"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-center mb-6">
                {layerLabels[selectedLayer]}
              </h2>
              
              <div className="relative flex justify-center">
                {/* Overlay below */}
                {overlayImage && overlayPosition === "below" && (
                  <img
                    src={overlayImage}
                    alt="Overlay"
                    className="absolute inset-0 m-auto"
                    style={{
                      width: 520,
                      height: 520,
                      opacity: overlayOpacity / 100,
                      zIndex: 0,
                    }}
                  />
                )}

                {/* Layer visualization */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  {renderLayer(selectedLayer)}
                </div>

                {/* Overlay above */}
                {overlayImage && overlayPosition === "above" && (
                  <img
                    src={overlayImage}
                    alt="Overlay"
                    className="absolute inset-0 m-auto"
                    style={{
                      width: 520,
                      height: 520,
                      opacity: overlayOpacity / 100,
                      zIndex: 2,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-xs text-muted-foreground">
        <p>
          Keyboard: <kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> to open,{" "}
          <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd> to go back
        </p>
      </div>
    </div>
  );
};

export default Index;