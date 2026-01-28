/**
 * Pipeline Orchestrator - Node.js
 * Manages the extraction, download, and upload workflow
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const AnimeExtractor = require("./extractors/9anime");
const HLSDownloader = require("./downloader");
const RumbleUploader = require("./uploader");

const TEMP_DIR = path.join(__dirname, "..", "temp");
const DOWNLOADED_DIR = path.join(__dirname, "..", "downloaded");
const API_BASE = process.env.API_BASE || "https://anime-api-itzzzme.vercel.app/api";

// Job storage (in-memory for simplicity)
const jobs = new Map();

class Pipeline {
    /**
     * Get all pipelines
     */
    static getAllPipelines() {
        return Array.from(jobs.values());
    }

    /**
     * Start a new pipeline job
     */
    static async start(videoUrl, cookies, options = {}) {
        const jobId = uuidv4();

        // Initialize job status
        const job = {
            id: jobId,
            url: videoUrl,
            status: "running",
            step: "extract",
            message: "Initializing...",
            progress: {},
            completed: false,
            createdAt: new Date(),
            linkType: options.linkType || "auto",
            videoType: options.videoType || "sub"
        };

        jobs.set(jobId, job);

        // Run pipeline in background
        this.runPipeline(jobId, videoUrl, cookies, options).catch(err => {
            this.updateJob(jobId, {
                status: "error",
                error: err.message,
                completed: true
            });
        });

        return { success: true, jobId };
    }

    /**
     * Get job status
     */
    static getStatus(jobId) {
        const job = jobs.get(jobId);
        if (!job) {
            return { error: "Job not found" };
        }
        return job;
    }

    /**
     * Cancel a job
     */
    static cancel(jobId) {
        const job = jobs.get(jobId);
        if (job) {
            job.status = "cancelled";
            job.completed = true;
            job.error = "Cancelled by user";
        }
        return { success: true };
    }

    /**
     * Pause a job
     */
    static pause(jobId) {
        const job = jobs.get(jobId);
        if (job && job.status === "running") {
            job.paused = true;
            job.status = "paused";
            job.message = "Paused by user";
        }
        return { success: true };
    }

    /**
     * Resume a job
     */
    static resume(jobId) {
        const job = jobs.get(jobId);
        if (job && job.status === "paused") {
            job.paused = false;
            job.status = "running";
            job.message = "Resuming...";
        }
        return { success: true };
    }

    /**
     * Clear failed jobs
     */
    static clearFailedJobs() {
        let clearedCount = 0;
        for (const [jobId, job] of jobs.entries()) {
            if (job.status === "error" || job.status === "cancelled") {
                jobs.delete(jobId);
                clearedCount++;
            }
        }
        return { success: true, clearedCount };
    }

    /**
     * Clear completed jobs
     */
    static clearCompletedJobs() {
        let clearedCount = 0;
        for (const [jobId, job] of jobs.entries()) {
            if (job.status === "completed") {
                jobs.delete(jobId);
                clearedCount++;
            }
        }
        return { success: true, clearedCount };
    }

    /**
     * Delete selected jobs by IDs
     */
    static deleteSelectedJobs(jobIds) {
        let deletedCount = 0;
        for (const jobId of jobIds) {
            if (jobs.has(jobId)) {
                const job = jobs.get(jobId);
                // Cancel running jobs first
                if (job.status === "running" || job.status === "paused") {
                    job.status = "cancelled";
                    job.completed = true;
                }
                jobs.delete(jobId);
                deletedCount++;
            }
        }
        return { success: true, deletedCount };
    }

    /**
     * Delete a single job by ID
     */
    static deleteJob(jobId) {
        if (jobs.has(jobId)) {
            const job = jobs.get(jobId);
            // Cancel running jobs first
            if (job.status === "running" || job.status === "paused") {
                job.status = "cancelled";
                job.completed = true;
            }
            jobs.delete(jobId);
            return { success: true, deleted: true };
        }
        return { success: false, error: "Job not found" };
    }

    /**
     * Update job status
     */
    static updateJob(jobId, updates) {
        const job = jobs.get(jobId);
        if (job) {
            Object.assign(job, updates);
        }
    }

    /**
     * Fetch episodes list and find episode number
     */
    static async fetchEpisodeNumber(animeId, episodeIdFromUrl) {
        try {
            const episodesUrl = `${API_BASE}/episodes/${animeId}`;
            console.log(`[Pipeline] Fetching episodes from: ${episodesUrl}`);

            const response = await axios.get(episodesUrl, { timeout: 10000 });

            if (response.data.success && response.data.results.episodes) {
                const episodes = response.data.results.episodes;
                const episode = episodes.find(ep => ep.id === episodeIdFromUrl);

                if (episode) {
                    console.log(`[Pipeline] Found episode: ${episode.episode_no} - ${episode.title}`);
                    return {
                        episodeNumber: episode.episode_no,
                        episodeTitle: episode.title
                    };
                }
            }
            return null;
        } catch (error) {
            console.error(`[Pipeline] Error fetching episodes: ${error.message}`);
            return null;
        }
    }

    /**
     * Download subtitle file
     */
    static async downloadSubtitle(url, outputPath) {
        try {
            console.log(`[Pipeline] Downloading subtitle from: ${url}`);
            const response = await axios.get(url, {
                responseType: "text",
                timeout: 30000
            });

            fs.writeFileSync(outputPath, response.data, "utf8");
            console.log(`[Pipeline] Subtitle saved to: ${outputPath}`);
            return { success: true, path: outputPath };
        } catch (error) {
            console.error(`[Pipeline] Subtitle download error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Run the pipeline
     */
    static async runPipeline(jobId, videoUrl, cookies, options) {
        const job = jobs.get(jobId);
        if (!job) return;

        let outputFile = null;
        let episodeId = null;
        let subtitlePath = null;
        let subtitleUrl = null;

        try {
            // Ensure directories exist
            if (!fs.existsSync(TEMP_DIR)) {
                fs.mkdirSync(TEMP_DIR, { recursive: true });
            }
            if (!fs.existsSync(DOWNLOADED_DIR)) {
                fs.mkdirSync(DOWNLOADED_DIR, { recursive: true });
            }

            const linkType = options.linkType || "auto";
            const videoType = options.videoType || "sub";
            let m3u8Url = null;
            let title = options.title;
            let extractResult = null;

            // Check if paused
            const job = jobs.get(jobId);
            if (job && job.paused) {
                await this.waitWhilePaused(jobId);
            }

            // Step 1: Extract based on link type
            this.updateJob(jobId, {
                step: "extract",
                status: "running",
                message: "Extracting video info..."
            });

            if (linkType === "mp4" || (linkType === "auto" && videoUrl.toLowerCase().endsWith(".mp4"))) {
                // Direct MP4 download
                console.log(`[Pipeline] Direct MP4 download: ${videoUrl}`);
                title = title || "Direct MP4 Video";
                episodeId = "mp4_" + Date.now();

                const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
                outputFile = path.join(DOWNLOADED_DIR, `${episodeId}_${safeTitle}.mp4`);

                this.updateJob(jobId, {
                    step: "download",
                    status: "running",
                    title: title,
                    message: "Downloading MP4 file..."
                });

                // Download MP4 directly
                const response = await axios({
                    method: "GET",
                    url: videoUrl,
                    responseType: "stream",
                    timeout: 300000
                });

                const writer = fs.createWriteStream(outputFile);
                let downloadedBytes = 0;
                const totalBytes = parseInt(response.headers["content-length"] || "0");

                response.data.on("data", (chunk) => {
                    downloadedBytes += chunk.length;
                    const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

                    this.updateJob(jobId, {
                        step: "download",
                        message: `Downloading MP4: ${percent}%`,
                        progress: {
                            percent,
                            size: downloadedBytes,
                            sizeFormatted: this.formatBytes(downloadedBytes)
                        }
                    });
                });

                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });

                console.log(`[Pipeline] MP4 downloaded: ${outputFile}`);

            } else if (linkType === "m3u8" || (linkType === "auto" && videoUrl.includes(".m3u8"))) {
                // Direct M3U8 URL
                console.log(`[Pipeline] Direct M3U8 URL: ${videoUrl}`);
                m3u8Url = videoUrl;
                title = title || "Direct M3U8 Video";
                episodeId = "m3u8_" + Date.now();

            } else {
                // Anime URL - extract using anime API
                const extractor = new AnimeExtractor();
                extractResult = await extractor.extract(videoUrl, videoType);

                if (!extractResult.success) {
                    throw new Error(`Extraction failed: ${extractResult.error}`);
                }

                m3u8Url = extractResult.m3u8;
                episodeId = extractResult.episodeId || "unknown";

                // Extract anime slug from URL for episode lookup
                const animeSlugMatch = videoUrl.match(/\/watch\/([^\/?]+)/);
                const animeSlug = animeSlugMatch ? animeSlugMatch[1] : null;

                // Get episode number from episodes API
                if (animeSlug) {
                    const fullEpisodeId = `${animeSlug}?ep=${episodeId}`;
                    const episodeInfo = await this.fetchEpisodeNumber(animeSlug, fullEpisodeId);
                    if (episodeInfo) {
                        title = title || `${extractResult.title} Episode ${episodeInfo.episodeNumber}`;
                    } else {
                        title = title || extractResult.title;
                    }
                } else {
                    title = title || extractResult.title;
                }

                // Get English subtitle if available
                if (extractResult.subtitles && extractResult.subtitles.length > 0) {
                    const englishSub = extractResult.subtitles.find(sub =>
                        sub.label && sub.label.toLowerCase() === "english" && sub.file
                    );

                    if (englishSub) {
                        subtitleUrl = englishSub.file;
                        console.log(`[Pipeline] Found English subtitle: ${subtitleUrl}`);
                    }
                }
            }

            console.log(`[Pipeline] Episode ID: ${episodeId}, Title: ${title}`);

            // Generate output filename based on episode ID
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
            outputFile = outputFile || path.join(DOWNLOADED_DIR, `ep_${episodeId}_${safeTitle}.mp4`);

            // Download M3U8 if we have one and file doesn't exist
            if (m3u8Url) {
                // Check if file already exists
                if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 1000) {
                    console.log(`[Pipeline] File already exists: ${outputFile}`);
                    const fileSize = fs.statSync(outputFile).size;

                    this.updateJob(jobId, {
                        step: "download",
                        status: "running",
                        title: title,
                        message: "File already downloaded, skipping to upload...",
                        progress: {
                            percent: 100,
                            size: fileSize,
                            sizeFormatted: this.formatBytes(fileSize)
                        }
                    });
                } else {
                    // Need to download
                    this.updateJob(jobId, {
                        step: "download",
                        status: "running",
                        title: title,
                        m3u8: m3u8Url,
                        message: "Starting download...",
                        progress: { percent: 0, downloaded: 0, total: 0 }
                    });

                    // Check if cancelled
                    if (jobs.get(jobId)?.status === "cancelled") return;

                    // Download to temp first, then move to downloaded folder
                    const tempFile = path.join(TEMP_DIR, `video_${jobId}.mp4`);

                    const downloader = new HLSDownloader({
                        maxParallel: 20,
                        referer: extractResult?.source === "9anime" ? "https://rapid-cloud.co/" : undefined,
                        progressCallback: (stage, data) => {
                            if (stage === "downloading") {
                                this.updateJob(jobId, {
                                    step: "download",
                                    message: `Downloading: ${data.percent}%`,
                                    progress: {
                                        downloaded: data.downloaded,
                                        total: data.total,
                                        percent: data.percent
                                    }
                                });
                            } else if (stage === "converting") {
                                this.updateJob(jobId, {
                                    step: "download",
                                    message: "Converting to MP4..."
                                });
                            }
                        }
                    });

                    const downloadResult = await downloader.download(m3u8Url, tempFile);

                    if (!downloadResult.success) {
                        throw new Error(`Download failed: ${downloadResult.error}`);
                    }

                    // Move from temp to downloaded folder
                    console.log(`[Pipeline] Moving file to: ${outputFile}`);
                    fs.renameSync(tempFile, outputFile);

                    const fileSize = fs.statSync(outputFile).size;
                    this.updateJob(jobId, {
                        step: "download",
                        status: "running",
                        message: "Download complete, ready for upload...",
                        progress: {
                            percent: 100,
                            size: fileSize,
                            sizeFormatted: this.formatBytes(fileSize)
                        }
                    });
                }
            }

            // Download subtitle if available
            if (subtitleUrl) {
                try {
                    this.updateJob(jobId, {
                        step: "subtitle",
                        status: "running",
                        message: "Downloading subtitle..."
                    });

                    const subtitleFileName = `${episodeId}_subtitle.vtt`;
                    subtitlePath = path.join(TEMP_DIR, subtitleFileName);

                    const subResult = await this.downloadSubtitle(subtitleUrl, subtitlePath);
                    if (!subResult.success) {
                        console.log(`[Pipeline] Subtitle download failed, continuing without subtitle`);
                        subtitlePath = null;
                    }
                } catch (error) {
                    console.error(`[Pipeline] Subtitle error: ${error.message}`);
                    subtitlePath = null;
                }
            }

            // Check if cancelled
            if (jobs.get(jobId)?.status === "cancelled") {
                return;
            }

            // Step 3: Upload to Rumble
            this.updateJob(jobId, {
                step: "upload",
                status: "running",
                message: "Uploading to Rumble...",
                progress: { percent: 0 }
            });

            const uploader = new RumbleUploader(cookies);
            uploader.onProgress((stage, data) => {
                if (stage === "chunk_uploaded") {
                    this.updateJob(jobId, {
                        step: "upload",
                        message: `Uploading: ${data.percent}%`,
                        progress: {
                            chunk: data.chunk,
                            totalChunks: data.totalChunks,
                            percent: data.percent
                        }
                    });
                }
            });

            const uploadResult = await uploader.upload(
                outputFile,
                title,
                options.description || "",
                {
                    visibility: options.visibility || "unlisted",
                    tags: options.tags || "",
                    subtitlePath: subtitlePath
                }
            );

            if (!uploadResult.success) {
                // DON'T delete the file if upload failed
                console.log(`[Pipeline] Upload failed, keeping file: ${outputFile}`);
                throw new Error(`Upload failed: ${uploadResult.error}`);
            }

            // Upload succeeded - delete the file
            console.log(`[Pipeline] Upload success, deleting file: ${outputFile}`);
            if (fs.existsSync(outputFile)) {
                fs.unlinkSync(outputFile);
            }

            // Delete subtitle file if exists
            if (subtitlePath && fs.existsSync(subtitlePath)) {
                fs.unlinkSync(subtitlePath);
            }

            // Complete
            this.updateJob(jobId, {
                step: "complete",
                status: "completed",
                completed: true,
                success: true,
                videoId: uploadResult.videoId,
                videoUrl: uploadResult.videoUrl,
                title: title
            });

        } catch (error) {
            console.error(`[Pipeline] Error: ${error.message}`);
            // Note: We do NOT delete outputFile on error - keep it for retry
            this.updateJob(jobId, {
                status: "error",
                error: error.message,
                completed: true
            });
        }
    }

    /**
     * Format bytes helper
     */
    static formatBytes(bytes) {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
        return bytes + " bytes";
    }
}

module.exports = Pipeline;
