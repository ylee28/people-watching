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
  const [selectedLayer, setSelectedLayer] = React.useState<LayerType | null>(null);
  const [overlayImage, setOverlayImage] = React.useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = React.useState(50);
  const [overlayPosition, setOverlayPosition] = React.useState<"above" | "below">("below");

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
              onClick={() => setViewMode("intro")}
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

          {/* Overlay controls */}
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
        </div>
      </div>

      {/* Main visualization area */}
      <div className="max-w-7xl mx-auto flex justify-center items-center min-h-[600px]">
        <AnimatePresence mode="wait">
          {/* INTRO VIEW - Stacked circles */}
          {viewMode === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative cursor-pointer"
              onClick={() => setViewMode("stack")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setViewMode("stack")}
            >
              <div className="relative" style={{ width: 520, height: 520 }}>
                {layers.map((layer, idx) => (
                  <motion.div
                    key={layer}
                    className="absolute inset-0"
                    style={{
                      zIndex: layers.length - idx,
                      top: idx * 4,
                    }}
                    initial={{ y: 0 }}
                    animate={{ y: idx * 4 }}
                  >
                    {renderLayer(layer)}
                  </motion.div>
                ))}
              </div>
              <p className="text-center mt-4 text-sm text-muted-foreground">
                Click to view layers
              </p>
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