/**
 * 9Anime Extractor - Node.js
 * Uses anime-api to get iframe URL, then opens it with _debug=ok to capture m3u8
 * 
 * Flow:
 * 1. Call anime-api to get iframe URL
 * 2. Open iframe URL + &_debug=ok in Puppeteer
 * 3. Capture m3u8 from network requests
 */

const axios = require("axios");
const puppeteer = require("puppeteer-core");
const fs = require("fs");

require("dotenv").config();
const API_BASE = process.env.API_BASE || "https://anime-api-itzzzme.vercel.app/api";

// Chrome paths
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    process.env.CHROME_PATH
].filter(Boolean);

class AnimeExtractor {
    constructor() {
        this.timeout = 30000;
    }

    /**
     * Find Chrome executable
     */
    findChrome() {
        for (const chromePath of CHROME_PATHS) {
            if (fs.existsSync(chromePath)) {
                return chromePath;
            }
        }
        return null;
    }

    /**
     * Extract video stream from 9anime URL
     */
    async extract(url, videoType = "sub") {
        try {
            // Check if it's a direct m3u8 URL
            if (url.includes(".m3u8")) {
                return {
                    success: true,
                    m3u8: url,
                    title: "Direct M3U8",
                    episodeId: "direct_" + Date.now(),
                    source: "direct"
                };
            }

            // Parse episode ID from URL
            const episodeId = this.parseEpisodeId(url);
            if (!episodeId) {
                return { success: false, error: "Could not parse episode ID from URL. Expected format: ?ep=XXXXX" };
            }

            // Get anime slug from URL
            const animeSlug = this.parseAnimeSlug(url);
            if (!animeSlug) {
                return { success: false, error: "Could not parse anime slug from URL" };
            }

            console.log(`[9anime] Anime: ${animeSlug}, Episode: ${episodeId}, Type: ${videoType}`);

            // Step 1: Call the anime API to get iframe URL
            const apiId = `${animeSlug}?ep=${episodeId}`;
            const apiUrl = `${API_BASE}/stream?id=${encodeURIComponent(apiId)}&server=hd-1&type=${videoType}`;

            console.log(`[9anime] Calling API: ${apiUrl}`);
            const response = await axios.get(apiUrl, {
                timeout: this.timeout,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            });

            const data = response.data;

            if (!data.success || !data.results?.streamingLink) {
                return { success: false, error: "API returned no streaming link" };
            }

            const streamingLink = data.results.streamingLink;
            const iframeUrl = streamingLink.iframe;

            if (!iframeUrl) {
                return { success: false, error: "No iframe URL found in API response" };
            }

            console.log(`[9anime] Got iframe URL: ${iframeUrl}`);

            // Step 2: Add _debug=ok parameter to iframe URL
            const debugUrl = iframeUrl + (iframeUrl.includes("?") ? "&" : "?") + "_debug=ok";
            console.log(`[9anime] Opening debug URL: ${debugUrl}`);

            // Step 3: Open in Puppeteer and capture m3u8
            const m3u8Result = await this.captureM3u8FromIframe(debugUrl);

            if (!m3u8Result.success) {
                return m3u8Result;
            }

            // Extract title from anime slug
            let title = animeSlug
                .replace(/-\d+$/, "")
                .replace(/-/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());

            return {
                success: true,
                m3u8: m3u8Result.m3u8,
                title: title,
                episodeId: episodeId,
                source: "9anime",
                subtitles: streamingLink.tracks || []
            };

        } catch (error) {
            console.error("[9anime] Error:", error.message);
            return { success: false, error: `Extraction error: ${error.message}` };
        }
    }

    /**
     * Open iframe URL in Puppeteer and capture m3u8 from network
     */
    async captureM3u8FromIframe(iframeUrl) {
        let browser = null;
        let foundM3u8 = null;

        try {
            const chromePath = this.findChrome();
            if (!chromePath) {
                return { success: false, error: 'Chrome not found. Install Chrome or set CHROME_PATH.' };
            }

            console.log(`[9anime] Launching browser...`);
            browser = await puppeteer.launch({
                executablePath: chromePath,
                headless: 'new', // Use headless mode 'new' for headless mode
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security'
                ]
            });

            const page = await browser.newPage();

            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Listen for m3u8 in network requests
            page.on('response', async (response) => {
                const responseUrl = response.url();
                if (responseUrl.includes('.m3u8') && !foundM3u8) {
                    if (!responseUrl.includes('thumbnails') && !responseUrl.includes('preview') && !responseUrl.includes('sprite')) {
                        console.log(`[9anime] Captured m3u8: ${responseUrl}`);
                        foundM3u8 = responseUrl;
                    }
                }
            });

            // Navigate to iframe URL
            console.log('[9anime] Navigating to iframe...');
            await page.goto(iframeUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for video to start (the player should auto-play with _debug=ok)
            if (!foundM3u8) {
                console.log('[9anime] Waiting for m3u8...');
                await this.delay(5000);
            }

            // Try clicking play button if m3u8 still not found
            if (!foundM3u8) {
                try {
                    await page.click('.jw-icon-playback, .play-btn, [class*="play"]').catch(() => { });
                    await this.delay(3000);
                } catch (e) { }
            }

            await browser.close();
            browser = null;

            if (!foundM3u8) {
                return { success: false, error: 'Could not capture m3u8 from iframe' };
            }

            return { success: true, m3u8: foundM3u8 };

        } catch (error) {
            if (browser) await browser.close();
            return { success: false, error: `Browser error: ${error.message}` };
        }
    }

    /**
     * Parse episode ID from URL
     */
    parseEpisodeId(url) {
        const match = url.match(/[?&]ep=(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Parse anime slug from URL
     */
    parseAnimeSlug(url) {
        const match = url.match(/\/watch\/([^/?]+)/);
        return match ? match[1] : null;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AnimeExtractor;
