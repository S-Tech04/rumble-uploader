const axios = require("axios");
const Pipeline = require("../pipeline");

const API_BASE = process.env.API_BASE || "https://anime-api-itzzzme.vercel.app/api";

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
        const { animeId, cookies, videoType, title, episodeRange } = req.body;

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

        const results = [];
        
        for (const episode of episodes) {
            const episodeUrl = `https://9animetv.to/watch/${episode.id}`;
            
            try {
                const result = await Pipeline.start(episodeUrl, cookies || "", {
                    title: title || episode.title,
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
