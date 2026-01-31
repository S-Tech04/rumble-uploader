const axios = require("axios");
const Pipeline = require("../pipeline");

const API_BASE = process.env.API_BASE || "https://anime-api-itzzzme.vercel.app/api";

exports.searchAnime = async (req, res) => {
    try {
        const { keyword } = req.query;
        
        if (!keyword) {
            return res.status(400).json({ success: false, error: "Missing keyword parameter" });
        }

        const apiUrl = `${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`;
        
        const response = await axios.get(apiUrl);
        const data = response.data;

        res.json(data);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getEpisodes = async (req, res) => {
    try {
        const { animeId } = req.params;
        const apiUrl = `${API_BASE}/episodes/${animeId}`;
        
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data.success || !data.results) {
            return res.status(500).json({ 
                success: false, 
                error: "Failed to fetch episodes from API" 
            });
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.startBulkEpisodes = async (req, res) => {
    try {
        const { animeId, cookies, videoType, title, titleFormat, episodeRange } = req.body;

        if (!animeId) {
            return res.status(400).json({ success: false, error: "Missing animeId" });
        }

        const apiUrl = `${API_BASE}/episodes/${animeId}`;
        
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data.success || !data.results || !data.results.episodes) {
            return res.status(500).json({ 
                success: false, 
                error: "Failed to fetch episodes from API" 
            });
        }

        let episodes = data.results.episodes;

        if (episodeRange && episodeRange.start && episodeRange.end) {
            episodes = episodes.filter(ep => 
                ep.episode_no >= episodeRange.start && 
                ep.episode_no <= episodeRange.end
            );
        }

        if (episodes.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "No episodes found in the specified range" 
            });
        }

        const animeInfoUrl = `${API_BASE}/info?id=${animeId}`;
        let animeInfo = null;
        
        try {
            const infoResponse = await axios.get(animeInfoUrl);
            if (infoResponse.data.success && infoResponse.data.results && infoResponse.data.results.data) {
                animeInfo = infoResponse.data.results.data;
                console.log(`[EpisodeController] Anime info fetched: ${animeInfo.title} (${animeInfo.japanese_title})`);
            }
        } catch (error) {
            console.error(`[EpisodeController] Failed to fetch anime info: ${error.message}`);
        }

        const results = [];
        
        for (const episode of episodes) {
            const episodeUrl = `https://9animetv.to/watch/${episode.id}`;
            
            try {
                let episodeTitle = title;
                
                if (episodeTitle && animeInfo) {
                    episodeTitle = episodeTitle
                        .replace(/\{jp\}/g, animeInfo.japanese_title || "")
                        .replace(/\{en\}/g, animeInfo.title || "")
                        .replace(/\{ep_no\}/g, episode.episode_no);
                } else if (!episodeTitle && animeInfo) {
                    if (titleFormat === "japanese" && animeInfo.japanese_title) {
                        episodeTitle = `${animeInfo.japanese_title} Episode ${episode.episode_no}`;
                    } else if (titleFormat === "english" && animeInfo.title) {
                        episodeTitle = `${animeInfo.title} Episode ${episode.episode_no}`;
                    } else {
                        episodeTitle = episode.title;
                    }
                } else if (!episodeTitle) {
                    episodeTitle = episode.title;
                }
                
                const result = await Pipeline.start(episodeUrl, cookies || "", {
                    title: episodeTitle,
                    linkType: "anime",
                    videoType: videoType || "sub"
                });
                results.push(result);
            } catch (error) {
                console.error(`Failed to start pipeline for episode ${episode.episode_no}:`, error.message);
            }
        }

        res.json({ 
            success: true, 
            count: results.length,
            totalEpisodes: episodes.length,
            results 
        });

    } catch (error) {
        console.error("Error in bulk episodes:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
