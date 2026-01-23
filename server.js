/**
 * Express Server
 * Serves frontend and API for video pipeline
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const Pipeline = require("./src/pipeline");
const { verifyToken, generateToken } = require("./src/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// API Routes

/**
 * Login endpoint
 * POST /api/login
 */
app.post("/api/login", async (req, res) => {
    try {
        const { password } = req.body;

        if (!password || password !== AUTH_PASSWORD) {
            return res.status(401).json({ success: false, error: "Invalid password" });
        }

        const token = generateToken({ authenticated: true });
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all running pipelines
 * GET /api/pipelines
 */
app.get("/api/pipelines", verifyToken, (req, res) => {
    const pipelines = Pipeline.getAllPipelines();
    res.json({ success: true, pipelines });
});

/**
 * SSE endpoint for all pipelines updates
 * GET /api/pipelines/stream
 */
app.get("/api/pipelines/stream", verifyToken, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendUpdate = () => {
        const pipelines = Pipeline.getAllPipelines();
        res.write(`data: ${JSON.stringify({ success: true, pipelines })}\n\n`);
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 1000);

    req.on("close", () => {
        clearInterval(interval);
    });
});

/**
 * Start download job
 * POST /api/start-download
 */
app.post("/api/start-download", verifyToken, async (req, res) => {
    try {
        const { url, title, cookies, linkType, videoType } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: "Missing url" });
        }

        const result = await Pipeline.start(url, cookies || "", {
            title,
            linkType: linkType || "auto",
            videoType: videoType || "sub"
        });

        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start pipeline job (alternative endpoint)
 * POST /api/pipeline
 */
app.post("/api/pipeline", verifyToken, async (req, res) => {
    try {
        const { anime_url, cookies, title, description, visibility, tags, linkType, videoType } = req.body;

        if (!anime_url) {
            return res.status(400).json({ success: false, error: "Missing anime_url" });
        }

        const result = await Pipeline.start(anime_url, cookies || "", {
            title,
            description,
            visibility,
            tags,
            linkType: linkType || "auto",
            videoType: videoType || "sub"
        });

        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get job status
 * GET /api/job/:jobId
 */
app.get("/api/job/:jobId", verifyToken, (req, res) => {
    const status = Pipeline.getStatus(req.params.jobId);
    res.json({ success: true, job: status });
});

/**
 * SSE endpoint for real-time job updates
 * GET /api/job/:jobId/stream
 */
app.get("/api/job/:jobId/stream", verifyToken, (req, res) => {
    const jobId = req.params.jobId;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendUpdate = () => {
        const job = Pipeline.getStatus(jobId);
        if (job && !job.error) {
            res.write(`data: ${JSON.stringify(job)}\n\n`);
            
            if (job.completed || job.status === "error" || job.status === "cancelled") {
                res.end();
                clearInterval(interval);
            }
        } else {
            res.write(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`);
            res.end();
            clearInterval(interval);
        }
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 1000);

    req.on("close", () => {
        clearInterval(interval);
    });
});

/**
 * Get job status (alternative endpoint)
 * GET /api/status/:jobId
 */
app.get("/api/status/:jobId", verifyToken, (req, res) => {
    const status = Pipeline.getStatus(req.params.jobId);
    res.json(status);
});

/**
 * Cancel job
 * POST /api/cancel/:jobId
 */
app.post("/api/cancel/:jobId", verifyToken, (req, res) => {
    const result = Pipeline.cancel(req.params.jobId);
    res.json(result);
});

/**
 * Pause job
 * POST /api/pause/:jobId
 */
app.post("/api/pause/:jobId", verifyToken, (req, res) => {
    const result = Pipeline.pause(req.params.jobId);
    res.json(result);
});

/**
 * Resume job
 * POST /api/resume/:jobId
 */
app.post("/api/resume/:jobId", verifyToken, (req, res) => {
    const result = Pipeline.resume(req.params.jobId);
    res.json(result);
});

/**
 * Clear failed jobs
 * POST /api/clear-failed
 */
app.post("/api/clear-failed", verifyToken, (req, res) => {
    const result = Pipeline.clearFailedJobs();
    res.json(result);
});

// Fallback to index.html for SPA
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving static files from ./public`);
    console.log(`🔐 Authentication enabled with password from .env`);
});
