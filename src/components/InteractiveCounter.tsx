import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

export const InteractiveCounter: React.FC = () => {
  const [count, setCount] = React.useState(0);
  const [history, setHistory] = React.useState<number[]>([0]);

  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    setHistory(prev => [...prev, newCount]);
  };

  const decrement = () => {
    const newCount = count - 1;
    setCount(newCount);
    setHistory(prev => [...prev, newCount]);
  };

  const reset = () => {
    setCount(0);
    setHistory([0]);
  };

  const getCounterColor = () => {
    if (count > 0) return "text-green-600";
    if (count < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <Card className="w-full max-w-sm mx-auto bg-white/90 backdrop-blur-sm shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold text-gray-900">Interactive Counter</CardTitle>
        <CardDescription className="text-gray-600">
          A simple counter with history tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-4xl font-bold ${getCounterColor()}`} aria-live="polite">
            {count}
          </div>
          <Badge variant="secondary" className="mt-2">
            Total changes: {history.length - 1}
          </Badge>
        </div>

        <div className="flex justify-center space-x-2">
          <Button
            onClick={decrement}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Decrease counter"
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={reset}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Reset counter"
          >
            <RotateCcwIcon className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={increment}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Increase counter"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>

        {history.length > 1 && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Recent history:</p>
            <div className="flex flex-wrap justify-center gap-1">
              {history.slice(-5).map((value, index) => (
                <Badge
                  key={index}
                  variant={value === count ? "default" : "secondary"}
                  className="text-xs"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
