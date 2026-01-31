import { useState, useEffect, useCallback, useRef } from "react";
import { Rocket, RefreshCw, Trash2, X, ExternalLink, AlertCircle, CheckCircle, CheckSquare, Square, Wifi, WifiOff } from "lucide-react";

interface Pipeline {
  id: string;
  title?: string;
  url?: string;
  status: "pending" | "running" | "paused" | "completed" | "error" | "cancelled";
  step: string;
  message?: string;
  linkType?: string;
  videoType?: string;
  error?: string;
  videoUrl?: string;
  progress?: {
    percent?: number;
    sizeFormatted?: string;
  };
}

interface PipelineListProps {
  token: string;
  refreshTrigger: number;
}

const stepNames: Record<string, string> = {
  init: "Initializing",
  extract: "Extracting",
  download: "Downloading",
  subtitle: "Downloading Subtitle",
  upload: "Uploading",
  complete: "Completed",
};

const PipelineList = ({ token, refreshTrigger }: PipelineListProps) => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [usePolling, setUsePolling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch("/api/pipelines", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setPipelines(data.pipelines);
        // Clean up selected IDs that no longer exist
        setSelectedIds(prev => {
          const existingIds = new Set(data.pipelines.map((p: Pipeline) => p.id));
          const newSelected = new Set<string>();
          prev.forEach(id => {
            if (existingIds.has(id)) newSelected.add(id);
          });
          return newSelected;
        });
      }
    } catch (error) {
      console.error("Error fetching pipelines:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines, refreshTrigger]);

  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanupPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    cleanupPolling();
    setUsePolling(true);
    console.log("[PipelineList] Switching to polling mode");
    
    fetchPipelines();
    
    pollingIntervalRef.current = setInterval(() => {
      fetchPipelines();
    }, 2000);
  }, [fetchPipelines, cleanupPolling]);

  const connectSSE = useCallback(() => {
    cleanupEventSource();
    
    console.log(`[PipelineList] Connecting SSE (attempt ${reconnectAttemptsRef.current + 1})`);
    
    const eventSource = new EventSource(`/api/pipelines/stream?token=${token}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[PipelineList] SSE connection established");
      reconnectAttemptsRef.current = 0;
      setUsePolling(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success) {
          setPipelines(data.pipelines);
          setSelectedIds(prev => {
            const existingIds = new Set(data.pipelines.map((p: Pipeline) => p.id));
            const newSelected = new Set<string>();
            prev.forEach(id => {
              if (existingIds.has(id)) newSelected.add(id);
            });
            return newSelected;
          });
        }
      } catch (error) {
        console.error("[PipelineList] Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[PipelineList] SSE error:", error);
      cleanupEventSource();
      
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn("[PipelineList] Max reconnection attempts reached, switching to polling");
        startPolling();
        return;
      }
      
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      console.log(`[PipelineList] Reconnecting in ${delay}ms...`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, delay);
    };
  }, [token, cleanupEventSource, startPolling]);

  useEffect(() => {
    if (!usePolling) {
      connectSSE();
    } else {
      startPolling();
    }

    return () => {
      cleanupEventSource();
      cleanupPolling();
    };
  }, [token, usePolling, connectSSE, startPolling, cleanupEventSource, cleanupPolling]);

  const handleClearFailed = async () => {
    if (!confirm("Clear all failed/cancelled jobs?")) return;

    try {
      const response = await fetch("/api/clear-failed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        alert(`Cleared ${data.clearedCount} failed/cancelled jobs`);
        fetchPipelines();
      }
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    }
  };

  const handleClearCompleted = async () => {
    if (!confirm("Clear all completed jobs?")) return;

    try {
      const response = await fetch("/api/clear-completed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        alert(`Cleared ${data.clearedCount} completed jobs`);
        fetchPipelines();
      }
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert("No jobs selected");
      return;
    }

    if (!confirm(`Delete ${selectedIds.size} selected job(s)?`)) return;

    try {
      const response = await fetch("/api/delete-selected", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ jobIds: Array.from(selectedIds) }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Deleted ${data.deletedCount} job(s)`);
        setSelectedIds(new Set());
        fetchPipelines();
      } else {
        alert("Error deleting jobs: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Delete this job? This will stop the job if running and clean up all resources (video and subtitle files).")) return;

    try {
      const response = await fetch(`/api/job/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        fetchPipelines();
      } else {
        alert("Error deleting job: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      alert("Network error: " + (error as Error).message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pipelines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pipelines.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusStyles = (status: Pipeline["status"]) => {
    const styles: Record<string, string> = {
      pending: "bg-warning/10 text-warning",
      running: "bg-primary/10 text-primary",
      paused: "bg-warning/10 text-warning",
      completed: "bg-success/10 text-success",
      error: "bg-destructive/10 text-destructive",
      cancelled: "bg-muted text-muted-foreground",
    };
    return styles[status] || styles.pending;
  };

  const isAllSelected = pipelines.length > 0 && selectedIds.size === pipelines.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-background/50">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-primary" />
          <h2 className="text-foreground font-semibold">Pipelines</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {pipelines.length} active
          </span>
          {usePolling ? (
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Polling Mode
            </span>
          ) : (
            <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Live Stream
            </span>
          )}
          {pipelines.length > 0 && (
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleDeleteSelected} 
            disabled={selectedIds.size === 0}
            className="btn-danger text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
          <button onClick={handleClearCompleted} className="btn-success text-xs flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Clear Completed
          </button>
          <button onClick={handleClearFailed} className="btn-danger text-xs flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            Clear Failed
          </button>
          <button onClick={fetchPipelines} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {/* Pipeline list */}
      <div className="flex-1 overflow-y-auto p-6">
        {pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Rocket className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">No pipelines</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className={`p-4 border rounded bg-card transition-colors ${
                  selectedIds.has(pipeline.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleSelect(pipeline.id)}
                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {selectedIds.has(pipeline.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <h3 className="font-medium text-foreground text-sm truncate">
                      {pipeline.title || pipeline.url || "Processing..."}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`status-badge ${getStatusStyles(pipeline.status)}`}>
                      {pipeline.status}
                    </span>
                    <button
                      onClick={() => handleDeleteJob(pipeline.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                      title="Delete this job"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${pipeline.progress?.percent || 0}%` }}
                  />
                </div>

                {/* Details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                  <span>
                    <span className="text-foreground">{stepNames[pipeline.step] || pipeline.step}</span>
                  </span>
                  {pipeline.message && (
                    <span>{pipeline.message}</span>
                  )}
                  {pipeline.progress?.sizeFormatted && (
                    <span>{pipeline.progress.sizeFormatted}</span>
                  )}
                  <span className="text-muted-foreground/50">
                    {pipeline.linkType} / {pipeline.videoType}
                  </span>
                </div>

                {/* Error message */}
                {pipeline.error && (
                  <div className="mt-3 p-2.5 rounded bg-destructive/5 border border-destructive/10 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{pipeline.error}</p>
                  </div>
                )}

                {/* Success message */}
                {pipeline.videoUrl && (
                  <div className="mt-3 p-2.5 rounded bg-success/5 border border-success/10 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="text-success font-medium">Uploaded successfully</span>
                      <a
                        href={pipeline.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline mt-1"
                      >
                        {pipeline.videoUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PipelineList;
