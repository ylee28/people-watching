import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

/**
 * CSVUploader: Allows users to upload a CSV file with position data
 */
export const CSVUploader: React.FC = () => {
  const { loadCSVData } = usePeoplePlaybackStore();
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    loadCSVData(text);
  };
  
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="csv-file" className="text-sm cursor-pointer">
        Load Positions (CSV):
      </Label>
      <Input
        id="csv-file"
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="w-auto cursor-pointer"
      />
    </div>
  );
};
