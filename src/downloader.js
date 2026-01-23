/**
 * HLS Downloader - Node.js
 * Downloads HLS streams in parallel and converts to MP4
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const puppeteer = require('puppeteer-core');

class HLSDownloader {
    constructor(options = {}) {
        this.maxParallel = options.maxParallel || 20;
        this.timeout = options.timeout || 30000;
        // Default headers for CDN access
        this.headers = options.headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Referer': 'https://rapid-cloud.co/',
            'Origin': 'https://rapid-cloud.co'
        };
        this.progressCallback = options.progressCallback || null;
    }

    /**
     * Download HLS stream to MP4
     */
    async download(m3u8Url, outputPath) {
        const tempDir = path.dirname(outputPath) + '/dl_' + Date.now();

        console.log(`[Downloader] Starting download: ${m3u8Url}`);
        console.log(`[Downloader] Output: ${outputPath}`);

        try {
            // Create temp directory
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            console.log(`[Downloader] Temp dir: ${tempDir}`);

            // Extract M3U8 from player page if needed
            if (!m3u8Url.includes('.m3u8')) {
                console.log(`[Downloader] URL doesn't contain .m3u8, extracting from player page...`);
                this.reportProgress('extracting', { message: 'Extracting M3U8 URL from player page...' });
                m3u8Url = await this.extractM3U8FromPage(m3u8Url);
                console.log(`[Downloader] Extracted M3U8 URL: ${m3u8Url}`);
            }

            // 1. Fetch playlist
            this.reportProgress('fetching', { message: 'Fetching playlist...' });
            console.log(`[Downloader] Fetching playlist...`);
            const { content, baseUrl } = await this.fetchPlaylist(m3u8Url);
            console.log(`[Downloader] Playlist fetched, base URL: ${baseUrl}`);

            // 2. Parse segments
            const segments = this.parseSegments(content, baseUrl);
            if (segments.length === 0) {
                throw new Error('No segments found in playlist');
            }

            this.reportProgress('parsed', { total: segments.length });
            console.log(`[Downloader] Found ${segments.length} segments`);

            // 3. Download segments in parallel
            console.log(`[Downloader] Starting segment downloads...`);
            const segmentFiles = await this.downloadSegments(segments, tempDir);
            console.log(`[Downloader] Downloaded ${segmentFiles.length} segment files`);

            // 4. Concatenate segments
            this.reportProgress('concatenating', { message: 'Merging segments...' });
            const tsFile = path.join(tempDir, 'combined.ts');
            await this.concatenateSegments(segmentFiles, tsFile);

            // Cleanup segment files
            for (const file of segmentFiles) {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            }

            // 5. Convert to MP4
            this.reportProgress('converting', { message: 'Converting to MP4...' });
            await this.convertToMp4(tsFile, outputPath);

            // Cleanup
            if (fs.existsSync(tsFile)) fs.unlinkSync(tsFile);
            if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

            const fileSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;

            return {
                success: true,
                path: outputPath,
                size: fileSize,
                segments: segments.length
            };

        } catch (error) {
            // Cleanup on error
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract M3U8 URL from player page using Puppeteer
     */
    async extractM3U8FromPage(pageUrl) {
        let browser = null;
        let capturedM3U8 = null;

        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            });

            const page = await browser.newPage();

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            page.on('request', request => {
                const url = request.url();
                if (url.includes('.m3u8')) {
                    console.log(`[Downloader] Captured M3U8 URL: ${url}`);
                    if (!capturedM3U8) {
                        capturedM3U8 = url;
                    }
                }
            });

            console.log(`[Downloader] Navigating to player page...`);
            await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            await new Promise(resolve => setTimeout(resolve, 5000));

            if (!capturedM3U8) {
                const iframes = await page.frames();
                for (const frame of iframes) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (e) {
                        // Ignore timeout
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            await browser.close();

            if (!capturedM3U8) {
                throw new Error('Could not extract M3U8 URL from player page. Please provide a direct M3U8 URL.');
            }

            return capturedM3U8;

        } catch (error) {
            if (browser) await browser.close();
            throw new Error(`Failed to extract M3U8: ${error.message}`);
        }
    }

    /**
     * Fetch and resolve playlist
     */
    async fetchPlaylist(m3u8Url) {
        const response = await axios.get(m3u8Url, {
            headers: this.headers,
            timeout: this.timeout
        });

        let content = response.data;

        // Validate that this is actually an M3U8 file
        if (!content.includes('#EXTM3U')) {
            throw new Error('Invalid M3U8 URL: The extracted URL does not contain a valid M3U8 playlist.');
        }

        let baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

        // Handle master playlist
        if (content.includes('#EXT-X-STREAM-INF')) {
            const variantUrl = this.getBestVariant(content, baseUrl);
            if (variantUrl) {
                const variantResp = await axios.get(variantUrl, {
                    headers: this.headers,
                    timeout: this.timeout
                });
                content = variantResp.data;
                baseUrl = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
            }
        }

        return { content, baseUrl };
    }

    /**
     * Get highest quality variant
     */
    getBestVariant(content, baseUrl) {
        const lines = content.split('\n');
        let bestUri = null;
        let maxBandwidth = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('BANDWIDTH')) {
                const match = lines[i].match(/BANDWIDTH=(\d+)/);
                if (match && parseInt(match[1]) > maxBandwidth) {
                    maxBandwidth = parseInt(match[1]);
                    bestUri = lines[i + 1]?.trim();
                }
            }
        }

        if (bestUri) {
            return bestUri.startsWith('http') ? bestUri : new URL(bestUri, baseUrl).href;
        }
        return null;
    }

    /**
     * Parse segment URLs from playlist
     */
    parseSegments(content, baseUrl) {
        const lines = content.split('\n');
        const segments = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const segUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
                segments.push(segUrl);
            }
        }

        return segments;
    }

    /**
     * Download segments in parallel
     */
    async downloadSegments(segments, tempDir) {
        const segmentFiles = [];
        const total = segments.length;

        for (let i = 0; i < segments.length; i += this.maxParallel) {
            const batch = segments.slice(i, i + this.maxParallel);

            const batchPromises = batch.map(async (url, idx) => {
                const absoluteIdx = i + idx;
                const segPath = path.join(tempDir, `seg_${String(absoluteIdx).padStart(6, '0')}.ts`);

                try {
                    const response = await axios({
                        method: 'get',
                        url: url,
                        headers: this.headers,
                        responseType: 'stream',
                        timeout: this.timeout
                    });

                    const writer = fs.createWriteStream(segPath);
                    response.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    segmentFiles[absoluteIdx] = segPath;
                } catch (e) {
                    console.error(`Failed segment ${absoluteIdx}: ${e.message}`);
                }
            });

            await Promise.all(batchPromises);

            const downloaded = Math.min(i + batch.length, total);
            const percent = Math.round((downloaded / total) * 100);
            this.reportProgress('downloading', { downloaded, total, percent });
        }

        return segmentFiles.filter(f => f);
    }

    /**
     * Concatenate segment files
     */
    async concatenateSegments(segmentFiles, outputPath) {
        const outputStream = fs.createWriteStream(outputPath);

        for (const file of segmentFiles) {
            if (file && fs.existsSync(file)) {
                const data = fs.readFileSync(file);
                outputStream.write(data);
            }
        }

        outputStream.end();
        await new Promise(r => outputStream.on('finish', r));
    }

    /**
     * Convert TS to MP4 using ffmpeg
     */
    async convertToMp4(tsFile, mp4File) {
        // Try remux first (fast)
        try {
            await execAsync(`ffmpeg -y -i "${tsFile}" -c copy -bsf:a aac_adtstoasc "${mp4File}"`);
            if (fs.existsSync(mp4File) && fs.statSync(mp4File).size > 1000) {
                return true;
            }
        } catch (e) {
            console.log('Remux failed, trying re-encode...');
        }

        // Re-encode if remux fails
        await execAsync(`ffmpeg -y -i "${tsFile}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${mp4File}"`);

        if (!fs.existsSync(mp4File) || fs.statSync(mp4File).size < 1000) {
            throw new Error('FFmpeg conversion failed');
        }

        return true;
    }

    /**
     * Report progress
     */
    reportProgress(stage, data) {
        if (this.progressCallback) {
            this.progressCallback(stage, data);
        }
    }
}

module.exports = HLSDownloader;
