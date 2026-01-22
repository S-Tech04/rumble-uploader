/**
 * Pipeline Orchestrator - Node.js
 * Manages the extraction, download, and upload workflow
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AnimeExtractor = require('./extractors/9anime');
const HLSDownloader = require('./downloader');
const RumbleUploader = require('./uploader');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const DOWNLOADED_DIR = path.join(__dirname, '..', 'downloaded');

// Job storage (in-memory for simplicity)
const jobs = new Map();

class Pipeline {
    /**
     * Start a new pipeline job
     */
    static async start(videoUrl, cookies, options = {}) {
        const jobId = uuidv4();

        // Initialize job status
        const job = {
            id: jobId,
            url: videoUrl,
            status: 'running',
            step: 'extract',
            message: 'Initializing...',
            progress: {},
            completed: false,
            createdAt: new Date()
        };

        jobs.set(jobId, job);

        // Run pipeline in background
        this.runPipeline(jobId, videoUrl, cookies, options).catch(err => {
            this.updateJob(jobId, {
                status: 'error',
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
            return { error: 'Job not found' };
        }
        return job;
    }

    /**
     * Cancel a job
     */
    static cancel(jobId) {
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'cancelled';
            job.completed = true;
            job.error = 'Cancelled by user';
        }
        return { success: true };
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
     * Run the pipeline
     */
    static async runPipeline(jobId, videoUrl, cookies, options) {
        const job = jobs.get(jobId);
        if (!job) return;

        let outputFile = null;
        let episodeId = null;

        try {
            // Ensure directories exist
            if (!fs.existsSync(TEMP_DIR)) {
                fs.mkdirSync(TEMP_DIR, { recursive: true });
            }
            if (!fs.existsSync(DOWNLOADED_DIR)) {
                fs.mkdirSync(DOWNLOADED_DIR, { recursive: true });
            }

            // Step 1: Extract
            this.updateJob(jobId, {
                step: 'extract',
                status: 'running',
                message: 'Extracting video info...'
            });

            const extractor = new AnimeExtractor();
            const extractResult = await extractor.extract(videoUrl);

            if (!extractResult.success) {
                throw new Error(`Extraction failed: ${extractResult.error}`);
            }

            const title = options.title || extractResult.title;
            const m3u8Url = extractResult.m3u8;
            episodeId = extractResult.episodeId || 'unknown';

            console.log(`[Pipeline] Episode ID: ${episodeId}, Title: ${title}`);

            // Generate output filename based on episode ID
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            outputFile = path.join(DOWNLOADED_DIR, `ep_${episodeId}_${safeTitle}.mp4`);

            // Check if file already exists
            if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 1000) {
                console.log(`[Pipeline] File already exists: ${outputFile}`);
                const fileSize = fs.statSync(outputFile).size;

                this.updateJob(jobId, {
                    step: 'download',
                    status: 'running',
                    title: title,
                    message: 'File already downloaded, skipping to upload...',
                    progress: {
                        percent: 100,
                        size: fileSize,
                        sizeFormatted: this.formatBytes(fileSize)
                    }
                });
            } else {
                // Need to download
                this.updateJob(jobId, {
                    step: 'download',
                    status: 'running',
                    title: title,
                    m3u8: m3u8Url,
                    message: 'Starting download...',
                    progress: { percent: 0, downloaded: 0, total: 0 }
                });

                // Check if cancelled
                if (jobs.get(jobId)?.status === 'cancelled') return;

                // Download to temp first, then move to downloaded folder
                const tempFile = path.join(TEMP_DIR, `video_${jobId}.mp4`);

                const downloader = new HLSDownloader({
                    maxParallel: 20,
                    progressCallback: (stage, data) => {
                        if (stage === 'downloading') {
                            this.updateJob(jobId, {
                                step: 'download',
                                message: `Downloading: ${data.percent}%`,
                                progress: {
                                    downloaded: data.downloaded,
                                    total: data.total,
                                    percent: data.percent
                                }
                            });
                        } else if (stage === 'converting') {
                            this.updateJob(jobId, {
                                step: 'download',
                                message: 'Converting to MP4...'
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
                    step: 'download',
                    status: 'running',
                    message: 'Download complete, ready for upload...',
                    progress: {
                        percent: 100,
                        size: fileSize,
                        sizeFormatted: this.formatBytes(fileSize)
                    }
                });
            }

            // Check if cancelled
            if (jobs.get(jobId)?.status === 'cancelled') {
                return;
            }

            // Step 3: Upload to Rumble
            this.updateJob(jobId, {
                step: 'upload',
                status: 'running',
                message: 'Uploading to Rumble...',
                progress: { percent: 0 }
            });

            const uploader = new RumbleUploader(cookies);
            uploader.onProgress((stage, data) => {
                if (stage === 'chunk_uploaded') {
                    this.updateJob(jobId, {
                        step: 'upload',
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
                options.description || '',
                {
                    visibility: options.visibility || 'unlisted',
                    tags: options.tags || ''
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

            // Complete
            this.updateJob(jobId, {
                step: 'complete',
                status: 'completed',
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
                status: 'error',
                error: error.message,
                completed: true
            });
        }
    }

    /**
     * Format bytes helper
     */
    static formatBytes(bytes) {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' bytes';
    }
}

module.exports = Pipeline;
