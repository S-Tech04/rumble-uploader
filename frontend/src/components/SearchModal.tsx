import { useState } from "react";
import { Search, X, Loader2, Calendar, Clock } from "lucide-react";
import { fetchWithAuth } from "../lib/fetchWithAuth";

interface AnimeResult {
  id: string;
  data_id: string;
  title: string;
  japanese_title: string;
  poster: string;
  duration: string;
  tvInfo: {
    showType: string;
    rating: string;
    sub: number;
    dub: number;
    eps: number;
  };
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (anime: AnimeResult) => void;
  token: string;
  isLoadingEpisodes?: boolean;
}

const SearchModal = ({ isOpen, onClose, onSelectAnime, token, isLoadingEpisodes }: SearchModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError("");

    try {
      const response = await fetchWithAuth(`/api/search?keyword=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.results && data.results.data) {
        setResults(data.results.data);
      } else {
        setError("No results found");
        setResults([]);
      }
    } catch (err) {
      setError("Search failed: " + (err as Error).message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Search Anime</h2>
          <button onClick={onClose} className="btn-ghost p-2" disabled={isLoadingEpisodes}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for anime..."
                className="input-field pl-10 w-full"
                autoFocus
                disabled={isLoadingEpisodes}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim() || isLoadingEpisodes}
              className="btn-primary px-6"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 relative">
          {isLoadingEpisodes && (
            <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Getting episode info...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive text-sm py-8">{error}</div>
          )}

          {results.length === 0 && !error && !isSearching && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Search for anime by title
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((anime) => (
              <button
                key={anime.id}
                onClick={() => onSelectAnime(anime)}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors text-left group"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={anime.poster}
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 bg-black/80 rounded px-2 py-1 text-xs font-medium text-white">
                    {anime.tvInfo.rating}
                  </div>
                </div>
                <div className="p-2">
                  <h3 className="font-medium text-foreground text-xs line-clamp-1 mb-1">
                    {anime.title}
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1.5">
                    {anime.japanese_title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {anime.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {anime.tvInfo.eps} eps
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {anime.tvInfo.sub > 0 && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] rounded font-medium">
                        SUB {anime.tvInfo.sub}
                      </span>
                    )}
                    {anime.tvInfo.dub > 0 && (
                      <span className="px-1.5 py-0.5 bg-secondary/30 text-secondary-foreground text-[9px] rounded font-medium">
                        DUB {anime.tvInfo.dub}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
