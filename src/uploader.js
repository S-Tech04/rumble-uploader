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
            const fileModified = stats.mtimeMs; // Actual file modification timestamp
            const originalFileName = path.basename(filePath);

            // Generate unique filename with timestamp (same format as browser)
            const timestamp = Date.now();
            // Browser uses 6-digit random ID, ensure we do the same
            const randomId = Math.floor(100000 + Math.random() * 900000); // Always 6 digits
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
                        // 'Content-Type': 'application/octet-stream',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Origin': 'https://rumble.com',
                        'Referer': 'https://rumble.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
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
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
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
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                }
            });

            const duration = parseFloat(durationResponse.data) || 0;
            console.log(`[Uploader] Duration: ${duration}s`);

            // Step 4: Get thumbnails - Rumble generates thumbnails and returns an ID we must use
            console.log('[Uploader] Getting thumbnails...');
            let thumbId = '4'; // Default fallback
            try {
                const thumbnailsUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?thumbnails=${videoFileId}&api=${API_VERSION}`;
                const thumbnailsResponse = await axios({
                    method: 'GET',
                    url: thumbnailsUrl,
                    headers: {
                        'Cookie': this.cookies,
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Origin': 'https://rumble.com',
                        'Referer': 'https://rumble.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                    }
                });

                // Parse thumbnail response to get the thumb ID
                // Response can be JSON with thumbnail IDs or HTML
                const thumbData = thumbnailsResponse.data;
                console.log('[Uploader] Thumbnails response:', typeof thumbData === 'string' ? thumbData.substring(0, 200) : JSON.stringify(thumbData).substring(0, 200));

                if (typeof thumbData === 'object' && thumbData.thumbs) {
                    // JSON response with thumbs array
                    const thumbs = thumbData.thumbs;
                    if (Array.isArray(thumbs) && thumbs.length > 0) {
                        thumbId = String(thumbs[0].id || thumbs[0]);
                    }
                } else if (typeof thumbData === 'string') {
                    // Try to extract thumb ID from HTML/text response
                    // Look for patterns like data-thumb="1003" or thumbId: 1003
                    const thumbMatch = thumbData.match(/(?:data-thumb=["']?|thumbId["\s:]+|"id"\s*:\s*)(\d+)/i);
                    if (thumbMatch) {
                        thumbId = thumbMatch[1];
                    } else {
                        // Sometimes the response is just a number or comma-separated IDs
                        const numMatch = thumbData.match(/^(\d+)/);
                        if (numMatch) {
                            thumbId = numMatch[1];
                        }
                    }
                }
                console.log(`[Uploader] Using thumb ID: ${thumbId}`);
            } catch (e) {
                console.log('[Uploader] Thumbnail fetch failed (non-critical), using default thumb');
            }

            // Step 5: Submit form
            console.log('[Uploader] Submitting form...');
            const formUrl = `${RUMBLE_UPLOAD_HOST}/upload.php?form=1&api=${API_VERSION}`;

            // Build file_meta exactly like the browser does
            const timeEnd = Date.now();
            const uploadDuration = (timeEnd - timestamp) / 1000; // seconds
            const uploadSpeed = Math.round(fileSize / uploadDuration);

            const fileMeta = JSON.stringify({
                name: originalFileName,
                modified: Math.round(fileModified), // Use actual file modification time
                size: fileSize,
                type: 'video/mp4',
                time_start: timestamp,
                speed: uploadSpeed,
                num_chunks: chunkQty,
                time_end: timeEnd
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
            formData.append('channelId', '0');
            formData.append('siteChannelId', options.siteChannelId || '15');
            formData.append('mediaChannelId', '0');
            formData.append('isGamblingRelated', 'false');
            formData.append('set_default_channel_id', '1');
            formData.append('sendPush', '0');
            formData.append('setFeaturedForUser', '0');
            formData.append('setFeaturedForChannel', '0');
            formData.append('visibility', options.visibility || 'unlisted');
            formData.append('availability', 'free');
            formData.append('file_meta', fileMeta);
            formData.append('thumb', thumbId);

            const formResponse = await axios({
                method: 'POST',
                url: formUrl,
                data: formData.toString(),
                headers: {
                    'Cookie': this.cookies,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'text/html, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Origin': 'https://rumble.com',
                    'Referer': 'https://rumble.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                    'Sec-CH-UA': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
                    'Sec-CH-UA-Mobile': '?0',
                    'Sec-CH-UA-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'Priority': 'u=1, i'
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

                // Extract video slug from the video URL
                let videoSlug = null;
                const slugMatch = videoUrl.match(/\/([a-z0-9]+-[^.]+)\.html/i);
                if (slugMatch) {
                    videoSlug = slugMatch[1];
                }

                console.log(`[Uploader] Extracted video slug: ${videoSlug}`);

                // Fetch media ID and site ID from content page
                let mediaId = null;
                let siteId = null;
                if (videoSlug) {
                    try {
                        const ids = await this.getMediaIdFromContentPage(videoSlug);
                        mediaId = ids.mediaId;
                        siteId = ids.siteId;
                        console.log(`[Uploader] Fetched media ID: ${mediaId}, site ID: ${siteId}`);
                    } catch (e) {
                        console.warn('[Uploader] Failed to fetch media ID:', e.message);
                    }
                }

                // Upload subtitle if provided
                let subtitleUploaded = false;
                if (options.subtitlePath && fs.existsSync(options.subtitlePath)) {
                    console.log('[Uploader] Uploading subtitle...');
                    try {
                        const subResult = await this.uploadSubtitle(mediaId, siteId, options.subtitlePath, title);
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
     * Fetch media ID and site ID from content page
     */
    async getMediaIdFromContentPage(videoSlug) {
        try {
            const contentPageUrl = 'https://rumble.com/account/content';
            const response = await axios({
                method: 'GET',
                url: contentPageUrl,
                headers: {
                    'Cookie': this.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                    'Referer': 'https://rumble.com/',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
                }
            });

            const html = response.data;

            // Find the video info div that contains the video slug
            const videoPattern = new RegExp(`<div class="info-video" id="([^"]+)">.*?href="/${videoSlug}\.html"`, 's');
            const match = html.match(videoPattern);

            if (match) {
                const infoVideoId = match[1];
                // ID format: 8_431669692_72tigk_item
                // Extract: 8 = siteId, 431669692 = mediaId
                const parts = infoVideoId.split('_');
                if (parts.length >= 2) {
                    return {
                        siteId: parts[0],
                        mediaId: parts[1]
                    };
                }
            }

            throw new Error(`Could not find media ID for video slug: ${videoSlug}`);
        } catch (error) {
            throw new Error(`Failed to fetch media ID: ${error.message}`);
        }
    }

    /**
     * Upload subtitle to Rumble video
     */
    async uploadSubtitle(mediaId, siteId, subtitlePath, videoTitle) {
        try {
            console.log(`[Uploader] Starting subtitle upload for media ID: ${mediaId}, site ID: ${siteId}`);
            console.log(`[Uploader] Subtitle file: ${subtitlePath}`);

            // Step 1: Upload subtitle file to get token
            const fileName = `cc-${Date.now().toString().substring(0, 13)}-${Math.floor(Math.random() * 90000) + 10000}`;
            const formData = new FormData();
            formData.append("filename", fileName);
            formData.append("file", fs.createReadStream(subtitlePath));
            formData.append("language", "en");

            // Upload closed captions file
            const uploadUrl = `https://rumble.com/api/Media/UploadClosedCaptions?mid=${encodeURIComponent(mediaId)}&sid=${encodeURIComponent(siteId)}&filename=${encodeURIComponent(fileName)}&apiKey=31ui4o8sos`;

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

            const saveUrl = `https://rumble.com/account/content?a=edit&sid=${encodeURIComponent(siteId)}&id=${encodeURIComponent(mediaId)}&apiKey=324vec0c3o`;

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
