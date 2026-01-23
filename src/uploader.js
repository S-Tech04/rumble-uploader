/**
 * Rumble Uploader - Node.js
 * Handles chunked uploads to Rumble following their exact API flow
 * 
 * Flow:
 * 1. PUT chunks - upload.php?chunk=INDEX_FILENAME&chunkSz=SIZE&chunkQty=TOTAL&api=1.3
 * 2. POST merge - upload.php?merge=LAST_INDEX&chunk=FILENAME&chunkSz=SIZE&chunkQty=TOTAL&api=1.3
 * 3. GET duration - upload.php?duration=VIDEO_FILE_ID&api=1.3
 * 4. GET thumbnails - upload.php?thumbnails=VIDEO_FILE_ID&api=1.3
 * 5. POST form - upload.php?form=1&api=1.3
 * 6. (Optional) Upload subtitles - UploadClosedCaptions + edit with closed_captions
 */

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const CHUNK_SIZE = 50000000; // 50MB (same as Rumble)
const RUMBLE_UPLOAD_HOST = process.env.RUMBLE_UPLOAD_HOST || "https://web17.rumble.com";
const API_VERSION = "1.3";

class RumbleUploader {
    constructor(cookies) {
        this.cookies = cookies;
        this.progressCallback = null;
    }

    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Upload video to Rumble
     */
    async upload(filePath, title, description, options = {}) {
        try {
            // Get file info
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const originalFileName = path.basename(filePath);

            // Generate unique filename with timestamp
            const timestamp = Date.now();
            const randomId = Math.floor(Math.random() * 1000000);
            const uploadFileName = `${timestamp}-${randomId}.mp4`;

            const chunkQty = Math.ceil(fileSize / CHUNK_SIZE);

            console.log(`[Uploader] Uploading ${originalFileName} (${this.formatBytes(fileSize)}) in ${chunkQty} chunks`);

            this.reportProgress('upload_start', {
                totalChunks: chunkQty,
                totalSize: fileSize,
                chunkSize: CHUNK_SIZE
            });

            // Step 1: Upload chunks via PUT
            const fileHandle = fs.openSync(filePath, 'r');

            for (let i = 0; i < chunkQty; i++) {
                const chunkStart = i * CHUNK_SIZE;
                const chunkEnd = Math.min((i + 1) * CHUNK_SIZE, fileSize);
                const chunkLength = chunkEnd - chunkStart;

                // Read chunk
                const buffer = Buffer.alloc(chunkLength);
                fs.readSync(fileHandle, buffer, 0, chunkLength, chunkStart);

                // Upload chunk via PUT
                const chunkUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?chunk=${i}_${uploadFileName}&chunkSz=${CHUNK_SIZE}&chunkQty=${chunkQty}&api=${API_VERSION}`;

                console.log(`[Uploader] Uploading chunk ${i + 1}/${chunkQty}`);

                await axios({
                    method: 'PUT',
                    url: chunkUrl,
                    data: buffer,
                    headers: {
                        'Cookie': this.cookies,
                        'Content-Type': 'application/octet-stream',
                        'Origin': 'https://rumble.com',
                        'Referer': 'https://rumble.com/'
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                this.reportProgress('chunk_uploaded', {
                    chunk: i + 1,
                    totalChunks: chunkQty,
                    percent: Math.round(((i + 1) / chunkQty) * 100),
                    uploadedSize: chunkEnd
                });
            }

            fs.closeSync(fileHandle);

            // Step 2: Merge chunks via POST
            console.log('[Uploader] Merging chunks...');
            const mergeUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?merge=${chunkQty - 1}&chunk=${uploadFileName}&chunkSz=${CHUNK_SIZE}&chunkQty=${chunkQty}&api=${API_VERSION}`;

            const mergeResponse = await axios({
                method: 'POST',
                url: mergeUrl,
                headers: {
                    'Cookie': this.cookies,
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/'
                }
            });

            // Response is the video file ID like "0-f3p1z3q7bzks0s00skosok8ow.mp4"
            const videoFileId = mergeResponse.data.trim();
            console.log(`[Uploader] Merge complete, video file ID: ${videoFileId}`);

            if (!videoFileId || !videoFileId.includes('.mp4')) {
                throw new Error(`Invalid merge response: ${mergeResponse.data}`);
            }

            // Step 3: Get duration
            console.log('[Uploader] Getting duration...');
            const durationUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?duration=${videoFileId}&api=${API_VERSION}`;

            const durationResponse = await axios({
                method: 'GET',
                url: durationUrl,
                headers: {
                    'Cookie': this.cookies,
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const duration = parseFloat(durationResponse.data) || 0;
            console.log(`[Uploader] Duration: ${duration}s`);

            // Step 4: Get thumbnails (optional, but Rumble expects it)
            console.log('[Uploader] Getting thumbnails...');
            try {
                const thumbnailsUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?thumbnails=${videoFileId}&api=${API_VERSION}`;
                await axios({
                    method: 'GET',
                    url: thumbnailsUrl,
                    headers: {
                        'Cookie': this.cookies,
                        'Origin': 'https://rumble.com',
                        'Referer': 'https://rumble.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            } catch (e) {
                console.log('[Uploader] Thumbnail fetch failed (non-critical)');
            }

            // Step 5: Submit form
            console.log('[Uploader] Submitting form...');
            const formUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?form=1&api=${API_VERSION}`;

            // Build form data as URL encoded
            const fileMeta = JSON.stringify({
                name: originalFileName,
                modified: Date.now(),
                size: fileSize,
                type: 'video/mp4',
                time_start: timestamp,
                speed: Math.round(fileSize / 60), // Approximate
                num_chunks: chunkQty,
                time_end: Date.now()
            });

            const formData = new URLSearchParams();
            formData.append('title', title);
            formData.append('description', description || '');
            formData.append('video[]', videoFileId);
            formData.append('featured', '0');
            formData.append('rights', '1');
            formData.append('terms', '1');
            formData.append('facebookUpload', '');
            formData.append('vimeoUpload', '');
            formData.append('infoWho', '');
            formData.append('infoWhen', '');
            formData.append('infoWhere', '');
            formData.append('infoExtUser', '');
            formData.append('tags', options.tags || '');
            formData.append('channelId', options.channelId || '0');
            formData.append('siteChannelId', '15');
            formData.append('mediaChannelId', '4443');
            formData.append('isGamblingRelated', 'false');
            formData.append('set_default_channel_id', '1');
            formData.append('sendPush', '0');
            formData.append('setFeaturedForUser', '0');
            formData.append('setFeaturedForChannel', '0');
            formData.append('visibility', options.visibility || 'unlisted');
            formData.append('availability', 'free');
            formData.append('file_meta', fileMeta);

            const formResponse = await axios({
                method: 'POST',
                url: formUrl,
                data: formData.toString(),
                headers: {
                    'Cookie': this.cookies,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const responseHtml = formResponse.data;
            console.log('[Uploader] Form submitted, parsing response...');

            // Extract URL from response - look for iframe src or url in setSuccess
            let videoUrl = null;

            // Try to extract from setSuccess({url: "..."})
            const urlMatch = responseHtml.match(/url:\s*["']([^"']+)["']/);
            if (urlMatch) {
                videoUrl = urlMatch[1];
            }

            // Or try iframe src
            if (!videoUrl) {
                const iframeMatch = responseHtml.match(/src=["']([^"']+embed[^"']+)["']/);
                if (iframeMatch) {
                    videoUrl = iframeMatch[1];
                }
            }

            if (videoUrl) {
                console.log(`[Uploader] Success! Video URL: ${videoUrl}`);
                
                // Extract media ID from the video URL
                // URL format: https://rumble.com/v5abc12-title.html or embed/v5abc12
                let mediaId = null;
                
                // Try to extract from embed URL
                const embedMatch = videoUrl.match(/embed\/([a-z0-9]+)/i);
                if (embedMatch) {
                    mediaId = embedMatch[1];
                }
                
                // Try to extract from regular URL
                if (!mediaId) {
                    const urlMatch = videoUrl.match(/rumble\.com\/([a-z0-9]+)-/i);
                    if (urlMatch) {
                        mediaId = urlMatch[1];
                    }
                }
                
                // Fallback: extract from videoFileId (format: 0-f3p1z3q7bzks0s00skosok8ow.mp4)
                if (!mediaId) {
                    const fileIdMatch = videoFileId.match(/^\d+-([a-z0-9]+)\.mp4$/);
                    mediaId = fileIdMatch ? fileIdMatch[1] : videoFileId.replace('.mp4', '');
                }
                
                console.log(`[Uploader] Extracted media ID: ${mediaId}`);
                
                // Upload subtitle if provided
                let subtitleUploaded = false;
                if (options.subtitlePath && fs.existsSync(options.subtitlePath)) {
                    console.log('[Uploader] Uploading subtitle...');
                    try {
                        const subResult = await this.uploadSubtitle(mediaId, options.subtitlePath, title);
                        if (subResult.success) {
                            console.log('[Uploader] Subtitle uploaded successfully');
                            subtitleUploaded = true;
                        } else {
                            console.warn('[Uploader] Subtitle upload failed:', subResult.error);
                        }
                    } catch (subError) {
                        console.warn('[Uploader] Subtitle upload error:', subError.message);
                    }
                }
                
                return {
                    success: true,
                    videoId: videoFileId,
                    videoUrl: videoUrl,
                    subtitleUploaded: subtitleUploaded
                };
            }

            // Check for any error in response
            if (responseHtml.includes('error') || responseHtml.includes('Error')) {
                throw new Error('Upload form returned error');
            }

            return {
                success: true,
                videoId: videoFileId,
                videoUrl: `https://rumble.com/video/${videoFileId}`
            };

        } catch (error) {
            console.error('[Uploader] Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload subtitle to Rumble video
     * Based on the process from init.js
     */
    async uploadSubtitle(mediaId, subtitlePath, videoTitle) {
        try {
            console.log(`[Uploader] Starting subtitle upload for media ID: ${mediaId}`);
            console.log(`[Uploader] Subtitle file: ${subtitlePath}`);
            
            // Step 1: Upload subtitle file to get token
            const fileName = `cc-${Date.now().toString().substring(0, 13)}-${Math.floor(Math.random() * 90000) + 10000}`;
            const formData = new FormData();
            formData.append("filename", fileName);
            formData.append("file", fs.createReadStream(subtitlePath));
            formData.append("language", "en");
            
            // Upload closed captions file
            const uploadUrl = `https://rumble.com/api/Media/UploadClosedCaptions?mid=${encodeURIComponent(mediaId)}&sid=8&filename=${encodeURIComponent(fileName)}&apiKey=31ui4o8sos`;
            
            console.log(`[Uploader] Uploading to: ${uploadUrl}`);
            
            const uploadResponse = await axios({
                method: "POST",
                url: uploadUrl,
                data: formData,
                headers: {
                    ...formData.getHeaders(),
                    "Cookie": this.cookies,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Origin": "https://rumble.com",
                    "Referer": "https://rumble.com/"
                }
            });
            
            console.log(`[Uploader] Upload response status: ${uploadResponse.status}`);
            console.log(`[Uploader] Upload response data:`, uploadResponse.data);
            
            let uploadToken = null;
            const uploadData = uploadResponse.data;
            
            // Parse response to get token
            if (uploadData.return && uploadData.return.status === true) {
                uploadToken = (uploadData.return.message || "uploaded").split(".")[0];
            } else if (uploadData.success === true) {
                uploadToken = uploadData.message || uploadData.data?.token || "uploaded";
            } else if (uploadData.filename) {
                uploadToken = uploadData.filename;
            } else if (typeof uploadData === "string") {
                uploadToken = uploadData.split(".")[0];
            }
            
            if (!uploadToken) {
                throw new Error(`Failed to get upload token. Response: ${JSON.stringify(uploadData)}`);
            }
            
            console.log(`[Uploader] Subtitle uploaded, token: ${uploadToken}`);
            
            // Step 2: Save subtitle metadata
            const saveFormData = new FormData();
            saveFormData.append("title", videoTitle);
            saveFormData.append("closed_captions", JSON.stringify({ uploads: { en: uploadToken }, removals: {} }));
            saveFormData.append("mediaChannelId", "0");
            saveFormData.append("siteChannelId", "15");
            saveFormData.append("channelId", "0");
            saveFormData.append("closed_captions_file", "");
            saveFormData.append("visibility", "unlisted");
            saveFormData.append("is_featured_for_user", "0");
            saveFormData.append("is_featured_for_channel", "0");
            saveFormData.append("youtubeUrl", "");
            saveFormData.append("tags", "");
            saveFormData.append("description", "");
            saveFormData.append("editThumb", "");
            
            const saveUrl = `https://rumble.com/account/content?a=edit&sid=8&id=${encodeURIComponent(mediaId)}&apiKey=324vec0c3o`;
            
            console.log(`[Uploader] Saving metadata to: ${saveUrl}`);
            
            const saveResponse = await axios({
                method: "POST",
                url: saveUrl,
                data: saveFormData,
                headers: {
                    ...saveFormData.getHeaders(),
                    "Cookie": this.cookies,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Origin": "https://rumble.com",
                    "Referer": "https://rumble.com/"
                }
            });
            
            console.log(`[Uploader] Save response status: ${saveResponse.status}`);
            
            if (saveResponse.status === 200) {
                console.log("[Uploader] Subtitle metadata saved successfully");
                return { success: true };
            } else {
                throw new Error(`Save subtitle metadata failed with status ${saveResponse.status}`);
            }
            
        } catch (error) {
            console.error("[Uploader] Subtitle upload error:", error.message);
            if (error.response) {
                console.error("[Uploader] Error response status:", error.response.status);
                console.error("[Uploader] Error response data:", error.response.data);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Report progress
     */
    reportProgress(stage, data) {
        if (this.progressCallback) {
            this.progressCallback(stage, data);
        }
    }

    /**
     * Format bytes
     */
    formatBytes(bytes) {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' bytes';
    }
}

module.exports = RumbleUploader;
