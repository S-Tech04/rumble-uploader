import { useState } from "react";
import { X } from "lucide-react";

interface EpisodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (episodeNumber?: string, rangeStart?: string, rangeEnd?: string) => void;
  mode: "single" | "bulk";
  totalEpisodes?: number;
  animeTitle: string;
}

const EpisodeSelector = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  mode, 
  totalEpisodes,
  animeTitle 
}: EpisodeSelectorProps) => {
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const handleConfirm = () => {
    if (mode === "single") {
      if (!episodeNumber || parseInt(episodeNumber) < 1) {
        alert("Please enter a valid episode number");
        return;
      }
      onConfirm(episodeNumber);
    } else {
      if (!rangeStart || !rangeEnd || parseInt(rangeStart) < 1 || parseInt(rangeEnd) < parseInt(rangeStart)) {
        alert("Please enter a valid episode range");
        return;
      }
      onConfirm(undefined, rangeStart, rangeEnd);
    }
    handleClose();
  };

  const handleClose = () => {
    setEpisodeNumber("");
    setRangeStart("");
    setRangeEnd("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {mode === "single" ? "Select Episode" : "Select Episode Range"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{animeTitle}</p>
          </div>
          <button onClick={handleClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {mode === "single" ? (
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Episode Number <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={totalEpisodes}
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                placeholder="Enter episode number"
                className="input-field w-full"
                autoFocus
              />
              {totalEpisodes && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Total episodes available: {totalEpisodes}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Start Episode <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={totalEpisodes}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  placeholder="1"
                  className="input-field w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  End Episode <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={totalEpisodes}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  placeholder={totalEpisodes?.toString() || ""}
                  className="input-field w-full"
                />
              </div>
              {totalEpisodes && (
                <p className="text-xs text-muted-foreground">
                  Total episodes available: {totalEpisodes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={handleClose} className="btn-ghost px-4">
            Cancel
          </button>
          <button onClick={handleConfirm} className="btn-primary px-6">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default EpisodeSelector;
