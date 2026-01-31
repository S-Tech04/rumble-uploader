import { useState, useEffect } from "react";
import { Link2, Play, Loader2, Info } from "lucide-react";

interface UploadFormProps {
  token: string;
  onPipelineStarted: () => void;
}

const UploadForm = ({ token, onPipelineStarted }: UploadFormProps) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [cookies, setCookies] = useState("");
  const [linkType, setLinkType] = useState("auto");
  const [videoType, setVideoType] = useState("sub");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedCookies = localStorage.getItem("rumbleCookies");
    if (savedCookies) {
      setCookies(savedCookies);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cookies.trim()) {
      alert("Please enter your Rumble cookies");
      return;
    }

    localStorage.setItem("rumbleCookies", cookies);
    setIsLoading(true);

    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Simulate success
      onPipelineStarted();
      setUrl("");
      setTitle("");
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
          <Play className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="text-foreground">Anime Video</span>{" "}
          <span className="gradient-text">Uploader</span>
        </h1>
      </div>
      <p className="text-muted-foreground mb-6 ml-13">
        Download and upload anime videos to Rumble with subtitles
      </p>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/20 mb-6">
        <Info className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-secondary">
          <strong>Supported:</strong> Anime URLs, Direct M3U8/MP4 URLs
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Video URL <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter anime URL, m3u8 or mp4 URL"
              required
              className="input-field w-full pl-12"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Link Type
            </label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="input-field w-full cursor-pointer"
            >
              <option value="auto">Auto Detect</option>
              <option value="anime">Anime URL</option>
              <option value="m3u8">M3U8 Direct</option>
              <option value="mp4">MP4 Direct</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Video Type (for Anime)
            </label>
            <select
              value={videoType}
              onChange={(e) => setVideoType(e.target.value)}
              className="input-field w-full cursor-pointer"
            >
              <option value="sub">Sub</option>
              <option value="dub">Dub</option>
              <option value="raw">Raw</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Custom Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave empty to auto-generate with episode number"
            className="input-field w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Episode number will be automatically fetched and title will be like "One Piece Episode 1"
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Rumble Cookies <span className="text-destructive">*</span>
          </label>
          <textarea
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            rows={3}
            placeholder="Paste your Rumble cookies here"
            className="input-field w-full resize-none font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="text-warning">💡</span> Cookies will be saved in browser. Open Rumble → F12 → Network → Copy cookies
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="primary-button w-full flex items-center justify-center gap-2 py-4 text-lg glow-effect"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start Pipeline
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default UploadForm;
