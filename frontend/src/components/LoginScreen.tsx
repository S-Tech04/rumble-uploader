import { useState } from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";

interface LoginScreenProps {
  onLogin: (token: string) => void;
}

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("authToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        onLogin(data.accessToken);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AV</span>
            </div>
            <span className="text-foreground font-semibold">Anime Uploader</span>
          </div>
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Upload videos to<br />
            <span className="gradient-text">Rumble seamlessly</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Download and upload anime videos with subtitles. 
            Support for direct M3U8/MP4 URLs.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          © 2024 Anime Video Uploader
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AV</span>
              </div>
              <span className="text-foreground font-semibold">Anime Uploader</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">Secure Login</span>
          </div>
          
          <h2 className="text-2xl font-semibold text-foreground mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Enter your password to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
