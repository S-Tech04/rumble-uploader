const Pipeline = require("../pipeline");

exports.getAllPipelines = (req, res) => {
    const pipelines = Pipeline.getAllPipelines();
    res.json({ success: true, pipelines });
};

exports.streamAllPipelines = (req, res) => {
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
};

exports.startDownload = async (req, res) => {
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
};

exports.startPipeline = async (req, res) => {
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
};

exports.getJobStatus = (req, res) => {
    const status = Pipeline.getStatus(req.params.jobId);
    res.json({ success: true, job: status });
};

exports.streamJobStatus = (req, res) => {
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
};

exports.cancelJob = (req, res) => {
    const result = Pipeline.cancel(req.params.jobId);
    res.json(result);
};

exports.pauseJob = (req, res) => {
    const result = Pipeline.pause(req.params.jobId);
    res.json(result);
};

exports.resumeJob = (req, res) => {
    const result = Pipeline.resume(req.params.jobId);
    res.json(result);
};

exports.clearFailedJobs = (req, res) => {
    const result = Pipeline.clearFailedJobs();
    res.json(result);
};

exports.clearCompletedJobs = (req, res) => {
    const result = Pipeline.clearCompletedJobs();
    res.json(result);
};

exports.deleteSelectedJobs = (req, res) => {
    const { jobIds } = req.body;
    if (!jobIds || !Array.isArray(jobIds)) {
        return res.status(400).json({ success: false, error: "Missing or invalid jobIds array" });
    }
    const result = Pipeline.deleteSelectedJobs(jobIds);
    res.json(result);
};

exports.deleteJob = (req, res) => {
    const result = Pipeline.deleteJob(req.params.jobId);
    res.json(result);
};

exports.startBulkDownload = async (req, res) => {
    try {
        const { urls, cookies, linkType, videoType, title } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, error: "Missing or invalid urls array" });
        }

        const results = [];
        
        for (const url of urls) {
            try {
                const result = await Pipeline.start(url, cookies || "", {
                    title,
                    linkType: linkType || "anime",
                    videoType: videoType || "sub"
                });
                results.push(result);
            } catch (error) {
                console.error(`Failed to start pipeline for ${url}:`, error.message);
            }
        }

        res.json({ 
            success: true, 
            count: results.length,
            results 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
