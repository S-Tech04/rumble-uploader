import { useState, useEffect } from "react";
import { LogOut, Play, Link2, Info, Loader2, List, Search, Trash2 } from "lucide-react";
import PipelineList from "./PipelineList";
import EpisodePreview from "./EpisodePreview";
import SearchModal from "./SearchModal";
import EpisodeSelector from "./EpisodeSelector";
import Toast, { ToastType } from "./Toast";
import ConfirmModal from "./ConfirmModal";
import { logout } from "../lib/auth";
import { fetchWithAuth, setUnauthorizedHandler } from "../lib/fetchWithAuth";

interface MainAppProps {
  token: string;
  onLogout: () => void;
}

const MainApp = ({ token, onLogout }: MainAppProps) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [titleFormat, setTitleFormat] = useState("default");
  const [cookies, setCookies] = useState(() => localStorage.getItem("rumbleCookies") || "");
  const [linkType, setLinkType] = useState("auto");
  const [videoType, setVideoType] = useState("sub");
  const [uploadMode, setUploadMode] = useState<"single" | "bulk" | "all">("single");
  const [episodeRangeStart, setEpisodeRangeStart] = useState("");
  const [episodeRangeEnd, setEpisodeRangeEnd] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      showToast("Session expired. Please login again.", "error");
      setTimeout(() => onLogout(), 1500);
    });
  }, [onLogout]);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleCleanup = async () => {
    setConfirmModal({
      message: "Are you sure you want to clear temp and downloaded folders? This cannot be undone.",
      onConfirm: () => {
        setConfirmModal(null);
        performCleanup();
      },
    });
  };

  const performCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const response = await fetchWithAuth("/api/cleanup-folders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast(data.message || "Failed to cleanup folders", "error");
      }
    } catch (error) {
      showToast("Failed to cleanup folders: " + (error as Error).message, "error");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleAnimeSelect = (anime: any) => {
    setSelectedAnime(anime);
    
    if (uploadMode === "single") {
      setIsEpisodeSelectorOpen(true);
    } else if (uploadMode === "bulk") {
      setIsEpisodeSelectorOpen(true);
    } else {
      setUrl(`https://9animetv.to/watch/${anime.id}`);
      setIsSearchOpen(false);
    }
  };

  const handleEpisodeConfirm = async (episodeNumber?: string, rangeStart?: string, rangeEnd?: string) => {
    if (!selectedAnime) return;

    setIsLoadingEpisodes(true);

    if (uploadMode === "single" && episodeNumber) {
      try {
        const response = await fetchWithAuth(`/api/episodes/${selectedAnime.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.success && data.results && data.results.episodes) {
          const episode = data.results.episodes.find((ep: any) => ep.episode_no === parseInt(episodeNumber));
          if (episode) {
            setUrl(`https://9animetv.to/watch/${episode.id}`);
            setLinkType("anime");
            setIsSearchOpen(false);
          } else {
            showToast("Episode not found", "error");
          }
        }
      } catch (error) {
        showToast("Failed to fetch episode: " + (error as Error).message, "error");
      } finally {
        setIsLoadingEpisodes(false);
      }
    } else if (uploadMode === "bulk" && rangeStart && rangeEnd) {
      try {
        const response = await fetchWithAuth(`/api/episodes/${selectedAnime.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.success && data.results && data.results.episodes) {
          const start = parseInt(rangeStart);
          const end = parseInt(rangeEnd);
          const episodeUrls = data.results.episodes
            .filter((ep: any) => ep.episode_no >= start && ep.episode_no <= end)
            .map((ep: any) => `https://9animetv.to/watch/${ep.id}`)
            .join("\n");
          
          if (episodeUrls) {
            setBulkUrls(episodeUrls);
            setIsSearchOpen(false);
          } else {
            showToast("No episodes found in the specified range", "error");
          }
        }
      } catch (error) {
        showToast("Failed to fetch episodes: " + (error as Error).message, "error");
      } finally {
        setIsLoadingEpisodes(false);
      }
    }
    
    setIsEpisodeSelectorOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cookies.trim()) {
      showToast("Please enter your Rumble cookies", "error");
      return;
    }

    localStorage.setItem("rumbleCookies", cookies);
    setIsLoading(true);

    try {
      let endpoint = "/api/start-download";
      let payload: any = { cookies, linkType, videoType, titleFormat };

      if (uploadMode === "single") {
        payload.url = url;
        payload.title = title;
      } else if (uploadMode === "bulk") {
        const urls = bulkUrls.split("\n").filter(u => u.trim());
        if (urls.length === 0) {
          showToast("Please enter at least one URL", "error");
          setIsLoading(false);
          return;
        }
        endpoint = "/api/start-bulk-download";
        payload.urls = urls;
        payload.title = title;
      } else if (uploadMode === "all") {
        const animeId = url.split("/watch/")[1]?.split("?")[0];
        if (!animeId) {
          showToast("Invalid anime URL - could not extract anime ID", "error");
          setIsLoading(false);
          return;
        }

        endpoint = "/api/start-bulk-episodes";
        payload.animeId = animeId;
        payload.title = title;
        
        if (episodeRangeStart && episodeRangeEnd) {
          payload.episodeRange = {
            start: parseInt(episodeRangeStart),
            end: parseInt(episodeRangeEnd)
          };
        }
      }

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setRefreshTrigger((prev) => prev + 1);
        setUrl("");
        setTitle("");
        setBulkUrls("");
        setEpisodeRangeStart("");
        setEpisodeRangeEnd("");
        
        const count = data.count || 1;
        showToast(`Started ${count} pipeline${count > 1 ? "s" : ""} successfully!`, "success");
      } else {
        showToast("Error: " + data.error, "error");
      }
    } catch (error) {
      showToast("Network error: " + (error as Error).message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen grid-bg flex flex-col lg:flex-row overflow-hidden">
      {/* Left sidebar - Upload form */}
      <aside className="w-full lg:w-[420px] xl:w-[480px] bg-card border-r lg:border-r border-b lg:border-b-0 border-border flex flex-col h-1/2 lg:h-screen max-h-1/2 lg:max-h-screen">
        {/* Header */}
        <header className="p-7 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AV</span>
            </div>
            <div>
              <h1 className="text-foreground font-semibold text-sm">Anime Uploader</h1>
              <p className="text-muted-foreground text-xs">Upload to Rumble</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className="btn-ghost flex items-center gap-1.5 text-xs"
              title="Clear temp and downloaded folders"
            >
              {isCleaningUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Clean
            </button>
            <button onClick={handleLogout} className="btn-ghost flex items-center gap-1.5 text-xs">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info banner */}
          <div className="flex items-center justify-between gap-2 p-3 rounded bg-primary/5 border border-primary/10 mb-6">
            <div className="flex items-start gap-2 flex-1">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-medium">Supported:</span> Anime URLs, Direct M3U8/MP4 URLs
              </p>
            </div>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
              type="button"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Upload Mode
              </label>
              <select
                value={uploadMode}
                onChange={(e) => setUploadMode(e.target.value as "single" | "bulk" | "all")}
                className="input-field cursor-pointer"
              >
                <option value="single">Single Episode</option>
                <option value="bulk">Bulk Episodes (Multiple URLs)</option>
                <option value="all">All Episodes (From Anime URL)</option>
              </select>
            </div>

            {uploadMode === "single" && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Video URL <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter anime URL, m3u8 or mp4 URL"
                    required
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            {uploadMode === "bulk" && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Episode URLs <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  rows={6}
                  placeholder="Enter one episode URL per line&#10;https://animesite.com/watch/anime-name?ep=1&#10;https://animesite.com/watch/anime-name?ep=2&#10;..."
                  required
                  className="input-field resize-none font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  <List className="w-3 h-3 inline mr-1" />
                  One URL per line
                </p>
              </div>
            )}

            {uploadMode === "all" && (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Anime URL <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://animesite.com/watch/anime-name"
                      required
                      className="input-field pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Enter anime page URL without episode number
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Episode Start <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={episodeRangeStart}
                      onChange={(e) => setEpisodeRangeStart(e.target.value)}
                      placeholder="1"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Episode End <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={episodeRangeEnd}
                      onChange={(e) => setEpisodeRangeEnd(e.target.value)}
                      placeholder="All"
                      className="input-field"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-3">
                  Leave empty to download all episodes
                </p>

                {url && url.includes("/watch/") && (
                  <EpisodePreview
                    animeId={url.split("/watch/")[1]?.split("?")[0] || ""}
                    token={token}
                    episodeRangeStart={episodeRangeStart}
                    episodeRangeEnd={episodeRangeEnd}
                  />
                )}
              </>
            )}

            {uploadMode === "single" && (
              <div className={`grid gap-3 ${linkType === "anime" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Link Type
                  </label>
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value)}
                    className="input-field cursor-pointer"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="anime">Anime URL</option>
                    <option value="m3u8">M3U8 Direct</option>
                    <option value="mp4">MP4 Direct</option>
                  </select>
                </div>

                {linkType === "anime" && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Video Type
                    </label>
                    <select
                      value={videoType}
                      onChange={(e) => setVideoType(e.target.value)}
                      className="input-field cursor-pointer"
                    >
                      <option value="sub">Sub</option>
                      <option value="dub">Dub</option>
                      <option value="raw">Raw</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {(uploadMode === "bulk" || uploadMode === "all") && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Video Type
                </label>
                <select
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value)}
                  className="input-field cursor-pointer"
                >
                  <option value="sub">Sub</option>
                  <option value="dub">Dub</option>
                  <option value="raw">Raw</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Applies to all episodes in bulk upload
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Title Format
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setTitleFormat("default")}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    titleFormat === "default"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Default
                </button>
                <button
                  type="button"
                  onClick={() => setTitleFormat("japanese")}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    titleFormat === "japanese"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Japanese
                </button>
                <button
                  type="button"
                  onClick={() => setTitleFormat("english")}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    titleFormat === "english"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  English
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {titleFormat === "default" && "Auto-generates like \"Frieren: Beyond Journey's End Episode 1\""}
                {titleFormat === "japanese" && "Format: \"Sousou no Frieren Episode 1\""}
                {titleFormat === "english" && "Format: \"Frieren: Beyond Journey's End Episode 1\""}
              </p>
            </div>

            {titleFormat === "default" && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Custom Title <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="{en} Episode {ep_no}"
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{"{"}jp{"}"}</code> for Japanese title, <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{"{"}en{"}"}</code> for English title, <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{"{"}ep_no{"}"}</code> for episode number
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Rumble Cookies <span className="text-destructive">*</span>
              </label>
              <textarea
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                rows={3}
                placeholder="Paste your Rumble cookies here"
                className="input-field resize-none font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                💡 Open Rumble → F12 → Network → Copy cookies
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Pipeline
                </>
              )}
            </button>
          </form>
        </div>
      </aside>

      {/* Right content - Pipelines */}
      <main className="flex-1 flex flex-col h-1/2 lg:h-screen max-h-1/2 lg:max-h-screen overflow-hidden">
        <PipelineList token={token} refreshTrigger={refreshTrigger} />
      </main>

      {/* Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAnime={handleAnimeSelect}
        token={token}
        isLoadingEpisodes={isLoadingEpisodes}
      />
      
      <EpisodeSelector
        isOpen={isEpisodeSelectorOpen}
        onClose={() => setIsEpisodeSelectorOpen(false)}
        onConfirm={handleEpisodeConfirm}
        mode={uploadMode === "single" ? "single" : "bulk"}
        totalEpisodes={selectedAnime?.tvInfo?.eps}
        animeTitle={selectedAnime?.title || ""}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={true}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default MainApp;
