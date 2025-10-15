import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { polarToCartesian } from "@/components/CircularGrid";

interface PersonData {
  id: string;
  color?: string;
  angleDeg?: number;
  posture?: string;
  note?: string;
}

/**
 * Person detail page - Shows all available data for a specific person ID
 */
const Person = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [personData, setPersonData] = React.useState<PersonData>({ id: id || "" });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadPersonData = async () => {
      const data: PersonData = { id: id || "" };

      try {
        // Try to load from all data sources
        const [colors, postures, notes] = await Promise.all([
          fetch("/data/colors.json").then((r) => r.json()).catch(() => []),
          fetch("/data/postures.json").then((r) => r.json()).catch(() => []),
          fetch("/data/notes.json").then((r) => r.json()).catch(() => []),
        ]);

        const colorData = colors.find((c: any) => c.id === id);
        const postureData = postures.find((p: any) => p.id === id);
        const noteData = notes.find((n: any) => n.id === id);

        if (colorData) {
          data.color = colorData.color;
          data.angleDeg = colorData.angleDeg;
        }
        if (postureData) {
          data.posture = postureData.posture;
          data.angleDeg = data.angleDeg || postureData.angleDeg;
        }
        if (noteData) {
          data.note = noteData.words;
          data.angleDeg = data.angleDeg || noteData.angleDeg;
        }

        setPersonData(data);
      } catch (err) {
        console.error("Failed to load person data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPersonData();
  }, [id]);

  const miniCircleSize = 200;
  const center = miniCircleSize / 2;
  const radius = miniCircleSize / 2 - 20;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Person Details</CardTitle>
            <CardDescription>ID: {id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <>
                {/* Data display */}
                <div className="space-y-4">
                  {personData.color && (
                    <div className="flex items-center gap-4">
                      <span className="font-medium w-24">Color:</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border-2 border-border"
                          style={{ backgroundColor: personData.color }}
                        />
                        <Badge variant="secondary">{personData.color}</Badge>
                      </div>
                    </div>
                  )}

                  {personData.posture && (
                    <div className="flex items-center gap-4">
                      <span className="font-medium w-24">Posture:</span>
                      <Badge>{personData.posture}</Badge>
                    </div>
                  )}

                  {personData.note && (
                    <div className="flex items-start gap-4">
                      <span className="font-medium w-24">Note:</span>
                      <p className="flex-1 text-sm">{personData.note}</p>
                    </div>
                  )}

                  {personData.angleDeg !== undefined && (
                    <div className="flex items-center gap-4">
                      <span className="font-medium w-24">Position:</span>
                      <Badge variant="outline">{personData.angleDeg}°</Badge>
                    </div>
                  )}

                  {!personData.color && !personData.posture && !personData.note && (
                    <p className="text-muted-foreground text-sm">
                      No additional data found for this person.
                    </p>
                  )}
                </div>

                {/* Mini circle preview */}
                {personData.angleDeg !== undefined && (
                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-medium mb-4">Position Preview</h3>
                    <div className="flex justify-center">
                      <svg width={miniCircleSize} height={miniCircleSize}>
                        {/* Circle */}
                        <circle
                          cx={center}
                          cy={center}
                          r={radius}
                          fill="none"
                          stroke="hsl(var(--border))"
                          strokeWidth="2"
                        />
                        {/* Position marker */}
                        <circle
                          {...polarToCartesian(center, center, radius, personData.angleDeg)}
                          r="8"
                          fill={personData.color || "hsl(var(--primary))"}
                          stroke="white"
                          strokeWidth="2"
                        />
                        {/* Angle line */}
                        <line
                          x1={center}
                          y1={center}
                          {...polarToCartesian(center, center, radius, personData.angleDeg)}
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth="1"
                          strokeDasharray="4 2"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Person;