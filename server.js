/**
 * Express Server
 * Serves frontend and API for video pipeline
 */

const express = require('express');
const path = require('path');
const Pipeline = require('./src/pipeline');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

/**
 * Start download job
 * POST /api/start-download
 */
app.post('/api/start-download', async (req, res) => {
    try {
        const { url, title, cookies } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'Missing url' });
        }

        const result = await Pipeline.start(url, cookies || '', {
            title
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
app.post('/api/pipeline', async (req, res) => {
    try {
        const { anime_url, cookies, title, description, visibility, tags } = req.body;

        if (!anime_url) {
            return res.status(400).json({ success: false, error: 'Missing anime_url' });
        }

        const result = await Pipeline.start(anime_url, cookies || '', {
            title,
            description,
            visibility,
            tags
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
app.get('/api/job/:jobId', (req, res) => {
    const status = Pipeline.getStatus(req.params.jobId);
    res.json({ success: true, job: status });
});

/**
 * Get job status (alternative endpoint)
 * GET /api/status/:jobId
 */
app.get('/api/status/:jobId', (req, res) => {
    const status = Pipeline.getStatus(req.params.jobId);
    res.json(status);
});

/**
 * Cancel job
 * POST /api/cancel/:jobId
 */
app.post('/api/cancel/:jobId', (req, res) => {
    const result = Pipeline.cancel(req.params.jobId);
    res.json(result);
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving static files from ./public`);
});
