import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface Episode {
  episode_no: number;
  id: string;
  title: string;
  japanese_title: string;
  filler: boolean;
}

interface EpisodePreviewProps {
  animeId: string;
  token: string;
  episodeRangeStart?: string;
  episodeRangeEnd?: string;
}

const EpisodePreview = ({ animeId, token, episodeRangeStart, episodeRangeEnd }: EpisodePreviewProps) => {
  const [loading, setLoading] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState("");
  const [totalEpisodes, setTotalEpisodes] = useState(0);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`/api/episodes/${animeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.results) {
        let allEpisodes = data.results.episodes;
        setTotalEpisodes(data.results.totalEpisodes);

        if (episodeRangeStart && episodeRangeEnd) {
          const start = parseInt(episodeRangeStart);
          const end = parseInt(episodeRangeEnd);
          allEpisodes = allEpisodes.filter(
            (ep: Episode) => ep.episode_no >= start && ep.episode_no <= end
          );
        }

        setEpisodes(allEpisodes.slice(0, 10));
      } else {
        setError(data.error || "Failed to fetch episodes");
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!animeId) {
    return null;
  }

  return (
    <div className="border border-border rounded p-3 bg-card/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">Episode Preview</h3>
        <button
          onClick={fetchEpisodes}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </>
          ) : (
            "Preview Episodes"
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/5 border border-destructive/10">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckCircle className="w-3 h-3" />
            <span>
              Found {totalEpisodes} episodes
              {episodeRangeStart && episodeRangeEnd && ` (showing ${episodes.length} in range)`}
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                className="flex items-start gap-2 p-1.5 rounded bg-muted/50"
              >
                <span className="text-primary font-medium shrink-0">
                  Ep {ep.episode_no}
                </span>
                <span className="text-muted-foreground truncate">
                  {ep.title}
                </span>
              </div>
            ))}
            {episodes.length < totalEpisodes && (
              <p className="text-muted-foreground text-center py-1">
                ... and {totalEpisodes - episodes.length} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EpisodePreview;
