import { useState } from "react";
import { LogOut, Play, Link2, Info, Loader2, List } from "lucide-react";
import PipelineList from "./PipelineList";
import EpisodePreview from "./EpisodePreview";
import { logout } from "../lib/auth";

interface MainAppProps {
  token: string;
  onLogout: () => void;
}

const MainApp = ({ token, onLogout }: MainAppProps) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [cookies, setCookies] = useState(() => localStorage.getItem("rumbleCookies") || "");
  const [linkType, setLinkType] = useState("auto");
  const [videoType, setVideoType] = useState("sub");
  const [uploadMode, setUploadMode] = useState<"single" | "bulk" | "all">("single");
  const [episodeRangeStart, setEpisodeRangeStart] = useState("");
  const [episodeRangeEnd, setEpisodeRangeEnd] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cookies.trim()) {
      alert("Please enter your Rumble cookies");
      return;
    }

    localStorage.setItem("rumbleCookies", cookies);
    setIsLoading(true);

    try {
      let endpoint = "/api/start-download";
      let payload: any = { cookies, linkType, videoType };

      if (uploadMode === "single") {
        payload.url = url;
        payload.title = title;
      } else if (uploadMode === "bulk") {
        const urls = bulkUrls.split("\n").filter(u => u.trim());
        if (urls.length === 0) {
          alert("Please enter at least one URL");
          setIsLoading(false);
          return;
        }
        endpoint = "/api/start-bulk-download";
        payload.urls = urls;
        payload.title = title;
      } else if (uploadMode === "all") {
        if (!url.includes("9animetv.to/watch/")) {
          alert("Please enter a valid 9anime URL");
          setIsLoading(false);
          return;
        }
        
        const animeId = url.split("/watch/")[1]?.split("?")[0];
        if (!animeId) {
          alert("Invalid anime URL");
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

      const response = await fetch(endpoint, {
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
        alert(`Started ${count} pipeline${count > 1 ? "s" : ""} successfully!`);
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex">
      {/* Left sidebar - Upload form */}
      <aside className="w-full lg:w-[420px] xl:w-[480px] bg-card border-r border-border flex flex-col">
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
          <button onClick={handleLogout} className="btn-ghost flex items-center gap-1.5 text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </header>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded bg-primary/5 border border-primary/10 mb-6">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">Supported:</span> Anime URLs, Direct M3U8/MP4 URLs
            </p>
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
                  placeholder="Enter one episode URL per line&#10;https://9animetv.to/watch/one-piece-100?ep=2142&#10;https://9animetv.to/watch/one-piece-100?ep=2143&#10;..."
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
                      placeholder="https://9animetv.to/watch/one-piece-100"
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

                {url && url.includes("9animetv.to/watch/") && (
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
              <label className="block text-sm text-muted-foreground mb-1.5">
                Custom Title <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave empty to auto-generate"
                className="input-field"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Auto-generates like "One Piece Episode 1"
              </p>
            </div>

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
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <PipelineList token={token} refreshTrigger={refreshTrigger} />
      </main>
    </div>
  );
};

export default MainApp;
