/**
 * Express Server
 * Serves frontend and API for video pipeline
 */

require("dotenv").config();
const express = require("express");
const path = require("path");

const authRoutes = require("./src/routes/authRoutes");
const pipelineRoutes = require("./src/routes/pipelineRoutes");
const episodeRoutes = require("./src/routes/episodeRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api", authRoutes);
app.use("/api", pipelineRoutes);
app.use("/api", episodeRoutes);

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
